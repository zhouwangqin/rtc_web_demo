const webpack = require('webpack');
const TerserWebpackPlugin = require("terser-webpack-plugin");
module.exports = {
  entry: './src/index.js',
  devtool: 'source-map',//eval | source-map
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      },
      {
        test: /\.(scss|less|css)$/,
        use: ["style-loader", "css-loader", "sass-loader"]
      },
    ]
  },
  resolve: {
    extensions: ['*', '.js', '.jsx']
  },
  output: {
    path: __dirname + '/dist',
    publicPath: '/',
    filename: 'ion-sdk.js',
    library: "ionSdk",
	libraryTarget: 'umd'
  },
// 打包是否关闭console.log输出
  optimization: {
	minimizer: [
		  new TerserWebpackPlugin({
			   terserOptions: {
				 compress: {
				   warnings: true,
				   drop_console: true,
				   drop_debugger: true,
				//    pure_funcs: ['console.log', "console.table"] // 删除console
				 }
			   }
		   })
	   ]
   },
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ],
  devServer: {
    contentBase: './dist',
    hot: true,
    host: "0.0.0.0",
  }
};
