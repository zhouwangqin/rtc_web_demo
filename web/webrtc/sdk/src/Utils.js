import adapter from 'webrtc-adapter';
const ices = 'stun:stun.stunprotocol.org:3478';

export function getBrowerDetail(){
	console.log("######## webrtc detect browers: " + JSON.stringify(adapter.browserDetails))
	return adapter.browserDetails;
}

export function checkSupportWebRtc(){
	try {
		if (window.RTCPeerConnection) {
		  new RTCPeerConnection({ iceServers: [{ urls: ices }] });
		  return true;
		} else {
		  throw "当前浏览器不支持该功能";
		}
	  } catch (error) {
		console.error("browser not support webrtc" + error)
		return false;
	  }
}

export function getMediaDevices() {
	return new Promise((pResolve, pReject) => {
		let videoDevices = [];
		let audioDevices = [];
		let audioOutputDevices = [];
		navigator.mediaDevices.enumerateDevices()
			.then((devices) => {
				for (let device of devices) {
					if (device.kind === 'videoinput') {
						videoDevices.push(device);
					} else if (device.kind === 'audioinput') {
						audioDevices.push(device);
					} else if (device.kind === 'audiooutput') {
						audioOutputDevices.push(device);
					}
				}
			}).then(() => {
				let data = { videoDevices, audioDevices, audioOutputDevices };
				pResolve(data);
			});
	});
}