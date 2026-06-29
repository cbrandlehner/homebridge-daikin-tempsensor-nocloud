/**
 * Homebridge accessory that exposes Daikin Wi-Fi controller temperature readings
 * as a HomeKit temperature sensor (indoor or outdoor).
 *
 * @module homebridge-daikin-tempsensor-nocloud
 */

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
// const Throttle = require('superagent-throttle'); // optional, kept for parity if needed

// --- BEGIN: OpenSSL / Agent helpers (added) ---
const SECURE_OPS
  = ((crypto.constants && crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION) || 0)
    | ((crypto.constants && crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT) || 0);

/** @returns {boolean} Whether the runtime OpenSSL version is 3.x. */
function isOpenSSL3() {
  return (process.versions.openssl || '').startsWith('3.');
}

let LEGACY_AGENT = null;
let DEFAULT_AGENT = null;
let DEFAULT_HTTP_AGENT = null;

/** @returns {import('node:https').Agent} Reusable HTTPS agent for OpenSSL 3 legacy Daikin TLS. */
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

/** @returns {import('node:https').Agent} Reusable HTTPS agent with certificate verification disabled. */
function getDefaultAgent() {
  if (!DEFAULT_AGENT) {
    DEFAULT_AGENT = new https.Agent({
      keepAlive: true,
      rejectUnauthorized: false,
    });
  }

  return DEFAULT_AGENT;
}

/** @returns {import('node:http').Agent} Reusable plain-HTTP agent with keep-alive. */
function getDefaultHttpAgent() {
  if (!DEFAULT_HTTP_AGENT) {
    DEFAULT_HTTP_AGENT = new http.Agent({
      keepAlive: true,
    });
  }

  return DEFAULT_HTTP_AGENT;
}
// --- END: OpenSSL / Agent helpers ---

/**
 * Daikin temperature sensor accessory.
 *
 * @param {import('homebridge').Logger} log Homebridge logger.
 * @param {object} config Plugin configuration from `config.json`.
 * @param {string} [config.name] Accessory display name.
 * @param {boolean} [config.outsidemode] Read outdoor (`otemp`) instead of indoor (`htemp`) temperature.
 * @param {string} [config.apiroute] Base URL of the Daikin controller (e.g. `http://192.168.1.88`).
 * @param {number} [config.temperatureOffset] Degrees added to the reported temperature.
 * @param {number} [config.response] Superagent response timeout in milliseconds.
 * @param {number} [config.deadline] Superagent deadline timeout in milliseconds.
 * @param {number} [config.retries] Number of request retries on failure.
 * @param {'Default' | 'Skyfi'} [config.system] API path prefix for the controller type.
 * @param {boolean} [config.OpenSSL3] Force legacy TLS agent even when OpenSSL is not 3.x.
 * @param {string} [config.uuid] Optional `X-Daikin-uuid` header value.
 * @constructor
 */
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
    this.outsidemode = true; // which is the default of the plugin before introducing this option.
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
    this.log.debug('Config: temperatureOffset is %s', this.temperatureOffset);
  } else {
    this.log.debug('Config: temperatureOffset is %s', config.temperatureOffset);
    this.temperatureOffset = config.temperatureOffset;
  }

  if (config.response === undefined) {
    this.log.warn('WARNING: your configuration is missing the parameter "response", using default');
    this.response = 5000;
    this.log.debug('Config: response is %s', this.response);
  } else {
    this.log.debug('Config: response is %s', config.response);
    this.response = config.response;
  }

  if (config.deadline === undefined) {
    this.log.warn('WARNING: your configuration is missing the parameter "deadline", using default');
    this.deadline = 10_000;
    this.log.debug('Config: deadline is %s', this.deadline);
  } else {
    this.log.debug('Config: deadline is %s', this.deadline);
    this.deadline = config.deadline;
  }

  if (config.retries === undefined) {
    this.log.warn('WARNING: your configuration is missing the parameter "retries", using default of 5 retries');
    this.retries = 3;
    this.log.debug('Config: retries is %s', this.retries);
  } else {
    this.log.debug('Config: retries is %s', config.retries);
    this.retries = config.retries;
  }

  if (config.system === undefined) {
    this.log.warn('ERROR: your configuration is missing the parameter "system", using default');
    this.system = 'Default';
    this.log.debug('Config: system is %s', this.system);
  } else {
    this.log.debug('Config: system is %s', config.system);
    this.system = config.system;
  }

  if (config.OpenSSL3 === undefined || config.OpenSSL3 === false)
    this.OpenSSL3 = false;
  else
    this.OpenSSL3 = true;

  if (config.uuid === undefined)
    this.uuid = '';
  else
    this.uuid = config.uuid;

  switch (this.system) {
    case 'Default': {
      this.get_sensor_info = this.apiroute + '/aircon/get_sensor_info';
      this.get_control_info = this.apiroute + '/aircon/get_control_info';
      this.get_model_info = this.apiroute + '/aircon/get_model_info';
      this.set_control_info = this.apiroute + '/aircon/set_control_info';
      this.basic_info = this.apiroute + '/common/basic_info';
      break;
    }

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

  this.log.debug('Get sensor info %s', this.get_sensor_info);
  this.log.debug('Get control %s', this.get_control_info);
  this.log.debug('Get model info %s', this.get_model_info);
  this.log.debug('Get basic info %s', this.basic_info);

  this.firmwareRevision = packageFile.version;

  this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;

  this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;

  this.log.info('******************************************************************************');
  this.log.info('  homebridge-daikin-tempsensor-nocloud version ' + packageFile.version);
  this.log.info('  GitHub: https://github.com/cbrandlehner/homebridge-daikin-tempsensor-nocloud');
  this.log.info('******************************************************************************');
  this.log.info('accessory name: ' + this.name);
  this.log.info('accessory ip: ' + this.apiIP);
  this.log.debug('system: ' + this.system);
  this.log.debug('Debug mode is enabled');

  this.temperatureService = new Service.TemperatureSensor(this.name);
}

Daikin.prototype = {
  /** @type {typeof parseResponse} */
  parseResponse,

  /**
   * Queue a GET request to the Daikin controller.
   *
   * @param {string} path Full request URL.
   * @param {(error: Error | null, body?: string) => void} callback Called with the response body or an error.
   * @param {{ skipQueue?: boolean, skipCache?: boolean }} [options] Queue and cache behaviour overrides.
   */
  sendGetRequest(path, callback, options) {
    this.log.debug('sendGetRequest: attempting request: path: %s', path);

    this._queueGetRequest(path, callback, options || {});
  },

  /**
   * @param {string} path Full request URL.
   * @param {(error: Error | null, body?: string) => void} callback Called with the response body or an error.
   * @param {{ skipQueue?: boolean, skipCache?: boolean }} options Queue and cache behaviour overrides.
   */
  _queueGetRequest(path, callback, options) {
    const method = options.skipQueue ? 'prepend' : 'append';

    this.log.debug(`queuing (${method}) request: path: %s`, path);

    this.queue[method](done => {
      this.log.debug('_queueGetRequest: executing queued request: path: %s', path);

      this._doSendGetRequest(path, (error, response) => {
        if (error) {
          this.log.error('ERROR: Queued request to %s returned error %s', path, error);
          callback(error);
          done();
          return;
        }

        this.log.debug('_queueGetRequest: queued request finished: path: %s', path);

        callback(null, response);
        done();
      }, options);
    });
  },

  /**
   * Perform a GET request, using the cache when possible.
   *
   * @param {string} path Full request URL.
   * @param {(error: Error | null, body?: string) => void} callback Called with the response body or an error.
   * @param {{ skipQueue?: boolean, skipCache?: boolean }} options Cache behaviour overrides.
   */
  _doSendGetRequest(path, callback, options) {
    if (this._serveFromCache && this._serveFromCache(path, callback, options)) return;

    this.log.debug('_doSendGetRequest: requesting from API: path: %s', path);

    let request = superagent
      .get(path)
      .retry(this.retries)
      .timeout({
        response: this.response,
        deadline: this.deadline,
      })
      .set('User-Agent', 'superagent')
      .set('Host', this.apiIP);

    if (this.uuid !== '') {
      request = request.set('X-Daikin-uuid', this.uuid);
    }

    // Choose agent based on URL protocol and OpenSSL version to avoid .disableTLSCerts issues
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
      // plain http
      request = request.agent(getDefaultHttpAgent());
    }

    request.end((error, response) => {
      if (error) {
        if (error.timeout) {/* timed out */}
        else if (error.code === 'ECONNRESET') {
          this.log.debug('_doSendGetRequest: eConnreset filtered');
        } else {
          this.log.error('_doSendGetRequest: ERROR: API request to %s returned error %s', path, error);
        }

        return callback && callback(error);
      }

      // Prefer text when available (keeps compatibility with parseResponse callers)
      const body = response && (response.text ?? (typeof response.body === 'string' ? response.body : JSON.stringify(response.body)));
      try {
        if (this.cache && typeof this.cache.set === 'function') {
          this.log.debug('_doSendGetRequest: set cache: path: %s', path);
          this.cache.set(path, body);
        }
      } catch (error) {
        this.log.debug('_doSendGetRequest: cache set failed: %s', error.message || error);
      }

      this.log.debug('_doSendGetRequest: response from API: %s', body);
      return callback && callback(null, body);
    });
  },

  /**
   * Return a cached response when valid.
   *
   * @param {string} path Cache key (request URL).
   * @param {(error: Error | null, body?: string) => void} callback Called with the cached body on hit.
   * @param {{ skipQueue?: boolean, skipCache?: boolean }} options Cache behaviour overrides.
   * @returns {boolean} True when the callback was satisfied from cache.
   */
  _serveFromCache(path, callback, options) {
    this.log.debug('_serveFromCache: requesting from cache: path: %s', path);

    if (options.skipCache) {
      this.log.debug('_serveFromCache: cache SKIP: path: %s', path);
      return false;
    }

    if (!this.cache.has(path)) {
      this.log.debug('_serveFromCache: cache MISS: path: %s', path);
      return false;
    }

    if (this.cache.expired(path)) {
      this.log.debug('_serveFromCache: cache EXPIRED: path: %s', path);
      return false;
    }

    const cachedResponse = this.cache.get(path);

    if (cachedResponse === undefined) {
      this.log.debug('_serveFromCache: cache EMPTY: path: %s', path);
      return false;
    }

    this.log.debug('_serveFromCache: cache HIT: path: %s', path);
    this.log.debug('_serveFromCache: responding from cache: %s', cachedResponse);

    callback(null, cachedResponse);
    return true;
  },

  /**
   * Read and validate a temperature field from `get_sensor_info`.
   *
   * @param {'htemp' | 'otemp'} field Sensor field to read.
   * @param {(error: Error | null, temperature?: number) => void} callback Called with adjusted °C or an error.
   */
  _readTemperature(field, callback) {
    this.log.debug('_readTemperature(%s) using %s', field, this.get_sensor_info);
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

      const adjustedTemperature = rawTemperature + this.temperatureOffset;
      this.log.debug(
        'Temperature (raw): %s°, offset: %s°, adjusted: %s°',
        rawTemperature.toFixed(1),
        this.temperatureOffset.toFixed(1),
        adjustedTemperature.toFixed(1)
      );
      callback(null, adjustedTemperature);
    });
  },

  /**
   * HomeKit getter for indoor temperature (`htemp`).
   *
   * @param {(error: Error | null, temperature?: number) => void} callback HomeKit characteristic callback.
   */
  getCurrentTemperature(callback) {
    this._readTemperature('htemp', callback);
  },

  /**
   * HomeKit getter for outdoor temperature (`otemp`).
   *
   * @param {(error: Error | null, temperature?: number) => void} callback HomeKit characteristic callback.
   */
  getCurrentOutsideTemperature(callback) {
    this._readTemperature('otemp', callback);
  },

  /**
   * HomeKit identify handler (no-op for Daikin controllers).
   *
   * @param {(error: Error | null) => void} callback HomeKit identify callback.
   */
  identify: function (callback) {
    this.log.info('Identify requested, however there is no way to let your Daikin WIFI module speak up for identification!');
    callback(null);
  },

  /**
   * @param {(error: Error | null, units?: number) => void} callback HomeKit characteristic callback.
   */
  getTemperatureDisplayUnits: function (callback) {
    this.log.info('getTemperatureDisplayUnits: Temperature unit is %s. 0=Celsius, 1=Fahrenheit.', this.temperatureDisplayUnits);
    const error = null;
    callback(error, this.temperatureDisplayUnits);
  },

  /**
   * @param {number} value `Characteristic.TemperatureDisplayUnits` value.
   * @param {(error: Error | null) => void} callback HomeKit characteristic callback.
   */
  setTemperatureDisplayUnits: function (value, callback) {
    this.log.info('Changing temperature unit from %s to %s. 0=Celsius, 1=Fahrenheit.', this.temperatureDisplayUnits, value);
    this.temperatureDisplayUnits = value;
    const error = null;
    callback(error);
  },

  /**
   * Build and return HomeKit services exposed by this accessory.
   *
   * @returns {import('homebridge').Service[]} Accessory information and temperature sensor services.
   */
  getServices: function () {
    const informationService = new Service.AccessoryInformation();

    this.getModelInfo();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Plugin: homebridge-daikin-tempsensor-nocloud')
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision)
      .setCharacteristic(Characteristic.SerialNumber, this.name);

    if (this.outsidemode === true) {
      this.temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
          minValue: Number.parseFloat('-50'),
          maxValue: Number.parseFloat('100'),
        })
        .on('get', this.getCurrentOutsideTemperature.bind(this));
    } else {
      this.temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
          minValue: Number.parseFloat('-50'),
          maxValue: Number.parseFloat('100'),
        })
        .on('get', this.getCurrentTemperature.bind(this));
    }

    // let services;
    const services = [informationService, this.temperatureService];
    return services;
  },

  /** Fetch controller model and firmware revision from the Daikin API (async, fire-and-forget). */
  getModelInfo: function () {
    this.sendGetRequest(this.get_model_info, (error, body) => {
      if (error) {
        this.log.error('getModelInfo request failed: %s', error);
        return;
      }

      const responseValues = this.parseResponse(body);
      this.log.debug('getModelInfo return code %s', responseValues.ret);
      this.log.debug('getModelInfo %s', responseValues.model);
      if (responseValues.ret === 'OK') {
        this.log.debug('Model reported: %s', responseValues.model);
        if (responseValues.model !== 'NOTSUPPORT') {
          this.model = responseValues.model;
          this.log.info('Your Daikin WIFI controller model: %s', responseValues.model);
        }
      } else {
        this.log.error('Not connected to a supported Daikin wifi controller!');
        this.log.warn('Response is %s', body);
      }
    });
    this.sendGetRequest(this.basic_info, (error, body) => {
      if (error) {
        this.log.error('getModelInfo basic_info request failed: %s', error);
        return;
      }

      const responseValues = this.parseResponse(body);
      this.log.debug('getModelInfo for basic info return code %s', responseValues.ret);
      if (responseValues.ret === 'OK') {
        this.firmwareRevision = responseValues.ver;
        this.log.info('The firmware version is %s', this.firmwareRevision);
      } else {
        this.firmwareRevision = 'NOTSUPPORT';
        this.log.error('getModelInfo for basic info: Not connected to a supported Daikin wifi controller!');
      }
    });
  },
};

/**
 * Homebridge plugin entry point.
 *
 * @param {import('homebridge').API} homebridge Homebridge API instance.
 */
module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-daikin-tempsensor-nocloud', 'Daikin-Temperature', Daikin);
};
