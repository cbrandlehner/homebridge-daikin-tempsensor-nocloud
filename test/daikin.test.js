const test = require('node:test');
const assert = require('node:assert/strict');
const parseResponse = require('../src/parse-response.js');
const {createDaikin, readTemperature} = require('./helpers/mock-homebridge.js');

test('Daikin uses parseResponse for API payloads', () => {
  const daikin = createDaikin();
  const body = 'ret=OK,htemp=21.5,otemp=12.0';

  assert.deepEqual(daikin.parseResponse(body), parseResponse(body));
});

test('_readTemperature applies the configured offset', async () => {
  const daikin = createDaikin({temperatureOffset: 1.5});
  daikin.sendGetRequest = (_path, callback) => {
    callback(null, 'ret=OK,htemp=22.0,otemp=10.0');
  };

  const temperature = await readTemperature(daikin, 'htemp');

  assert.equal(temperature, 23.5);
});

test('_readTemperature rejects API errors', async () => {
  const daikin = createDaikin();
  daikin.sendGetRequest = (_path, callback) => {
    callback(null, 'ret=PARAM NG,msg=404 Not Found');
  };

  await assert.rejects(
    () => readTemperature(daikin, 'htemp'),
    /Daikin API error: PARAM NG/
  );
});

test('_readTemperature rejects invalid temperature values', async () => {
  const daikin = createDaikin();
  daikin.sendGetRequest = (_path, callback) => {
    callback(null, 'ret=OK,htemp=not-a-number');
  };

  await assert.rejects(
    () => readTemperature(daikin, 'htemp'),
    /Invalid temperature \(htemp\): not-a-number/
  );
});

test('_readTemperature propagates request failures', async () => {
  const daikin = createDaikin();
  const requestError = new Error('ECONNREFUSED');
  daikin.sendGetRequest = (_path, callback) => {
    callback(requestError);
  };

  await assert.rejects(
    () => readTemperature(daikin, 'htemp'),
    requestError
  );
});

test('Default system builds standard Daikin API routes', () => {
  const daikin = createDaikin({apiroute: 'https://192.168.1.77'});

  assert.equal(daikin.get_sensor_info, 'https://192.168.1.77/aircon/get_sensor_info');
  assert.equal(daikin.basic_info, 'https://192.168.1.77/common/basic_info');
});

test('Skyfi system builds skyfi API routes', () => {
  const daikin = createDaikin({
    apiroute: 'https://192.168.1.77',
    system: 'Skyfi',
  });

  assert.equal(daikin.get_sensor_info, 'https://192.168.1.77/skyfi/aircon/get_sensor_info');
  assert.equal(daikin.basic_info, 'https://192.168.1.77/skyfi/common/basic_info');
});
