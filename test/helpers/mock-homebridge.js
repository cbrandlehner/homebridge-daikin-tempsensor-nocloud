function createMockLog() {
  const methods = ['debug', 'info', 'warn', 'error'];
  const log = {};

  for (const method of methods) {
    log[method] = () => {};
  }

  return log;
}

function createDaikin(config = {}) {
  let Accessory;

  const homebridge = {
    hap: {
      Service: class MockService {
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
          };
        }
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
