const test = require('node:test');
const assert = require('node:assert/strict');
const {createDaikin, readTemperature} = require('./helpers/mock-homebridge.js');

function httpError(message, fields) {
  const error = new Error(message);
  Object.assign(error, fields);
  return error;
}

test('ECONNRESET is tried three times and then fails the temperature read', {timeout: 2000}, async () => {
  const daikin = createDaikin();
  let attempts = 0;
  daikin._doSendGetRequest = (_path, callback) => {
    attempts += 1;
    callback(httpError('reset', {code: 'ECONNRESET'}));
  };

  await assert.rejects(
    () => readTemperature(daikin, 'htemp'),
    error => error.code === 'ECONNRESET'
  );
  assert.equal(attempts, 3);
});

test('one ECONNRESET then a successful read still returns the temperature', {timeout: 2000}, async () => {
  const daikin = createDaikin({temperatureOffset: 0});
  let resets = 0;
  daikin._doSendGetRequest = (_path, callback) => {
    if (resets < 1) {
      resets += 1;
      callback(httpError('reset', {code: 'ECONNRESET'}));
      return;
    }

    callback(null, 'ret=OK,htemp=21.5');
  };

  assert.equal(await readTemperature(daikin, 'htemp'), 21.5);
  assert.equal(resets, 1);
});

test('three resets leave the queue usable for the next request', {timeout: 2000}, async () => {
  const daikin = createDaikin();
  let resets = 0;
  daikin._doSendGetRequest = (path, callback) => {
    if (path.includes('/later')) {
      callback(null, 'ret=OK,htemp=19.0');
      return;
    }

    resets += 1;
    callback(httpError('reset', {code: 'ECONNRESET'}));
  };

  await assert.rejects(() => readTemperature(daikin, 'htemp'));
  const body = await new Promise(resolve => {
    daikin.sendGetRequest('http://192.168.1.50/later', (_error, value) => resolve(value));
  });

  assert.equal(resets, 3);
  assert.equal(body, 'ret=OK,htemp=19.0');
});

test('a 403 still reaches the temperature callback', {timeout: 2000}, async () => {
  const daikin = createDaikin();
  daikin._doSendGetRequest = (_path, callback) => {
    callback(httpError('forbidden', {status: 403}));
  };

  await assert.rejects(
    () => readTemperature(daikin, 'htemp'),
    error => error.status === 403
  );
});
