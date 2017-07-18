const config = require('./webpack.config');

Object.assign(config, {
  watch: false,
});

module.exports = config;
