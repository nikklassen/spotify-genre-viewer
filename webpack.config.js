const webpack = require('webpack');
const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './app/app.js',
  output: {
    path: path.resolve(__dirname, 'static'),
    filename: './app.dist.js'
  },
  module: {
    rules: [
    {
      exclude: [
        path.resolve(__dirname, 'node_modules'),
      ],
      test: /\.js$/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['env'],
        },
      },
    },
    {
      test: /\.scss$/,
      use: ExtractTextPlugin.extract({
        fallback: 'style-loader',
        use: ['css-loader', 'sass-loader'],
      }),
    },
    {
      test: /\.(eot|svg|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'file-loader',
    }
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      CLIENT_ID: `'${process.env.CLIENT_ID}'`,
    }),
    new HtmlWebpackPlugin({
      inject: true,
      template: path.resolve(__dirname, 'resources/index.html'),
    }),
    new ExtractTextPlugin('./app.css'),
  ],
  devServer: {
    contentBase: path.resolve(__dirname, 'static'),
  },
  watch: true,
  watchOptions: {
    poll: true,
    poll: 1000,
  },
  devtool: 'source-map',
};
