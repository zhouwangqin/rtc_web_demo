import { EventEmitter } from 'events';
import VideoElement from './VideoElement';
import { getMediaDevices } from './Utils';
import { FrameRateEnum, VideoResolutionEnum } from './Enum';

// 设置本地视频质量
// 0 -- 120p    160*120*15     100Kbps
// 1 -- 240p    320*240*15     200Kbps
// 2 -- 360p    480*360*15     350kbps
// 3 -- 480p    640*480*15     500kbps
// 4 -- 540p    960*540*15     1Mbps
// 5 -- 720p    1280*720*15    1.5Mbps
// 6 -- 1080p   1920*1080*15   2Mbps
const VideoResolutions =
{
	0: { width: { ideal: 160 }, height: { ideal: 120 } },
	1: { width: { ideal: 320 }, height: { ideal: 240 } },
	2: { width: { ideal: 480 }, height: { ideal: 360 } },
	3: { width: { ideal: 640 }, height: { ideal: 480 } },
	4: { width: { ideal: 960 }, height: { ideal: 540 } },
	5: { width: { ideal: 1280 }, height: { ideal: 720 } },
	6: { width: { ideal: 1920 }, height: { ideal: 1080 } }
};

// 帧率
const VideoFrameRate = {
	0: { frameRate: { ideal: 5, max: 5 } },
	1: { frameRate: { ideal: 10, max: 10 } },
	2: { frameRate: { ideal: 15, max: 15 } },
	3: { frameRate: { ideal: 20, max: 20 } },
	4: { frameRate: { ideal: 25, max: 25 } },
	5: { frameRate: { ideal: 30, max: 30 } },
}

window.AudioContext = window.AudioContext || window.webkitAudioContext;

// 控制麦克风音量
class MicrophoneContext {
	constructor() {
		this._audioContext = new AudioContext()
		this._gainNode = this._audioContext.createGain();
		this._audioSource;
		this._audioDestination;
	}

	init(stream) {
		this._audioSource = this._audioContext.createMediaStreamSource(stream),
		this._audioDestination = this._audioContext.createMediaStreamDestination();
		this._audioSource.connect(this._gainNode);
		this._gainNode.connect(this._audioDestination);
	}

	changeMicrophoneLevel(value) {
		if (value && value >= 0 && value <= 5) {
			this._gainNode.gain.value = value;
		}
	}
}

// 流方向 发送 接收
const StreamDirection = {
	SEND: 1,
	RECIVE: 2
}

export default class Stream extends EventEmitter {

	constructor(mid = null, stream = null, streamDir = StreamDirection.RECIVE) {
		super();
		this._streamDirection = streamDir;
		this._uid = null;
		this._mid = mid;
		this._sfuid = null;
		this._sid = null;
		// 视频的 
		// 0-摄像头
		// 1-屏幕共享
		// 2-其他流
		// 音频
		// 0-代表mic，
		// 1-其他流比如文件流
		// {
		// 	audio:true,
		// 	video:true,
		// 	audiotype:0,
		// 	videotype:0
		// }
		this._minfo = {};
		this._stream = stream;
		this._videoElement = null;
		this._videoDeviceId = null
	}

	async init(sender = false, options = { audio: true, video: true, screen: false, resolution: VideoResolutionEnum.VIDEO_RESOLUTION_ENUM_NORMAL, frameRate: FrameRateEnum.FRAME_RATE_ENUM_NORMAL, audioDeviceId: null, videoDeviceId: null }) {
		console.log("Stream init ---- options: " + options)
		if (sender) {
			let deviceData = await getMediaDevices();
			this._streamDirection = StreamDirection.SEND;
			// then((data)=>{
			// 	if (this.state.selectedAudioDevice === "" && data.audioDevices.length > 0) {
			// 		this.state.selectedAudioDevice = data.audioDevices[0].deviceId;
			// 	}
			// 	if (this.state.selectedVideoDevice === "" && data.videoDevices.length > 0) {
			// 		this.state.selectedVideoDevice = data.videoDevices[0].deviceId;
			// 	}
			// 	this.state.videoDevices = data.videoDevices;
			// 	this.state.audioDevices = data.audioDevices;
			// 	this.state.audioOutputDevices = data.audioOutputDevices;

			// 	this.state.audioDevices.map((device, index) => {
			// 		if (this.state.selectedAudioDevice == device.deviceId) {
			// 			console.log("Selected audioDevice::" + JSON.stringify(device));
			// 		}
			// 	});
			// 	this.state.videoDevices.map((device, index) => {
			// 		if (this.state.selectedVideoDevice == device.deviceId) {
			// 			console.log("Selected videoDevice::" + JSON.stringify(device));
			// 		}
			// 	});
			// });
			if (options.screen) {
				this._stream = await navigator.mediaDevices.getDisplayMedia({ video: true, ...VideoFrameRate[options.frameRate] });
			} else if (options.audio && options.video) {
				let audioOptions = { deviceId: "" }
				if (deviceData.audioDevices.length > 0) {
					if (options.audioDeviceId != null) {
						let audioDevice = deviceData.audioDevices.find(device => device.deviceId == options.audioDeviceId);
						if (audioDevice) {
							audioOptions = { deviceId: options.audioDeviceId }
						} else {
							audioOptions = { deviceId: deviceData.audioDevices[0].deviceId }
						}
					} else {
						audioOptions = { deviceId: deviceData.audioDevices[0].deviceId }
					}
				}
				let videoOptions = { deviceId: "", ...VideoResolutions[options.resolution], ...VideoFrameRate[options.frameRate] }
				if (deviceData.videoDevices.length > 0) {
					if (options.videoDeviceId != null) {
						let videoDevice = deviceData.videoDevices.find(device => device.deviceId == options.videoDeviceId);
						if (videoDevice) {
							videoOptions.deviceId = options.videoDeviceId
						} else {
							videoOptions.deviceId = deviceData.videoDevices[0].deviceId
						}
					} else {
						videoOptions.deviceId = deviceData.videoDevices[0].deviceId
					}
				}
				this._stream = await navigator.mediaDevices.getUserMedia(
					{
						audio: audioOptions,
						video: videoOptions
					}
				);
			}
			else if (options.audio) {
				let audioOptions = { deviceId: "" }
				if (deviceData.audioDevices.length > 0) {
					if (options.audioDeviceId != null) {
						let audioDevice = deviceData.audioDevices.find(device => device.deviceId == options.audioDeviceId);
						if (audioDevice) {
							audioOptions = { deviceId: options.audioDeviceId }
						} else {
							audioOptions = { deviceId: deviceData.audioDevices[0].deviceId }
						}
					} else {
						audioOptions = { deviceId: deviceData.audioDevices[0].deviceId }
					}
				}
				console.log("Stream init ---- audioOptions: " + String(audioOptions))
				this._stream = await navigator.mediaDevices.getUserMedia(
					{
						audio: audioOptions
					}
				);
			}
			else {
				let videoOptions = { deviceId: "", ...VideoResolutions[options.resolution], ...VideoFrameRate[options.frameRate] }
				if (deviceData.videoDevices.length > 0) {
					if (options.videoDeviceId != null) {
						let videoDevice = deviceData.videoDevices.find(device => device.deviceId == options.videoDeviceId);
						if (videoDevice) {
							videoOptions.deviceId = options.videoDeviceId
						} else {
							videoOptions.deviceId = deviceData.videoDevices[0].deviceId
						}
					} else {
						videoOptions.deviceId = deviceData.videoDevices[0].deviceId
					}
					this._videoDeviceId = videoOptions.deviceId;
				}
				this._stream = await navigator.mediaDevices.getUserMedia(
					{
						video: videoOptions
					}
				);
			}
			if (options.audio) {
				this._processAudioPubStream();
			}
		}
	}

	set mid(id) { this._mid = id; }

	get mid() { return this._mid; }

	get stream() { return this._stream };

	/**
	 * @param {any} sfuid
	 */
	set sfuid(sfuid) { this._sfuid = sfuid; }

	get sfuid() { return this._sfuid; }

	set sid(sid) { this._sid = sid; }

	get sid() { return this._sid; }

	set uid(uid) { this._uid = uid; }

	get uid() { return this._uid; }

	set minfo(minfo) { this._minfo = minfo; }

	get minfo() { return this._minfo; }

	get streamDirection() { return this._streamDirection; }


	// 渲染
	render(elementId) {
		if (!this._videoElement) {
			this._videoElement = new VideoElement();
		}
		this._videoElement.play({ id: this._mid, stream: this._stream, elementId, remote: this._streamDirection == StreamDirection.RECIVE });
	}
	// 停止渲染
	stopRender() {
		this._videoElement.stop();
		this._videoElement = null
	}

	_processAudioPubStream() {
		if (!this._stream) {
			return;
		}
		this._micro = new MicrophoneContext();
		this._micro.init(this._stream);
	}

	getRenderParentElementId() {
		if (!this._videoElement) {
			return null;
		}
		return this._videoElement.parentElementId;
	}

	// 设置麦克风音量
	setMicrophoneVolume(value) {
		if (this._micro) {
			this._micro.changeMicrophoneLevel(value);
		}
	}

	// 获取音频静音状态
	getAudioMuteState() {
		let tracks = this._stream.getAudioTracks();
		tracks.forEach(track => {
			return !track.enabled;
		})
		return false;
	}

	// 是否设置静音
	// 对于本地推流来说，就是 麦克风静音
	// 对应拉流来说，就是禁止声音，但是仍然接收数据
	setMuteAudio(mute = false) {
		// let track = tracks.find(track => track.kind === "audio");
		let tracks = this._stream.getAudioTracks();
		let isSuccess = false;
		tracks.forEach(track => {
			track.enabled = !mute;
			isSuccess = true;
		})
		return isSuccess;
	}

	// 是否设置视频
	// 对于本地推流来说，就是禁止视频采集
	// 对应拉流来说，就是禁止视频，但是仍然接收数据
	setMuteVideo(mute = false) {
		// let track = tracks.find(track => track.kind === "audio");
		let tracks = this._stream.getVideoTracks();
		let isSuccess = false;
		tracks.forEach(track => {
			track.enabled = !mute;
			isSuccess = true;
		})
		return isSuccess;
	}
}