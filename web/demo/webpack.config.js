const webpack = require('webpack');
const copyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  devtool: 'cheap-module-eval-source-map',
  entry: './src/index.jsx',
  devtool: 'source-map',//eval | source-map
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      }, {
        test: /\.(scss|less|css)$/,
        use: ['style-loader', 'css-loader', 'sass-loader']
      },
    ]
  },
  resolve: {
    extensions: ['*', '.js', '.jsx']
  },
  output: {
    path: __dirname + '/dist',
    publicPath: '/',
    filename: 'ion-conference.js'
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
  ],
  devServer: {
    contentBase: './dist',
    hot: true,
    // host: '10.99.155.45',
	proxy: {
	// '/ws**': {
    //     target: 'ws://81.69.253.187:8443',
    //     ws: true,
    //     secure: false,
	// 	// changeOrigin: true,
    //     logLevel: 'debug',
	// 	// pathRewrite: {
	// 	// 	'^/ws': '/w' // 把二级目录变成一级目录
	// 	//   }
    //   },
  }
}
};
