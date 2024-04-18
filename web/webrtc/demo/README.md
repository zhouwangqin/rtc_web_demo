# ion-sdk

#### 安装依赖
npm install

#### 运行开发版
npm run start

#### 编译
npm run build

#### 带有log输出的sdk
sdk目录下 有两份ion-sdk
ion-sdk.js 正常版本
ion-sdk_log.js 带有log的版本
可以根据需要更换使用

#### NOTE
1、自己的开发环境可以不使用https，同时不使用wss，但是需要配置浏览器安全策略，否则浏览器不允许使用摄像头

2、如果需要使用https，需要解决https证书问题。可以自签证书，也可以使用权威签名证书。可以使用nginx 代理WSS

3、demo项目非常仓促，只是验证了技术方案。仅提供参考