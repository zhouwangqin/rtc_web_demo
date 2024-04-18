import React from "react";
import { Spin } from "antd";
import { LocalVideoView, MainVideoView, SmallVideoView } from "./videoview";

class Conference extends React.Component {
  constructor() {
    super();
    this.state = {
      streams: [],
      localStream: null,
      localAudioStream: null,
      localScreen: null,
      audioMuted: false,
      videoMuted: false,
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

  _publish = async (type, codec) => {
    const { client, settings } = this.props;
    // let stream = await client.publish({
    //   codec: settings.codec,
    //   resolution: settings.resolution,
    //   bandwidth: settings.bandwidth,
    //   videoDeviceId: settings.selectedVideoDevice,
    //   audioDeviceId: settings.selectedAudioDevice,
    //   audio: true,
    //   video: type === "video",
    //   screen: type === "screen"
    // });
    console.log("type:-----------" + type);
    if (type == "video") {
      return await client.setVideoPublish(true);
    } else if (type == "screen") {
      return await client.setScreenPublish(true);
    } else {
      return await client.setAudioPublish(true);
    }
  };

  cleanUp = () => {
    let { localStream, localScreen } = this.state;
    if (localStream) this._unpublish(localStream);
    if (localScreen) this._unpublish(localScreen);
    this.setState({ localStream: null, localScreen: null });
  };

  _notification = (message, description) => {
    notification.info({
      message: message,
      description: description,
      placement: "bottomRight",
    });
  };

  _unpublish = async (stream, type) => {
    const { client } = this.props;
    if (stream) {
      this._stopMediaStream(stream.stream);
      const minfo = stream.minfo;
      if (minfo.audio) {
        return await client.setAudioPublish(false);
      } else if (minfo.video) {
        if (minfo.videotype == 0) {
          return await client.setVideoPublish(false);
        } else {
          return await client.setScreenPublish(false);
        }
      }
    }
  };

  _joinSuccess = async (rid, data) => {
    const { client } = this.props;
    let streams = this.state.streams;
    if (data) {
      if (data.pubs && data.pubs.length > 0) {
        let pubs = data.pubs;
        for (let i = 0; i < pubs.length; i++) {
          const minfo = pubs[i].minfo;
          if (minfo.audio) {
            let stream = await client.setAudioSub(pubs[i].uid);
            streams.push({ mid: pubs[i].mid, stream });
          } else if (minfo.video) {
            if (minfo.videotype == 0) {
              let stream = await client.setVideoSub(pubs[i].uid);
              streams.push({ mid: pubs[i].mid, stream });
            } else {
              let stream = await client.setScreenSub(pubs[i].uid);
              streams.push({ mid: pubs[i].mid, stream });
            }
          }
        }
        this.setState({ streams });
      }
    }
  };

  muteMediaTrack = (type, enabled) => {
    let { localStream } = this.state;
    let tracks = localStream.stream.getTracks();
    let track = tracks.find((track) => track.kind === type);
    if (track) {
      track.enabled = enabled;
    }
    if (type === "audio") {
      this.setState({ audioMuted: !enabled });
    } else if (type === "video") {
      this.setState({ videoMuted: !enabled });
    }
  };

  handleLocalStream = async (enabled) => {
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
    } catch (e) {
      console.log("handleLocalStream error => " + JSON.stringify(e));
    }
  };

  handleLocalAudioStream = async (enabled) => {
    let { localAudioStream } = this.state;
    try {
      if (enabled) {
        localAudioStream = await this._publish("audio");
      } else {
        if (localAudioStream) {
          this._unpublish(localAudioStream);
          localAudioStream = null;
        }
      }
      this.setState({ localAudioStream });
    } catch (e) {
      console.log("handleLocalAudioStream error => " + JSON.stringify(e));
    }
  };

  handleScreenSharing = async (enabled) => {
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

  _stopMediaStream = (mediaStream) => {
    let tracks = mediaStream.getTracks();
    for (let i = 0, len = tracks.length; i < len; i++) {
      tracks[i].stop();
    }
  };

  _handleAddStream = async (rid, uid, mid, sfuid, minfo) => {
    const { client } = this.props;
    let streams = this.state.streams;
    let retrySub = 0;
    do {
      try {
        if (minfo.audio) {
          let stream = await client.setAudioSub(uid);
          streams.push({ mid, stream });
        } else if (minfo.video) {
          if (minfo.videotype == 0) {
            let stream = await client.setVideoSub(uid);
            streams.push({ mid, stream });
          } else {
            let stream = await client.setScreenSub(uid);
            streams.push({ mid, stream });
          }
        }

        // let stream = await client.subscribe(rid, mid);
        // stream.minfo = minfo;
        // stream.uid = uid;
        // stream._sfuid = sfuid;
        // streams.push({ mid, stream });
        this.setState({ streams });
        break;
      } catch (e) {
        console.log("_handleAddStream error: " + e);
        retrySub++;
      }
    } while (retrySub < 3);
  };

  _handleRemoveStream = async (rid, uid, mid) => {
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

    if (stream) {
      console.log(
        "_handleRemoveStream: uid" + stream.uid + "sifuid: " + stream.sfuid
      );
      const minfo = stream.minfo;
      if (minfo.audio) {
        await client.setAudioUnSub(uid);
      } else if (minfo.video) {
        if (minfo.videotype == 0) {
          await client.setVideoUnSub(uid);
        } else {
          await client.setScreenUnSub(uid);
        }
      }
    }
    streams = streams.filter((item) => item.mid !== mid);
    this.setState({ streams });
  };

  _onChangeVideoPosition = (data) => {
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
  generateRandomId(length) {
    //length是你的id的长度，可自定义
    return Math.random().toString(36).substr(3, length);
  }
  render = () => {
    const { client } = this.props;
    const {
      streams,
      localStream,
      localAudioStream,
      localScreen,
      audioMuted,
      videoMuted,
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
            <MainVideoView key={index} id={item.mid} stream={item.stream} />
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
