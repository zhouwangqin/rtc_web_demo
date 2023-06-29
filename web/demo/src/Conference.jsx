import React from "react";
import { Spin } from "antd";
import { LocalVideoView, MainVideoView, SmallVideoView } from "./videoview";


class Conference extends React.Component {
  constructor() {
    super();
    this.state = {
      streams: [],
      localStream: null,
      localScreen: null,
      audioMuted: false,
      videoMuted: false
    };
  }

  componentDidMount = () => {
    const { client } = this.props;
    client.on("stream-add", this._handleAddStream);
    client.on("stream-remove", this._handleRemoveStream);
  };

  componentWillUnmount = () => {
    const { client } = this.props;
    client.off("stream-add", this._handleAddStream);
    client.off("stream-remove", this._handleRemoveStream);
  };

  _publish = async (type,codec) => {
    const { client, settings } = this.props;
    let stream = await client.publish({
      codec: settings.codec,
      resolution: settings.resolution,
      bandwidth: settings.bandwidth,
      audio: true,
      video: type === "video",
      screen: type === "screen"
    });
    return stream;
  };

  cleanUp = () => {
    let { localStream, localScreen } = this.state;
	if (this.keepaliveTimer){
		clearTimeout(this.keepaliveTimer)
		this.keepaliveTimer = undefined
	}
    if (localStream) this._unpublish(localStream);
    if (localScreen) this._unpublish(localScreen);
    this.setState({ localStream: null, localScreen: null });
  };

  _notification = (message, description) => {
    notification.info({
      message: message,
      description: description,
      placement: 'bottomRight',
    });
  };

  _unpublish = async stream => {
    const { client } = this.props;
    if (stream) {
      this._stopMediaStream(stream.stream);
      await client.unpublish(stream.mid);
    }
  };

  _joinSuccess = async (rid,data)=>{
	const { client } = this.props;
	let streams = this.state.streams;
	let keepaliveCallback = ()=>{
		client.keepalive(rid)
		this.keepaliveTimer = setTimeout(keepaliveCallback,20*1000)
	  }
	this.keepaliveTimer = setTimeout(keepaliveCallback,20*1000)
	if (data){
		if(data.pubs && data.pubs.length > 0){
			let pubs = data.pubs
			for (let i = 0;i< pubs.length;i++){
				let stream = await client.subscribe(pubs[i].rid, pubs[i].mid);
				stream.minfo = pubs[i].minfo;
				stream.uid = pubs[i].uid;
				stream.sfuid = pubs[i].sfuid;
				streams.push({ mid: pubs[i].mid, stream });
				this.setState({ streams });
			}
		}
	}
  }

  muteMediaTrack = (type, enabled) => {
    let { localStream } = this.state;
    let tracks = localStream.stream.getTracks();
    let track = tracks.find(track => track.kind === type);
    if (track) {
      track.enabled = enabled;
    }
    if (type === "audio") {
      this.setState({ audioMuted: !enabled });
    } else if (type === "video") {
      this.setState({ videoMuted: !enabled });
    }
  };

  handleLocalStream = async enabled => {
    let { localStream } = this.state;
    try {
      if (enabled) {
        localStream = await this._publish("video");
      } else {
        if (localStream) {
          this._unpublish(localStream);
          localStream = null;
        }
      }
      this.setState({ localStream });
    } catch(e){
      console.log("handleLocalStream error => " + e);
      _notification("publish/unpublish failed!", e)
    }
  };

  handleScreenSharing = async enabled => {
    let { localScreen } = this.state;
    if (enabled) {
      localScreen = await this._publish("screen");
      let track = localScreen.stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener("ended", () => {
          this.handleScreenSharing(false);
        });
      }
    } else {
      if (localScreen) {
        this._unpublish(localScreen);
        localScreen = null;
      }
    }
    this.setState({ localScreen });
  };

  _stopMediaStream = mediaStream => {
    let tracks = mediaStream.getTracks();
    for (let i = 0, len = tracks.length; i < len; i++) {
      tracks[i].stop();
    }
  };

  _handleAddStream = async (rid,uid,mid,sfuid, minfo) => {
    const { client } = this.props;
    let streams = this.state.streams;
	let retrySub = 0
	do{
		try{
			let stream = await client.subscribe(rid, mid);
			stream.minfo = minfo;
			stream.uid = uid;
			stream._sfuid = sfuid;
			streams.push({ mid, stream });
			this.setState({ streams });
			break
		}catch(e){
			console.log("_handleAddStream error: "+ e)
			retrySub ++
		}
	}while(retrySub < 3)
  };

  _handleRemoveStream = async (rid, mid) => {
	const { client } = this.props;
    let streams = this.state.streams;
	let stream;
	for (let i = 0; i < streams.length; i++) {
		let item = streams[i];
		if (item.mid == mid) {
		  stream = item.stream;
		  break;
		}
	  }
  
	if (stream){
		console.log("_handleRemoveStream: uid" + stream.uid + "sifuid: " + stream.sfuid)
		await client.unsubscribe(rid, mid, stream._sfuid);
	}
    streams = streams.filter(item => item.mid !== mid);
    this.setState({ streams });
  };

  _onChangeVideoPosition = data => {
    let id = data.id;
    let index = data.index;
    console.log("_onChangeVideoPosition id:" + id + "  index:" + index);

    if (index == 0) {
      return;
    }

    const streams = this.state.streams;
    let first = 0;
    let big = 0;
    for (let i = 0; i < streams.length; i++) {
      let item = streams[i];
      if (item.mid == id) {
        big = i;
        break;
      }
    }

    let c = streams[first];
    streams[first] = streams[big];
    streams[big] = c;

    this.setState({ streams: streams });
  };

  render = () => {
    const { client } = this.props;
    const {
      streams,
      localStream,
      localScreen,
      audioMuted,
      videoMuted
    } = this.state;
    const id = client.uid;
    return (
      <div className="conference-layout">
        {streams.length === 0 && (
          <div className="conference-layout-wating">
            <Spin size="large" tip="Wait for other people joining ..." />
          </div>
        )}
        {streams.map((item, index) => {
          return index == 0 ? (
            <MainVideoView key={item.mid} id={item.mid} stream={item.stream} />
          ) : (
            ""
          );
        })}
        {localStream && (
          <div className="conference-local-video-layout">
            <div className="conference-local-video-size">
              <LocalVideoView
                id={id + "-video"}
                label="Local Stream"
                client={client}
                stream={localStream}
                audioMuted={audioMuted}
                videoMuted={videoMuted}
              />
            </div>
          </div>
        )}
        {localScreen && (
          <div className="conference-local-screen-layout">
            <div className="conference-local-video-size">
              <LocalVideoView
                id={id + "-screen"}
                label="Screen Sharing"
                client={client}
                stream={localScreen}
                audioMuted={false}
                videoMuted={false}
              />
            </div>
          </div>
        )}
        <div className="small-video-list-div">
          <div className="small-video-list">
          {streams.map((item, index) => {
            return index > 0 ? (
              <SmallVideoView
                key={index}
                id={item.mid}
                stream={item.stream}
                videoCount={streams.length}
                collapsed={this.props.collapsed}
                index={index}
                onClick={this._onChangeVideoPosition}
              />
            ) : (
              <div />
            );
          })}
        </div>
        </div>
        
      </div>
    );
  };
}

export default Conference;
