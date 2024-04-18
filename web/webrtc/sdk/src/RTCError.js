
const ErrorMessage = new Map([
	// 通用错误
	[10000, { name: "ServerInternalError", message: "Service internal error" }],
	[10005, { name: "UidParamError", message: "uid param error" }],

	// 房间相关错误
	[10100, { name: "NotInRoom", message: "User not in the room" }],
	[10101, { name: "LevelRoomServerError", message: "The Level failed and the server returned an error" }],

	// 加入房间参数错误
	[10101, { name: "JoinParamError", message: "Join room parameter error" }],

	// 本地音视频采集播放错误
	[10200, { name: "DeviceNotExist", message: "The deviceId does not exist" }],
	[10201, { name: "NewDeviceNotExist", message: "No new devices were found" }],

	// 发布和订阅错误
	[10300, { name: "AudioStreamExistError", message: "The audio push stream already exists" }],
	[10301, { name: "AudioStreamNotExistError", message: "The audio push stream not exists" }],
	[10302, { name: "VideoStreamExistError", message: "The video push stream already exists" }],
	[10303, { name: "VideoStreamNotExistError", message: "The video push stream not exists" }],
	[10304, { name: "ScreenStreamExistError", message: "The screen push stream already exists" }],
	[10305, { name: "ScreenStreamNotExistError", message: "The screen push stream not exists" }],

	[10310, { name: "UidNotStream", message: "This user has not published a stream" }],
	[10311, { name: "UidNotSubStream", message: "There is no subscription to this user's stream" }],
	[10312, { name: "SubFailedServerError", message: "The subscription failed and the server returned an error" }],
	[10313, { name: "UnSubFailedServerError", message: "The unsubscription failed and the server returned an error" }],
	[10314, { name: "BroadcastFailedServerError", message: "The broadcast failed and the server returned an error" }],
	[10315, { name: "KeepaliveServerError", message: "The Keepalive failed and the server returned an error" }],

])

export class RTCError {
	constructor(code = 0, name = "", serverError = "") {
		this.code = code;
		this.name = name;
		this.message = "";
		this.serverErrorDesc = ""
		if (ErrorMessage.has(code)) {
			this.name = ErrorMessage.get(code).name;
			this.message = ErrorMessage.get(code).message;
		}
		console.log("serverError: " + serverError)
		serverError = String(serverError)
		if (serverError.length > 0) {
			this.isServerError = true;
			this.serverErrorDesc = serverError;
		}
	}
}
  