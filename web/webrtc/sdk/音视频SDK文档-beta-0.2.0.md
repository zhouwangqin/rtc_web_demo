## 音视频WEB SDK文档 beta-0.2

sdk使用websock和音视频服务器进行通信

sdk 导出了两个类

Client 客户端

Stream 流对象，包含MediaStream流信息和Video 元素，方便渲染

Utils工具模块 包含 getMediaDevices函数

Enum 枚举

#### 音视频相关名称
uid = 用户id
rid = 房间id
mid = 用户发布的流id
sid = 用户订阅流的id
bizid = 用户所在biz服务器id
sfuid = 用户流所在sfu服务器id

#### SDK 时序图

<img src="音视频SDK文档 beta 0.1.assets/image2022-10-14_14-14-37-16915728043472.png" alt="image2022-10-14_14-14-37"  />

#### Client 类

继承了EventEmitter

##### 公开属性

|name|类型|说明|
| ------ | ------ | -------- |
| uid | string | uid   |
| rid | string | 房间id   |

##### 构造函数

```js
// useWss 是否使用wss 默认 false
// 音视频服务器地址
// 端口 默认8443
constructor(useWSS = false,hostname = null,port = 8443){}
```

##### 方法

###### **init(uid)**
初始化 连接服务器

参数 
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| uid | string | 自己的uid   |

###### async join(roomId)
加入房间

参数:

| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| roomId | string | 房间id   |

返回值 :
正常返回 Promise.resolve:

```

 "data":{
        "pubs":[
            {
                "mid":"HUAWEI_94bf#661522",
                "minfo":{
                    "audio":true,
                    "audiotype":0,
                    "video":false,
                    "videotype":0
                },
                "rid":"100",
                "sfuid":"shenzhen_sfu_1",
                "uid":"HUAWEI_94bf"
            }
        ],
        "users":[
            {
                "bizid":"shenzhen_biz_1",
                "rid":"100",
                "uid":"HUAWEI_94bf"
            }
        ]
  }
 
```
 错误返回值:RTCError对象

| code  | name                | 说明                                             |
| ----- | ------------------- | ------------------------------------------------ |
| 10101 | JoinParamError      | 参数错误                                         |
| 10000 | ServerInternalError | SDK内部错误，查看服务错误对象serverErrorDesc打印 |



###### async leave()
离开房间

无参 

 错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10100 | NotInRoom            | 不在房间内                                       |
| 10101 | LevelRoomServerError | SDK内部错误，查看服务错误对象serverErrorDesc打印 |
| 10313 | UnSubFailedServerError | 内部错误 查看服务错误对象serverErrorDesc说明 |
| 10000 | ServerInternalError | 内部错误 查看服务错误对象serverErrorDesc说明 |

###### async setAudioPublish(isPublish, audioDeviceId = null)
是否启动音频推流

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| isPublish | bool | true 启动推流 false 取消推流   |
| audioDeviceId | string | 音频输入设备id（可选参数，不提供就使用默认的设备） |

返回值:
正常返回值 Stream 对象

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10300 | AudioStreamExistError            | 音频推流已经存在                                       |
| 10301 | AudioStreamNotExistError | 音频推流不存在 |
| 10000 | ServerInternalError | 内部错误 查看服务错误对象serverErrorDesc说明 |


###### async setVideoPublish(isPublish, videoDeviceId = null)
是否启动视频推流

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| isPublish | bool | true 启动推流 false 取消推流   |
| videoDeviceId | string | 视频输入设备id（）可选参数，不提供就使用默认的   |

返回值:
正常返回值 Stream 对象

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10302 | VideoStreamExistError            | 视频推流已经存在                                       |
| 10303 | VideoStreamNotExistError | 视频推流不存在 |
| 10000 | ServerInternalError | 内部错误 查看服务错误对象serverErrorDesc说明 |

###### async SwitchVideo(videoDeviceId = null)
切换摄像头

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| videoDeviceId | string | 要切换视频输入设备id （可选）不提供就在所有设备中找一个不同于当前的  |

返回值:
正常返回值 Stream 对象

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10200 | DeviceNotExist            | 提供的id设备不存在                                       |
| 10201 | NewDeviceNotExist            | 默认没有找到新的可用设备                                       |
| 10303 | VideoStreamNotExistError | 视频推流不存在 |
| 10000 | ServerInternalError | 内部错误 查看服务错误对象serverErrorDesc说明 |


###### setVideoPubResolutionFrame(resolution, frameRate)
设置视频推流质量（不支持动态修改，在推流前修改生效）

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| resolution | number | 分辨率枚举 请看下表，sdk有导出，在Enum模块里 |
| frameRate | number | 帧率枚举 请看下表 |

```
帧率
FrameRateEnum = {
	FRAME_RATE_ENUM_5: 0,
	FRAME_RATE_ENUM_10: 1,
	FRAME_RATE_ENUM_15: 2,
	FRAME_RATE_ENUM_20: 3,
	FRAME_RATE_ENUM_25: 4,
	FRAME_RATE_ENUM_30: 5,
	FRAME_RATE_ENUM_NORMAL: 2,
}
// 设置本地视频质量
// 0 -- 120p    160*120*15     100Kbps
// 1 -- 240p    320*240*15     200Kbps
// 2 -- 360p    480*360*15     350kbps
// 3 -- 480p    640*480*15     500kbps
// 4 -- 540p    960*540*15     1Mbps
// 5 -- 720p    1280*720*15    1.5Mbps
// 6 -- 1080p   1920*1080*15   2Mbps
VideoResolutionEnum = {
	VIDEO_RESOLUTION_ENUM_120P: 0,
	VIDEO_RESOLUTION_ENUM_240P: 1,
	VIDEO_RESOLUTION_ENUM_360P: 2,
	VIDEO_RESOLUTION_ENUM_480P: 3,
	VIDEO_RESOLUTION_ENUM_540P: 4,
	VIDEO_RESOLUTION_ENUM_720P: 5,
	VIDEO_RESOLUTION_ENUM_1080P: 6,
	VIDEO_RESOLUTION_ENUM_NORMAL: 6,
}
```
无返回值


###### async setScreenPublish(isPublish)
是否启动屏幕推流

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| isPublish | bool | true 启动推流 false 取消推流   |

返回值:
正常返回值 Stream 对象

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10304 | ScreenStreamExistError            | 屏幕流已经存在                                       |
| 10305 | ScreenStreamNotExistError            | 屏幕流不存在                                       |
| 10000 | ServerInternalError | 内部错误 查看服务错误对象serverErrorDesc说明 |


**setScreenPubFrame(frameRate)**
设置屏幕推流帧率（不支持动态修改，在推流前修改生效）

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| frameRate | number | 帧率枚举见上方视频帧率 |
无返回值


###### async setAudioSub(uid)
拉取某人音频流

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| uid | string | 要拉取的用户id   |

返回值:
正常返回值 Stream 对象

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10005 | UidParamError            | uid参数错误                                       |
| 10100| NotInRoom            | 还没进入房间                                      |
| 10310| UidNotStream            | 用户流不存在                                       |
| 10312 | SubFailedServerError | 内部错误 查看服务错误对象serverErrorDesc说明 |


###### async setAudioUnSub(uid)
取消某人音频流

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| uid | string | 要取消的用户id   |

返回值:
正常返回值 undefined

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10005 | UidParamError            | uid参数错误                                       |
| 10100| NotInRoom            | 还没进入房间                                      |
| 10311| UidNotSubStream            | 没有拉取此用户的流                                     |
| 10313 | UnSubFailedServerError | 内部错误 查看服务错误对象serverErrorDesc说明 |


###### async setVideoSub(uid)
拉取某人视频流

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| uid | string | 要拉取的用户id   |

返回值:
正常返回值 Stream 对象

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10005 | UidParamError            | uid参数错误                                       |
| 10100| NotInRoom            | 还没进入房间                                      |
| 10310| UidNotStream            | 用户流不存在                                       |
| 10312 | SubFailedServerError | 内部错误 查看服务错误对象serverErrorDesc说明 |


###### async setVideoUnSub(uid)
取消某人视频流

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| uid | string | 要取消的用户id   |

返回值:
正常返回值 undefined

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10005 | UidParamError            | uid参数错误                                       |
| 10100| NotInRoom            | 还没进入房间                                      |
| 10311| UidNotSubStream            | 没有拉取此用户的流                                     |
| 10313 | UnSubFailedServerError | 内部错误 查看服务错误对象serverErrorDesc说明 |


###### async setScreenSub(uid)
拉取某人屏幕流

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| uid | string | 要拉取的用户id   |

返回值:
正常返回值 Stream 对象

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10005 | UidParamError            | uid参数错误                                       |
| 10100| NotInRoom            | 还没进入房间                                      |
| 10310| UidNotStream            | 用户流不存在                                       |
| 10312 | SubFailedServerError | 内部错误 查看服务错误对象serverErrorDesc说明 |


###### async setScreenUnSub(uid)
取消某人屏幕共享流

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| uid | string | 要取消的用户id   |

返回值:
正常返回值 undefined

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10005 | UidParamError            | uid参数错误                                       |
| 10100| NotInRoom            | 还没进入房间                                      |
| 10311| UidNotSubStream            | 没有拉取此用户的流                                     |
| 10313 | UnSubFailedServerError | 内部错误 查看服务错误对象serverErrorDesc说明 |


###### async broadcast(data)
发送房间内广播

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| data | string | 广播内容  |

返回值:
正常返回值 undefined

错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10100 | NotInRoom            | 还没进入房间                                      |
| 10314 | BroadcastFailedServerError | 内部错误 查看服务错误对象serverErrorDesc说明 |

###### async close()
关闭客户端

无参 
正常返回值 undefined
错误返回值:RTCError对象

| code  | name                 | 说明                                             |
| ----- | -------------------- | ------------------------------------------------ |
| 10100 | NotInRoom            | 不在房间内                                       |
| 10101 | LevelRoomServerError | SDK内部错误，查看服务错误对象serverErrorDesc打印 |
| 10313 | UnSubFailedServerError | 内部错误 查看服务错误对象serverErrorDesc说明 |
| 10000 | ServerInternalError | 内部错误 查看服务错误对象serverErrorDesc说明 |

##### 外部监听事件

`on('open', fn())` 

连接打开

`on('failed', fn()) `

与服务器的连接失败(由于网络错误、未运行服务器、无法访问服务器地址等）。

`on('transport-failed', fn()) `

已建立的连接突然关闭

`on('transport-closed', fn()) `

连接关闭

`on('peer-join',fn(rid, uid, bizid))`

有人加入房间

`on('peer-leave', fn(rid, uid)`

有人离开房间

`on('stream-add', fn(rid,uid,mid,sfuid, minfo))`

有人发布流

`on('stream-remove', fn(rid,uid, mid))`

有人取消发布流

`on('broadcast',fn( rid, uid, data ))`

有人发广播


#### Stream 类
继承EventEmitter
包含视频流信息和流id

###### 公开属性
|name|类型|说明|
| ------ | ------ | -------- |
| mid | string | 流id   |
| stream | MediaStream | MediaStream对象，可以使用这个对象，自己渲染video |
| uid | string | 用户id   |
| minfo | object| 流的信息，  // 视频： 0-摄像头 1-屏幕共享 2-其他流 音频： 0-代表mic，1-其他流比如文件流{audio:true, video:true, audiotype:0, videotype:0 } |
| streamDirection | number | 流方向 1 发送 2 接收  |

##### 方法

###### render(elementId)
将流通过video 标签渲染到提供的元素下
（更推荐拿到流自己进行渲染）

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| elementId | string | 元素id   |

无返回值

###### stopRender()
停止渲染

无参数
无返回值


###### setMicrophoneVolume(value)
设置麦克风音量，只有当前对象是推送的音频流才有效

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| value | number |    |

###### getAudioMuteState()
设置麦克风音量，只有当前对象是推送的音频流才有效

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| value | number |    |

返回值:
| 类型   | 说明     |
| ------ | -------- |
| bool | true 静音 false 未静音   |

###### setMuteAudio(mute = false)
是否设置静音
对于本地推流来说，就是 麦克风静音
对应拉流来说，就是禁止声音，但是仍然接收数据

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| mute | bool |   true 静音 false 取消静音   |

返回值:
| 类型   | 说明     |
| ------ | -------- |
| bool | true 设置成功，没有音频流时设置也会失败   |

###### setMuteVideo(mute = false)
是否设置禁止采集视频
对于本地推流来说，就是禁止视频采集
对应拉流来说，就是禁止视频黑屏，但是仍然接收数据

参数
| 参数   | 类型   | 说明     |
| ------ | ------ | -------- |
| mute | bool |   true 禁止 false 取消禁止   |

返回值:
| 类型   | 说明     |
| ------ | -------- |
| bool | true 设置成功，没有视频流时设置也会失败   |

#### Utils
##### 导出函数
###### getMediaDevices()
获取设备的音频输入输出和视频设备信息

无参数
返回值:
| 类型   | 说明     |
| ------ | -------- |
| object | { videoDevices:[], audioDevices:[], audioOutputDevices:[] } 获取设备的音频输入输出和视频设备信息 |

###### getBrowerDetail()
获取浏览器信息

无参数
返回值:
| 类型   | 说明     |
| ------ | -------- |
| object | {version,browser } 获取浏览器信息 |

###### checkSupportWebRtc()
检测浏览器是否支持webtrc

无参数
返回值:
| 类型   | 说明     |
| ------ | -------- |
| bool | true 支持（有可能为true依然不支持，说明浏览器对webrtc的支持不是完全的） false 不支持 |

#### Enum
##### 导出枚举
```
帧率
FrameRateEnum = {
	FRAME_RATE_ENUM_5: 0,
	FRAME_RATE_ENUM_10: 1,
	FRAME_RATE_ENUM_15: 2,
	FRAME_RATE_ENUM_20: 3,
	FRAME_RATE_ENUM_25: 4,
	FRAME_RATE_ENUM_30: 5,
	FRAME_RATE_ENUM_NORMAL: 2,
}

// 设置本地视频质量
// 0 -- 120p    160*120*15     100Kbps
// 1 -- 240p    320*240*15     200Kbps
// 2 -- 360p    480*360*15     350kbps
// 3 -- 480p    640*480*15     500kbps
// 4 -- 540p    960*540*15     1Mbps
// 5 -- 720p    1280*720*15    1.5Mbps
// 6 -- 1080p   1920*1080*15   2Mbps
VideoResolutionEnum = {
	VIDEO_RESOLUTION_ENUM_120P: 0,
	VIDEO_RESOLUTION_ENUM_240P: 1,
	VIDEO_RESOLUTION_ENUM_360P: 2,
	VIDEO_RESOLUTION_ENUM_480P: 3,
	VIDEO_RESOLUTION_ENUM_540P: 4,
	VIDEO_RESOLUTION_ENUM_720P: 5,
	VIDEO_RESOLUTION_ENUM_1080P: 6,
	VIDEO_RESOLUTION_ENUM_NORMAL: 6,
}
```

#### 说明
SDK有不完善的地方，后期会逐步完善，有新的建议或者新的需求请及时联系我们。:smile: