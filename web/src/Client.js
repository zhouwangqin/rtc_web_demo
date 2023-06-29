import { EventEmitter } from 'events';
import protooClient from 'protoo-client';
import uuidv4 from 'uuid/v4';
import Stream from './Stream';
import * as sdpTransform from 'sdp-transform';

const ices = 'stun:stun.stunprotocol.org:3478';

const DefaultPayloadTypePCMU = 0;
const DefaultPayloadTypePCMA = 8;
const DefaultPayloadTypeG722 = 9;
const DefaultPayloadTypeOpus = 111;
const DefaultPayloadTypeVP8 = 96;
const DefaultPayloadTypeVP9 = 98;
const DefaultPayloadTypeH264 = 102;

export default class Client extends EventEmitter {

    constructor(hostname = undefined) {
        super();
		if (hostname == undefined){
			this._hostname = window.location.hostname
		}
		this._hostname = hostname
        this._port = 8443;
        this._uid = uuidv4();
        this._pcs = new Map();
        this._streams = new Map();
		this._midsid = new Map();
    }

    get uid() {
        return this._uid;
    }

    init() {
        this._url = this._getProtooUrl(this._uid);
		console.log('Peer "init" - url:' + this._url);

        let transport = new protooClient.WebSocketTransport(this._url,{
				// 验证 部分字段无效可看源码
				// protocols: ['foo'],
				// origin: 'https://example.com',
				// headers: {
				// 	'Sec-Websocket-Protocol1': '000',
				// },
				// requestOptions: {},
				// retry: { // 重试次数
				// 	retries: 2,
				// }
			}
			);
        this._protoo = new protooClient.Peer(transport);

        this._protoo.on('open', () => {
            console.log('Peer "open" event');
            this.emit('transport-open');
        });

        this._protoo.on('connected', () => {
            console.log('Peer "connected" event');
        });

        this._protoo.on('failed', (currentAttemp) => {
            console.log('Peer "failed" event - ' + currentAttemp);
        });

        this._protoo.on('disconnected', () => {
            console.log('Peer "disconnected" event');
            this.emit('transport-failed');
        });

        this._protoo.on('close', () => {
            console.log('Peer "close" event');
            this.emit('transport-closed');
        });

        this._protoo.on('request', this._handleRequest.bind(this));
        this._protoo.on('notification', this._handleNotification.bind(this));
    }

    async join(roomId, info = { name: 'Guest' }) {
        this._rid = roomId;
        try {
            let data = await this._protoo.request('join', { 'rid': this._rid });
            console.log('join success: result => ' + JSON.stringify(data));
			return data
        } catch (error) {
            console.log('join reject: error =>' + error);
        }
    }

    async leave() {
        try {
            let data = await this._protoo.request('leave', { 'rid': this._rid });
            console.log('leave success: result => ' + JSON.stringify(data));
        } catch (error) {
            console.log('leave reject: error =>' + error);
        }
    }

    async publish(options = { audio: true, video: true, screen: false, codec: 'h264', resolution: 'hd', bandwidth: 1024 }) {
        console.log('publish options => %o', options);
        var promise = new Promise(async (resolve, reject) => {
            try {
                let stream = new Stream();
                await stream.init(true, { audio: options.audio, video: options.video, screen: options.screen, resolution: options.resolution });
                let pc = await this._createSender(stream.stream, options.codec);

                pc.onicecandidate = async (e) => {
                    if (!pc.sendOffer) {
                        var offer = pc.localDescription;
                        console.log('Send offer sdp => ' + offer.sdp);
                        pc.sendOffer = true
                        let result = await this._protoo.request('publish', { rid: this._rid, jsep: offer, "minfo":{
							"audio":options.audio,
							"video":options.video,
							"audiotype":0,
							"videotype":0,
						} });
                        await pc.setRemoteDescription(result.jsep);
                        console.log('publish success => ' + JSON.stringify(result));
                        stream.mid = result.mid;
                        this._pcs[stream.mid] = pc;
						this._sfuid = result.sfuid;
                        resolve(stream);
                    }
                }
            } catch (error) {
                console.log('publish request error  => ' + error);
                throw error;
                pc.close();
                reject(error);
            }
        });
        return promise;
    }

    async unpublish(mid) {
        console.log('unpublish rid => %s, mid => %s', this._rid, mid);
        this._removePC(mid);
        try {
            let data = await this._protoo.request('unpublish', { rid: this._rid, mid,sfuid: this._sfuid });
            console.log('unpublish success: result => ' + JSON.stringify(data));
			this._sfuid = undefined
        } catch (error) {
            console.log('unpublish reject: error =>' + error);
        }
    }

    async subscribe(rid, mid) {
        console.log('subscribe rid => %s, mid => %a', rid, mid);
        var promise = new Promise(async (resolve, reject) => {
            try {
                let pc = await this._createReceiver(mid);
                pc.onaddstream = (e) => {
                    var stream = e.stream;
                    console.log('Stream::pc::onaddstream', stream.id);
                    resolve(new Stream(mid, stream));
                }
                pc.onremovestream = (e) => {
                    var stream = e.stream;
                    console.log('Stream::pc::onremovestream', stream.id);
                }
                pc.onicecandidate = async (e) => {
                    if (!pc.sendOffer) {
                        var jsep = pc.localDescription;
                        console.log('Send offer rid:'+rid+' mid: '+mid+'   sdp => ' + jsep.sdp);
                        pc.sendOffer = true
						let retry = 0
						let subscribeCb = async ()=>{
							try{
								console.log('subscribe request time:' + new Date().getTime() +' retry: '+ retry );
								let result = await this._protoo.request('subscribe', { rid, jsep, mid });
								this._midsid[mid] = result.sid
								console.log('subscribe success => result(' + mid + ') '+ result.sid +' sdp => ' + result.jsep.sdp);
								await pc.setRemoteDescription(result.jsep);
							}catch(error){
								console.log('subscribe request error  => ' + error);
								retry ++;
								if( retry > 10){
									setTimeout(subscribeCb,1000)
								}else{
									reject(error);
								}
							}
						}
						subscribeCb()
                    }
                }
            } catch (error) {
                console.log('subscribe request error  => ' + error);
                reject(error);
            }
        });
        return promise;
    }

    async unsubscribe(rid, mid,sfuid=undefined) {
        console.log('unsubscribe rid => %s, mid => %s , sfuid => %s', rid, mid,sfuid);
        try {
            let data = await this._protoo.request('unsubscribe', { rid, mid,sid:this._midsid[mid],sfuid });
            console.log('unsubscribe success: result => ' + JSON.stringify(data));
            this._removePC(mid);
        } catch (error) {
            console.log('unsubscribe reject: error =>' + error);
        }
    }

    async broadcast(rid, data) {
        console.log('broadcast rid => %s, data => %s', rid, data);
        try {
            let data = await this._protoo.request('broadcast', { rid, data });
            console.log('broadcast success: result => ' + JSON.stringify(data));
        } catch (error) {
            console.log('broadcast reject: error =>' + error);
        }
    }

    async keepalive(rid) {
        console.log('keepalive rid => %s', rid);
        try {
            let data = await this._protoo.request('keepalive', { rid });
            console.log('keepalive success: result => ' + JSON.stringify(data));
        } catch (error) {
            console.log('keepalive reject: error =>' + error);
        }
    }

    close() {
        this._protoo.close();
    }

    _payloadModify(desc, codec) {

        if (codec === undefined)
            return desc;

        /*
         * DefaultPayloadTypePCMU = 0
         * DefaultPayloadTypePCMA = 8
         * DefaultPayloadTypeG722 = 9
         * DefaultPayloadTypeOpus = 111
         * DefaultPayloadTypeVP8  = 96
         * DefaultPayloadTypeVP9  = 98
         * DefaultPayloadTypeH264 = 102
        */
        let payload;
        let codeName = '';
        const session = sdpTransform.parse(desc.sdp);
        console.log('SDP object => %o', session);
        var videoIdx = -1;
        session['media'].map((m, index) => {
            if (m.type == 'video') {
                videoIdx = index;
            }
        });

        if (videoIdx == -1) return desc;

        if (codec.toLowerCase() === 'vp8') {
            payload = DefaultPayloadTypeVP8;
            codeName = "VP8";
        } else if (codec.toLowerCase() === 'vp9') {
            payload = DefaultPayloadTypeVP9;
            codeName = "VP9";
        } else if (codec.toLowerCase() === 'h264') {
            payload = DefaultPayloadTypeH264;
            codeName = "H264";
        } else {
            return desc;
        }

        console.log('Setup codec => ' + codeName + ', payload => ' + payload);

        var rtp = [
            { "payload": payload, "codec": codeName, "rate": 90000, "encoding": null },
            { "payload": 97, "codec": "rtx", "rate": 90000, "encoding": null }
        ];

        session['media'][videoIdx]["payloads"] = payload + " 97";
        session['media'][videoIdx]["rtp"] = rtp;

        var fmtp = [
            { "payload": 97, "config": "apt=" + payload }
        ];

        session['media'][videoIdx]["fmtp"] = fmtp;

        var rtcpFB = [
            { "payload": payload, "type": "transport-cc", "subtype": null },
            { "payload": payload, "type": "ccm", "subtype": "fir" },
            { "payload": payload, "type": "nack", "subtype": null },
            { "payload": payload, "type": "nack", "subtype": "pli" }
        ];
        session['media'][videoIdx]["rtcpFb"] = rtcpFB;

        let tmp = desc;
        tmp.sdp = sdpTransform.write(session);
        return tmp;
    }

    async _createSender(stream, codec) {
        console.log('create sender => %s', codec);
        let pc = new RTCPeerConnection({ iceServers: [{ urls: ices }] });
        pc.sendOffer = false;
        pc.addStream(stream);
        let offer = await
            pc.createOffer({ offerToReceiveVideo: false, offerToReceiveAudio: false });
        let desc = this._payloadModify(offer, codec);
        pc.setLocalDescription(desc);
        return pc;
    }

    async _createReceiver(uid) {
        console.log('create receiver => %s', uid);
        let pc = new RTCPeerConnection({ iceServers: [{ urls: ices }] });
        pc.sendOffer = false;
        pc.addTransceiver('audio', { 'direction': 'recvonly' });
        pc.addTransceiver('video', { 'direction': 'recvonly' });
        let desc = await pc.createOffer();
        pc.setLocalDescription(desc);
        this._pcs[uid] = pc;
        return pc;
    }

    _removePC(id) {
        let pc = this._pcs[id];
        if (pc) {
            console.log('remove pc mid => %s', id);
            pc.close();
            delete this._pcs[id];
        }
    }

    _getProtooUrl(pid) {
        // const hostname = window.location.hostname;
        let url = `ws://${this._hostname}:${this._port}/ws?peer=${pid}`;
        return url;
    }

    _handleRequest(request, accept, reject) {
        console.log('Handle request from server: [method:%s, data:%o]', request.method, request.data);
    }

    _handleNotification(notification) {
        const { method, data } = notification;
        console.log('Handle notification from server: [method:%s, data:%o]', method, data);
        switch (method) {
            case 'peer-join':
                {
                    const { rid, uid, bizid } = data;
                    console.log('peer-join peer rid => %s, uid => %s, bizid => %o', rid, uid, bizid);
                    this.emit('peer-join', rid, uid, bizid);
                    break;
                }
            case 'peer-leave':
                {
                    const { rid, uid } = data;
                    console.log('peer-leave peer rid => %s, uid => %s', rid, uid);
                    this.emit('peer-leave', rid, uid);
                    break;
                }
            case 'stream-add':
                {
                    const { rid, uid,mid,sfuid, minfo } = data;
                    console.log('stream-add peer rid => %s, mid => %s', rid, mid);
                    this.emit('stream-add', rid,uid,mid,sfuid, minfo);
                    break;
                }
            case 'stream-remove':
                {
                    const { rid, mid } = data;
                    console.log('stream-remove peer rid => %s, mid => %s', rid, mid);
                    this.emit('stream-remove', rid, mid);
                    this._removePC(mid);
                    break;
                }
			case 'broadcast':
				{
					const { rid, uid, data } = data;
					console.log('stream-remove peer rid => %s, uid => %s', rid, uid);
					break;
				}
        }
    }
}
