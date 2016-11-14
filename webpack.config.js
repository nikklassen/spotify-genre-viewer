const webpack = require('webpack');
const production = process.env.NODE_ENV === 'production';

module.exports = {
  debug:   !production,
  devtool: 'source-map',
  entry: {
    app: ['./app/app.js'],
  },
  output : {
    path: './static',
    filename: 'app.dist.js'
  },
  module : {
    loaders: [
      {
        exclude: /node_modules/,
        loader : 'babel-loader',
        test   : /\.js$/,
        query: {
          presets: ['es2015']
        }
      },
      {
        test: /\.scss$/,
        loaders: ['style', 'css', 'sass'],
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
        loader: 'file'
      }
    ],
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      CLIENT_ID: `'${process.env.CLIENT_ID}'`,
    })
  ],
  devServer: {
    inline: true,
    hot: true,
  }
};
