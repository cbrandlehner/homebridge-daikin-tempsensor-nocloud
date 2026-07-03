/** @returns {import('homebridge').Logger} */
function createMockLog() {
  const methods = ['debug', 'info', 'warn', 'error'];
  const log = {};

  for (const method of methods) {
    log[method] = () => {};
  }

  return log;
}

/**
 * Create a Daikin accessory instance with a minimal Homebridge mock.
 *
 * @param {object} [config={}] Accessory config overrides.
 * @returns {object} Configured Daikin accessory instance.
 */
function createDaikin(config = {}) {
  let Accessory;

  class MockService {
    constructor(name) {
      this.name = name;
    }

    getCharacteristic() {
      return {
        setProps() {
          return this;
        },
        on() {
          return this;
        },
        setCharacteristic() {
          return this;
        },
      };
    }

    setCharacteristic() {
      return this;
    }
  }

  const homebridge = {
    hap: {
      Service: {
        TemperatureSensor: MockService,
        AccessoryInformation: MockService,
      },
      Characteristic: {
        TemperatureDisplayUnits: {CELSIUS: 0},
        TargetHeatingCoolingState: {AUTO: 0},
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        FirmwareRevision: 'FirmwareRevision',
        SerialNumber: 'SerialNumber',
        CurrentTemperature: 'CurrentTemperature',
      },
    },
    registerAccessory(_plugin, _name, Constructor) {
      Accessory = Constructor;
    },
  };

  require('../../src/index.js')(homebridge);

  return new Accessory(createMockLog(), {
    name: 'Test Sensor',
    outsidemode: false,
    apiroute: 'http://192.168.1.50',
    system: 'Default',
    ...config,
  });
}

/**
 * @param {object} daikin Daikin accessory instance.
 * @param {'htemp' | 'otemp'} field Temperature field to read.
 * @returns {Promise<number>} Adjusted temperature in degrees Celsius.
 */
function readTemperature(daikin, field) {
  return new Promise((resolve, reject) => {
    daikin._readTemperature(field, (error, value) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(value);
    });
  });
}

module.exports = {
  createDaikin,
  readTemperature,
};
