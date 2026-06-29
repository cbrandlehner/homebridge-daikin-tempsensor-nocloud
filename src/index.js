let Service;
let Characteristic;
const https = require('node:https');
const http = require('node:http');
const crypto = require('node:crypto');
const process = require('node:process');
const superagent = require('superagent');
const packageFile = require('../package.json');
const Cache = require('./cache.js');
const Queue = require('./queue.js');
const parseResponse = require('./parse-response.js');

const SECURE_OPS
  = ((crypto.constants && crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION) || 0)
    | ((crypto.constants && crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT) || 0);

function isOpenSSL3() {
  return (process.versions.openssl || '').startsWith('3.');
}

let LEGACY_AGENT = null;
let DEFAULT_AGENT = null;
let DEFAULT_HTTP_AGENT = null;

function getLegacyAgent() {
  if (!LEGACY_AGENT) {
    LEGACY_AGENT = new https.Agent({
      keepAlive: true,
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.2',
      secureOptions: SECURE_OPS,
    });
  }

  return LEGACY_AGENT;
}

function getDefaultAgent() {
  if (!DEFAULT_AGENT) {
    DEFAULT_AGENT = new https.Agent({
      keepAlive: true,
      rejectUnauthorized: false,
    });
  }

  return DEFAULT_AGENT;
}

function getDefaultHttpAgent() {
  if (!DEFAULT_HTTP_AGENT) {
    DEFAULT_HTTP_AGENT = new http.Agent({
      keepAlive: true,
    });
  }

  return DEFAULT_HTTP_AGENT;
}

function Daikin(log, config) {
  this.log = log;
  this.cache = new Cache();
  this.queue = new Queue();

  if (config.name === undefined) {
    this.log.error('ERROR: your configuration is missing the parameter "name"');
    this.name = 'Unnamed Daikin';
  } else {
    this.name = config.name;
    this.log.debug('Config: AC name is %s', config.name);
  }

  if (config.outsidemode === undefined) {
    this.log.error('ERROR: your configuration is missing the parameter "outsidemode"');
    this.outsidemode = true;
  } else {
    this.outsidemode = config.outsidemode;
    this.log.debug('Config: Outsidemode is %s', config.outsidemode);
  }

  if (config.apiroute === undefined) {
    this.log.error('ERROR: your configuration is missing the parameter "apiroute"');
    this.apiroute = 'http://192.168.1.88';
    this.apiIP = '192.168.1.88';
  } else {
    const myURL = new URL(config.apiroute);
    this.apiroute = myURL.origin;
    this.apiIP = myURL.hostname;
    this.log.debug('Config: apiroute is %s', config.apiroute);
  }

  if (config.temperatureOffset === undefined) {
    this.log.warn('WARNING: your configuration is missing the parameter "temperatureOffset", using default zero');
    this.temperatureOffset = 0;
  } else {
    this.temperatureOffset = config.temperatureOffset;
  }

  if (config.response === undefined) {
    this.response = 5000;
  } else {
    this.response = config.response;
  }

  if (config.deadline === undefined) {
    this.deadline = 10_000;
  } else {
    this.deadline = config.deadline;
  }

  if (config.retries === undefined) {
    this.retries = 3;
  } else {
    this.retries = config.retries;
  }

  if (config.system === undefined) {
    this.system = 'Default';
  } else {
    this.system = config.system;
  }

  this.OpenSSL3 = config.OpenSSL3 === true;
  this.uuid = config.uuid === undefined ? '' : config.uuid;

  switch (this.system) {
    case 'Skyfi': {
      this.get_sensor_info = this.apiroute + '/skyfi/aircon/get_sensor_info';
      this.get_control_info = this.apiroute + '/skyfi/aircon/get_control_info';
      this.get_model_info = this.apiroute + '/skyfi/aircon/get_model_info';
      this.set_control_info = this.apiroute + '/skyfi/aircon/set_control_info';
      this.basic_info = this.apiroute + '/skyfi/common/basic_info';
      break;
    }

    default: {
      this.get_sensor_info = this.apiroute + '/aircon/get_sensor_info';
      this.get_control_info = this.apiroute + '/aircon/get_control_info';
      this.get_model_info = this.apiroute + '/aircon/get_model_info';
      this.set_control_info = this.apiroute + '/aircon/set_control_info';
      this.basic_info = this.apiroute + '/common/basic_info';
      break;
    }
  }

  this.firmwareRevision = packageFile.version;
  this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
  this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
  this.temperatureService = new Service.TemperatureSensor(this.name);
}

Daikin.prototype = {
  parseResponse,

  sendGetRequest(path, callback, options) {
    this._queueGetRequest(path, callback, options || {});
  },

  _queueGetRequest(path, callback, options) {
    const method = options.skipQueue ? 'prepend' : 'append';

    this.queue[method](done => {
      this._doSendGetRequest(path, (error, response) => {
        if (error) {
          callback(error);
          done();
          return;
        }

        callback(null, response);
        done();
      }, options);
    });
  },

  _doSendGetRequest(path, callback, options) {
    if (this._serveFromCache && this._serveFromCache(path, callback, options)) return;

    let request = superagent
      .get(path)
      .retry(this.retries)
      .timeout({response: this.response, deadline: this.deadline})
      .set('User-Agent', 'superagent')
      .set('Host', this.apiIP);

    if (this.uuid !== '') {
      request = request.set('X-Daikin-uuid', this.uuid);
    }

    let urlProtocol = 'https:';
    try {
      urlProtocol = new URL(path).protocol;
    } catch {
      urlProtocol = 'https:';
    }

    if (urlProtocol === 'https:') {
      if (isOpenSSL3()) {
        request = request.agent(getLegacyAgent());
      } else if (typeof request.disableTLSCerts === 'function') {
        request = request.disableTLSCerts();
      } else {
        request = request.agent(getDefaultAgent());
      }
    } else {
      request = request.agent(getDefaultHttpAgent());
    }

    request.end((error, response) => {
      if (error) {
        return callback && callback(error);
      }

      const body = response && (response.text ?? (typeof response.body === 'string' ? response.body : JSON.stringify(response.body)));
      if (this.cache && typeof this.cache.set === 'function') {
        this.cache.set(path, body);
      }

      return callback && callback(null, body);
    });
  },

  _serveFromCache(path, callback, options) {
    if (options.skipCache || !this.cache.has(path) || this.cache.expired(path)) {
      return false;
    }

    const cachedResponse = this.cache.get(path);
    if (cachedResponse === undefined) {
      return false;
    }

    callback(null, cachedResponse);
    return true;
  },

  _readTemperature(field, callback) {
    this.sendGetRequest(this.get_sensor_info, (error, body) => {
      if (error) {
        return callback(error);
      }

      const responseValues = this.parseResponse(body);
      if (responseValues.ret !== 'OK') {
        return callback(new Error(`Daikin API error: ${responseValues.ret ?? body}`));
      }

      const rawTemperature = Number.parseFloat(responseValues[field]);
      if (!Number.isFinite(rawTemperature)) {
        return callback(new Error(`Invalid temperature (${field}): ${responseValues[field]}`));
      }

      callback(null, rawTemperature + this.temperatureOffset);
    });
  },

  getCurrentTemperature(callback) {
    this._readTemperature('htemp', callback);
  },

  getCurrentOutsideTemperature(callback) {
    this._readTemperature('otemp', callback);
  },

  identify(callback) {
    callback(null);
  },

  getTemperatureDisplayUnits(callback) {
    callback(null, this.temperatureDisplayUnits);
  },

  setTemperatureDisplayUnits(value, callback) {
    this.temperatureDisplayUnits = value;
    callback(null);
  },

  getServices() {
    const informationService = new Service.AccessoryInformation();

    this.getModelInfo();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Plugin: homebridge-daikin-tempsensor-nocloud')
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision)
      .setCharacteristic(Characteristic.SerialNumber, this.name);

    const temperatureGetter = this.outsidemode
      ? this.getCurrentOutsideTemperature.bind(this)
      : this.getCurrentTemperature.bind(this);

    this.temperatureService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({minValue: -50, maxValue: 100})
      .on('get', temperatureGetter);

    return [informationService, this.temperatureService];
  },

  getModelInfo() {
    this.sendGetRequest(this.get_model_info, (error, body) => {
      if (error) {
        return;
      }

      const responseValues = this.parseResponse(body);
      if (responseValues.ret === 'OK' && responseValues.model !== 'NOTSUPPORT') {
        this.model = responseValues.model;
      }
    });

    this.sendGetRequest(this.basic_info, (error, body) => {
      if (error) {
        return;
      }

      const responseValues = this.parseResponse(body);
      if (responseValues.ret === 'OK') {
        this.firmwareRevision = responseValues.ver;
      } else {
        this.firmwareRevision = 'NOTSUPPORT';
      }
    });
  },
};

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-daikin-tempsensor-nocloud', 'Daikin-Temperature', Daikin);
};
