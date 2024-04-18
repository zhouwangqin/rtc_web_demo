
class VideoElement {
    constructor() {
		this._parentElementId = null;
		this._video = null;
    }

    play(options = { id, stream, elementId, remote: false }) {
        let video = document.createElement('video');
        video.autoplay = true;
        video.playsinline = true;
        video.controls = true;
        video.muted = !options.remote;
        video.srcObject = options.stream;
        video.id = `stream${options.id}`;
        let parentElement = document.getElementById(options.elementId);
        parentElement.appendChild(video);
        this.parentElement = parentElement;
        this._video = video;
		this._parentElementId = options.elementId
    }

	get parentElementId(){
		return this._parentElementId;
	}

    stop() {
		if(!this._video){
			return;
		}
        this._video.pause();
        this.parentElement.removeChild(this._video);
		this._parentElementId = null;
    }
}

export default VideoElement;
