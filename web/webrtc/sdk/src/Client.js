import { EventEmitter } from 'events';
import protooClient from 'protoo-client';
import uuidv4 from 'uuid/v4';
import Stream from './Stream';
import * as sdpTransform from 'sdp-transform';
import adapter from 'webrtc-adapter';
import { getMediaDevices } from './Utils';
import { VideoResolutionEnum, FrameRateEnum } from './Enum';
import { RTCError } from './RTCError'
const ices = 'stun:stun.stunprotocol.org:3478';

const DefaultPayloadTypePCMU = 0;
const DefaultPayloadTypePCMA = 8;
const DefaultPayloadTypeG722 = 9;
const DefaultPayloadTypeOpus = 111;
const DefaultPayloadTypeVP8 = 96;
const DefaultPayloadTypeVP9 = 98;
const DefaultPayloadTypeH264 = 102;

// 推流类型
const PublishStreamType = {
	Audio: 1,
	Video: 2,
	Screen: 3,
}

console.log("######## webrtc detect browers: " + JSON.stringify(adapter.browserDetails))

export default class Client extends EventEmitter {

	constructor(useWSS = false, hostname = null, port = 8443) {
		super();
		if (hostname == null) {
			this._hostname = window.location.hostname
		}
		this._useWSS = useWSS;
		this._hostname = hostname;
		this._port = port;

		this._uid = 0;
		this._pcs = new Map();
		// 存储接收的流
		this._streams = new Map();
		// 存储推送的流
		this._publishStreams = new Map();
		// 可用的订阅流信息 
		this._ableSubStreamInfo = new Map();
		// 当前房间id
		this._rid = null;

		this.keepaliveTimer = null;

		// 是否忽略取消推流、取消订阅、离开房间、心跳的请求报错
		this._isIgnoreCancelError = false;

		this._videoResolution = VideoResolutionEnum.VIDEO_RESOLUTION_ENUM_NORMAL;
		this._videoFrameRate = FrameRateEnum.FRAME_RATE_ENUM_NORMAL;
		this._screenFrameRate = FrameRateEnum.FRAME_RATE_ENUM_NORMAL;
	}

	get uid() {
		return this._uid;
	}

	get rid() {
		return this._rid;
	}

	/**
	 * @param {boolean} isIgnoreCancelError
	 */
	set isIgnoreCancelError(isIgnoreCancelError) {
		this._isIgnoreCancelError = isIgnoreCancelError;
	}

	init(uid) {
		this._uid = uid
		this._url = this._getProtooUrl(this._uid);
		console.log('Peer "init" - url:' + this._url);
		console.log("adapter.browserDetails.browser:" + adapter.browserDetails.browser);

		let transport = new protooClient.WebSocketTransport(this._url, {
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
			this.emit('failed');
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

	// jion room
	async join(roomId) {
		if (!roomId) {
			return Promise.reject(new RTCError(10101, "JoinParamError"))
		}
		try {
			let data = await this._protoo.request('join', { 'rid': roomId });
			console.log('join success: result => ' + JSON.stringify(data));
			this._rid = roomId;
			data.pubs.forEach(ableStreamInfo => {
				this._ableSubStreamInfo.set(ableStreamInfo.mid, ableStreamInfo)
			})
			if (this.keepaliveTimer) {
				clearInterval(this.keepaliveTimer);
			}
			this.keepaliveTimer = setInterval(() => {
				this._keepalive();
			}, 20 * 1000)
			return data
		} catch (error) {
			console.log('join reject: error =>' + error);
			return Promise.reject(new RTCError(10000, "ServerInternalError", error));
		}
	}

	async leave() {
		if (!this._rid) {
			return Promise.reject(new RTCError(10100, "NotInRoom"))
		}
		try {
			// 离开房间清理
			for (let stream of this._publishStreams.values()) {
				await this.unpublish(stream.mid)
			}
			for (let stream of this._streams.values()) {
				await this.unsubscribe(stream.mid)
			}
			if (this.keepaliveTimer) {
				clearInterval(this.keepaliveTimer);
				this.keepaliveTimer = null;
			}
			let data = await this._protoo.request('leave', { 'rid': this._rid });
			console.log('leave success: result => ' + JSON.stringify(data));
		} catch (error) {
			console.log('leave reject: error =>' + error);
			if (!this._isIgnoreCancelError) {
				return Promise.reject(new RTCError(10101, "LevelRoomServerError", error));
			}
		} finally {
			this._rid = null
		}
	}

	// ----------set option
	// 是否启动音频推流
	async setAudioPublish(isPublish, audioDeviceId = null) {
		if (isPublish) {
			if (this._publishStreams.has(PublishStreamType.Audio)) {
				return Promise.reject(new RTCError(10300, "AudioStreamExistError"));
			}
			return await this.publish({ audio: true, audioDeviceId });
		} else {
			if (!this._publishStreams.has(PublishStreamType.Audio)) {
				return Promise.reject(new RTCError(10301, "AudioStreamNotExistError"));
			}
			const stream = this._publishStreams.get(PublishStreamType.Audio);
			this._publishStreams.delete(PublishStreamType.Audio);
			return await this.unpublish(stream.mid);
		}
	}
	// 
	//---- 视频接口
	// 是否启动视频推流
	async setVideoPublish(isPublish, videoDeviceId = null) {
		if (isPublish) {
			if (this._publishStreams.has(PublishStreamType.Video)) {
				return Promise.reject(new RTCError(10302, "VideoStreamExistError"));
			}
			return await this.publish({ video: true, resolution: this._videoResolution, frameRate: this._videoFrameRate, videoDeviceId });
		} else {
			if (!this._publishStreams.has(PublishStreamType.Video)) {
				return Promise.reject(new RTCError(10303, "VideoStreamNotExistError"));
			}
			let stream = this._publishStreams.get(PublishStreamType.Video);
			this._publishStreams.delete(PublishStreamType.Video);
			return await this.unpublish(stream.mid);
		}
	}

	// 切换摄像头
	async SwitchVideo(videoDeviceId = null) {
		if (!this._publishStreams.has(PublishStreamType.Video)) {
			return Promise.reject(new RTCError(10303, "VideoStreamNotExistError"));
		}
		const deviceData = await getMediaDevices();
		var newDevice = null;
		if (videoDeviceId != null) {
			newDevice = deviceData.videoDevices.find(device => device.deviceId == videoDeviceId)
			if (!newDevice) {
				return Promise.reject(new RTCError(10200, "DeviceNotExist"));
			}
		} else {
			newDevice = deviceData.videoDevices.find(device => device.deviceId != this._publishStreams.get(PublishStreamType.Video)._videoDeviceId)
			if (!newDevice) {
				return Promise.reject(new RTCError(10201, "NewDeviceNotExist"));
			}
		}
		if (newDevice) {
			console.log("old videoDeviceId: " + this._publishStreams.get(PublishStreamType.Video)._videoDeviceId + "new: " + newDevice.deviceId)
			let stream = this._publishStreams.get(PublishStreamType.Video);
			let elementId = stream.getRenderParentElementId();
			if (elementId) {
				stream.stop()
			}
			await this.unpublish(stream.mid);
			this._publishStreams.delete(PublishStreamType.Video);
			let newStream = await this.publish({ video: true, resolution: this._videoResolution, frameRate: this._videoFrameRate, videoDeviceId: newDevice.deviceId });
			if (elementId) {
				newStream.render(elementId)
			}
			return newStream
		}
	}

	// 设置视频推流质量
	setVideoPubResolutionFrame(resolution, frameRate) {
		if (VideoResolutionEnum[resolution]) {
			this._videoResolution = VideoResolutionEnum[resolution];
		}
		if (FrameRateEnum[frameRate]) {
			this._videoFrameRate = FrameRateEnum[frameRate];
		}
	}

	// 是否启动屏幕推流
	async setScreenPublish(isPublish) {
		if (isPublish) {
			if (this._publishStreams.has(PublishStreamType.Screen)) {
				return Promise.reject(new RTCError(10304, "ScreenStreamExistError"));
			}
			return await this.publish({ screen: true, frameRate: this._screenFrameRate });
		} else {
			if (!this._publishStreams.has(PublishStreamType.Screen)) {
				return Promise.reject(new RTCError(10305, "ScreenStreamNotExistError"));
			}
			let stream = this._publishStreams.get(PublishStreamType.Screen);
			this._publishStreams.delete(PublishStreamType.Screen);
			return await this.unpublish(stream.mid);
		}
	}

	// 设置屏幕推流帧率
	setScreenPubFrame(frameRate) {
		if (FrameRateEnum[frameRate]) {
			this._screenFrameRate = FrameRateEnum[frameRate];
		}
	}

	// 拉取某人音频流
	async setAudioSub(uid) {
		if (!uid) {
			return Promise.reject(new RTCError(10005, "UidParamError"))
		}
		let mid = null
		for (const [key, value] of this._ableSubStreamInfo) {
			if (value.uid == uid && value.minfo.audio) {
				mid = key;
				break;
			}
		}
		if (mid) {
			return await this.subscribe(mid, uid);
		} else {
			return Promise.reject(new RTCError(10310, "UidNotStream"))
		}
	}
	// 取消某人音频流
	async setAudioUnSub(uid) {
		if (!uid) {
			return Promise.reject(new RTCError(10005, "UidParamError"))
		}
		let mid = null
		for (const value of this._streams.values()) {
			if (value.uid == uid && value.stream.getAudioTracks()) {
				mid = value.mid;
				break;
			}
		}
		if (mid) {
			return await this.unsubscribe(mid);
		} else {
			return Promise.reject(new RTCError(10311, "UidNotSubStream"))
		}
	}

	// 拉取某人视频流
	async setVideoSub(uid) {
		if (!uid) {
			return Promise.reject(new RTCError(10005, "UidParamError"))
		}
		let mid = null
		for (const [key, value] of this._ableSubStreamInfo) {
			if (value.uid == uid && value.minfo.video && value.minfo.videotype == 0) {
				mid = key;
				break;
			}
		}
		if (mid) {
			return await this.subscribe(mid, uid);
		} else {
			return Promise.reject(new RTCError(10310, "UidNotStream"))
		}
	}
	// 取消某人视频流
	async setVideoUnSub(uid) {
		if (!uid) {
			return Promise.reject(new RTCError(10005, "UidParamError"))
		}
		let mid = null
		for (const value of this._streams.values()) {
			if (value.uid == uid && value.minfo.video && value.minfo.videotype == 0) {
				mid = value.mid;
				break;
			}
		}
		if (mid) {
			return await this.unsubscribe(mid);
		} else {
			return Promise.reject(new RTCError(10311, "UidNotSubStream"))
		}
	}

	// 拉取某人屏幕流
	async setScreenSub(uid) {
		if (!uid) {
			return Promise.reject(new RTCError(10005, "UidParamError"))
		}
		let mid = null
		for (const [key, value] of this._ableSubStreamInfo) {
			if (value.uid == uid && value.minfo.video && value.minfo.videotype == 1) {
				mid = key;
				break;
			}
		}
		if (mid) {
			return await this.subscribe(mid, uid);
		} else {
			return Promise.reject(new RTCError(10310, "UidNotStream"))
		}
	}
	// 取消某人屏幕共享流
	async setScreenUnSub(uid) {
		if (!uid) {
			return Promise.reject(new RTCError(10005, "UidParamError"))
		}
		let mid = null
		for (const value of this._streams.values()) {
			if (value.uid == uid && value.minfo.video && value.minfo.videotype == 1) {
				mid = value.mid;
				break;
			}
		}
		if (mid) {
			return await this.unsubscribe(mid);
		} else {
			return Promise.reject(new RTCError(10311, "UidNotSubStream"))
		}
	}

	async publish(options = { audio: false, video: false, screen: false, codec: 'h264', resolution: VideoResolutionEnum.VIDEO_RESOLUTION_ENUM_NORMAL, frameRate: FrameRateEnum.FRAME_RATE_ENUM_NORMAL, audioDeviceId: null, videoDeviceId: null }) {
		console.log('publish options => %o', options);
		var promise = new Promise(async (resolve, reject) => {
			let pc = null;
			try {
				let stream = new Stream();
				stream.uid = this._uid;
				await stream.init(true, { audio: options.audio, video: options.video, screen: options.screen, resolution: options.resolution, frameRate: options.frameRate, videoDeviceId: options.videoDeviceId, audioDeviceId: options.audioDeviceId });
				pc = await this._createSender(stream.stream, options.codec);

				pc.onicecandidate = async (e) => {
					if (!pc.sendOffer) {
						var offer = pc.localDescription;
						console.log('Send offer sdp => ' + offer.sdp);
						pc.sendOffer = true

						let audioOption = {}
						if (options.audio) {
							audioOption["audio"] = true;
							audioOption["audiotype"] = 0;
						}
						let videoOption = {}
						if (options.video) {
							videoOption["video"] = true;
							videoOption["videotype"] = 0;
						} else if (options.screen) {
							videoOption["video"] = true;
							videoOption["videotype"] = 1;
						}

						let result = await this._protoo.request('publish', {
							rid: this._rid, jsep: offer, "minfo": {
								// "audio": options.audio,
								// "video": options.video,
								// "audiotype": 0,
								// "videotype": options.screen?,
								...audioOption,
								...videoOption
							}
						});
						await pc.setRemoteDescription(result.jsep);
						console.log('publish success => ' + JSON.stringify(result));
						stream.mid = result.mid;
						stream.sfuid = result.sfuid;
						stream.minfo = {
							...audioOption,
							...videoOption
						}
						this._pcs.set(stream.mid, pc);
						if (options.audio) {
							this._publishStreams.set(PublishStreamType.Audio, stream);
						} else if (options.video) {
							this._publishStreams.set(PublishStreamType.Video, stream);
						} else if (options.screen) {
							this._publishStreams.set(PublishStreamType.Screen, stream);
						} else {
							console.log("imposibile")
						}
						resolve(stream);
					}
				}
			} catch (error) {
				console.log('publish request error  => ' + error);
				if (pc) {
					pc.close();
				}
				reject(new RTCError(10000, "ServerInternalError", error));
			}
		});
		return promise;
	}

	async unpublish(mid) {
		console.log('unpublish rid => %s, mid => %s', this._rid, mid);
		let streamType = null;
		for (const [key, value] of this._publishStreams) {
			if (value.mid == mid) {
				streamType = key
				break;
			}
		}
		if (!streamType) return;
		let sfuid = this._publishStreams.get(streamType).sfuid;
		this._removePC(mid);
		try {
			let data = await this._protoo.request('unpublish', { rid: this._rid, mid, sfuid: sfuid });
			console.log('unpublish success: result => ' + JSON.stringify(data));
		} catch (error) {
			console.log('unpublish reject: error =>' + error);
			if (!this._isIgnoreCancelError) {
				return Promise.reject(new RTCError(10000, "ServerInternalError", error));
			}
		}
	}

	async subscribe(mid, uid) {
		if (!this._rid) {
			return Promise.reject(new RTCError(10100, "NotInRoom"));
		}
		const rid = this._rid;
		console.log('subscribe rid => %s, mid => %a', rid, mid);
		var promise = new Promise(async (resolve, reject) => {
			try {
				let pc = await this._createReceiver(mid);
				pc.ontrack = (e) => {
					console.log("Stream::pc::onaddstream---" + e)
					if (this._streams.has(mid)) {
						let stream = this._streams.get(mid).stream
						stream.addTrack(e.track)
					}
					if (this._streams.get(mid).stream.getTracks().length == 1) {
						this._ableSubStreamInfo.delete(mid);
						resolve(this._streams.get(mid));
					}
				}
				pc.onaddstream = (e) => {
					// console.log("Stream::pc::onaddstream---" + e)
					var stream = e.stream;
					console.log('Stream::pc::onaddstream', stream.id);
				}
				pc.onremovestream = (e) => {
					var stream = e.stream;
					console.log('Stream::pc::onremovestream', stream.id);
				}
				pc.onicecandidate = async (e) => {
					if (!pc.sendOffer) {
						var jsep = pc.localDescription;
						// console.log('Send offer rid:'+rid+' mid: '+mid+'   sdp => ' + jsep.sdp);
						pc.sendOffer = true
						let retry = 0
						let subscribeCb = async () => {
							try {
								console.log('subscribe request time:' + new Date().getTime() + ' retry: ' + retry);
								let result = await this._protoo.request('subscribe', { rid, jsep, mid });

								const minfo = this._ableSubStreamInfo.get(mid).minfo
								const stream = new MediaStream();
								const newStream = new Stream(mid, stream)
								newStream.sfuid = result.sfuid
								newStream.sid = result.sid
								newStream.uid = uid;
								newStream.minfo = minfo;
								this._streams.set(mid, newStream);
								console.log('subscribe success => result(' + mid + ') sid: ' + result.sid + ' sdp => ' + result.jsep.sdp);
								await pc.setRemoteDescription(result.jsep);
							} catch (error) {
								console.log('subscribe request error  => ' + error);
								retry++;
								if (retry < 10) {
									setTimeout(subscribeCb, 1000)
								} else {
									this._streams.delete(mid)
									reject(new RTCError(10312, "SubFailedServerError", error));
								}
							}
						}
						subscribeCb()
					}
				}
			} catch (error) {
				console.log('subscribe request error  => ' + error);
				this._streams.delete(mid)
				reject(new RTCError(10312, "SubFailedServerError", error));
			}
		});
		return promise;
	}

	async unsubscribe(mid) {
		console.log('unsubscribe rid => %s, mid => %s ', this._rid, mid);
		if (!this._rid) {
			return Promise.reject(new RTCError(10100, "NotInRoom"))
		}
		try {
			console.log("unsubscribe - sfuid: " + this._streams.get(mid).sfuid + "sid: " + this._streams.get(mid).sid)
			let data = await this._protoo.request('unsubscribe', { rid: this._rid, mid, sid: this._streams.get(mid).sid, sfuid: this._streams.get(mid).sfuid });
			console.log('unsubscribe success: result => ' + JSON.stringify(data));
		} catch (error) {
			console.log('unsubscribe reject: error =>' + error);
			if (!this._isIgnoreCancelError) {
				return Promise.reject(new RTCError(10313, "UnSubFailedServerError", error))
			}
		} finally {
			this._removePC(mid);
		}
	}

	async broadcast(data) {
		console.log('broadcast rid => %s, data => %s', this._rid, data);
		if (!this._rid) {
			return Promise.reject(new RTCError(10100, "NotInRoom"))
		}
		try {
			let data = await this._protoo.request('broadcast', { rid: this._rid, data });
			console.log('broadcast success: result => ' + JSON.stringify(data));
			return data;
		} catch (error) {
			console.log('broadcast reject: error =>' + error);
			return Promise.reject(new RTCError(10314, "BroadcastFailedServerError", error))
		}
	}

	async _keepalive() {
		console.log('keepalive rid => %s', this._rid);
		if (!this._rid) {
			return Promise.reject(new RTCError(10100, "NotInRoom"))
		}
		try {
			let data = await this._protoo.request('keepalive', { rid: this._rid });
			console.log('keepalive success: result => ' + JSON.stringify(data));
		} catch (error) {
			console.log('keepalive reject: error =>' + error);
			if (!this._isIgnoreCancelError) {
				return Promise.reject(new RTCError(10315, "KeepaliveServerError", error))
			}
		}
	}

	async close() {
		if (this._rid) {
			await this.leave();
			this._rid = null;
		}
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
		stream.getTracks().forEach(track => {
			pc.addTrack(track, stream)
		})
		// pc.addStream(stream);
		let offer = await
			pc.createOffer({ offerToReceiveVideo: false, offerToReceiveAudio: false });
		let desc = this._payloadModify(offer, codec);
		pc.setLocalDescription(desc);
		return pc;
	}

	async _createReceiver(mid) {
		console.log('create receiver => mid :%s', mid);
		let pc = new RTCPeerConnection({ iceServers: [{ urls: ices }] });
		pc.sendOffer = false;
		pc.addTransceiver('audio', { 'direction': 'recvonly' });
		pc.addTransceiver('video', { 'direction': 'recvonly' });
		let desc = await pc.createOffer();
		desc.sdp = this._modifyCodec(desc.sdp)
		pc.setLocalDescription(desc);
		this._pcs.set(mid, pc);
		return pc;
	}

	_modifyCodec(sdp) {
		// 为了适配服务器只支持VP8编码
		let firstCodecFlags = 'a=rtpmap:96 ';
		let beginPos = sdp.indexOf(firstCodecFlags);
		let codecBegin = beginPos + firstCodecFlags.length;
		let codecEnd = sdp.slice(codecBegin).indexOf('/') + codecBegin;
		const codecStr = sdp.slice(codecBegin, codecEnd);
		if (codecStr.toLowerCase() != 'vp8') {
			let newSdp = sdp.slice(0, codecBegin) + 'VP8' + sdp.slice(codecEnd)
			return newSdp;
		}else{
			return sdp;
		}
	}

	_removePC(mid) {
		let pc = this._pcs.get(mid);
		if (pc) {
			console.log('remove pc mid => %s', mid);
			if (this._streams.has(mid)) {
				this._streams.delete(mid);
			} else {
				let type = null;
				for (const [key, value] of this._publishStreams) {
					if (value.mid == mid) {
						type = key
						break;
					}
				}
				if (type) {
					this._publishStreams.delete(type);
					console.log("delete: mid: " + mid)
				}
			}
			pc.close();
			this._pcs.delete(mid);
		}
	}

	_getProtooUrl(pid) {
		// const hostname = window.location.hostname;
		// let url = `ws://${this._hostname}:${this._port}/ws?peer=${pid}`;
		// 81.69.253.187
		let proto = 'ws';
		if (this._useWSS) {
			proto = 'wss'
		}
		let url = `${proto}://${this._hostname}:${this._port}/ws?peer=${pid}`;
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
					const { rid, uid, mid, sfuid, minfo } = data;
					console.log('stream-add peer rid => %s, mid => %s', rid, mid);
					this._ableSubStreamInfo.set(mid, { rid, uid, mid, sfuid, minfo })
					this.emit('stream-add', rid, uid, mid, sfuid, minfo);
					break;
				}
			case 'stream-remove':
				{
					const { rid, uid, mid } = data;
					console.log('stream-remove peer rid => %s, uid =>%s ,mid => %s', rid, uid, mid);
					if (this._ableSubStreamInfo.has(mid)) {
						this._ableSubStreamInfo.delete(mid)
					}
					this.emit('stream-remove', rid, uid, mid);
					this.unsubscribe(mid)
					break;
				}
			case 'broadcast':
				{
					const { rid, uid, data } = data;
					console.log('stream-remove peer rid => %s, uid => %s', rid, uid);
					this.emit('broadcast', rid, uid, data);
					break;
				}
		}
	}
}
