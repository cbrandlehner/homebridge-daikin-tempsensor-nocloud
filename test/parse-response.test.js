const test = require('node:test');
const assert = require('node:assert/strict');
const parseResponse = require('../src/parse-response.js');
const {parseTemperatureDisplayUnits} = parseResponse;
const {createDefaultState} = require('../dev/fixtures/daikin-responses.js');

const TemperatureDisplayUnits = {
  CELSIUS: 0,
  FAHRENHEIT: 1,
};

test('parseResponse parses a standard Daikin payload', () => {
  const body = 'ret=OK,htemp=22.5,otemp=18.0';
  const parsed = parseResponse(body);

  assert.equal(parsed.ret, 'OK');
  assert.equal(parsed.htemp, '22.5');
  assert.equal(parsed.otemp, '18.0');
});

test('parseResponse returns an empty object for empty input', () => {
  assert.deepEqual(parseResponse(''), {});
  assert.deepEqual(parseResponse(undefined), {});
  assert.deepEqual(parseResponse(null), {});
});

test('parseResponse keeps values that contain equals signs', () => {
  const parsed = parseResponse('ret=OK,msg=a=b');

  assert.equal(parsed.ret, 'OK');
  assert.equal(parsed.msg, 'a=b');
});

test('parseResponse skips malformed segments without equals', () => {
  const parsed = parseResponse('ret=OK,broken,htemp=21.0');

  assert.equal(parsed.ret, 'OK');
  assert.equal(parsed.htemp, '21.0');
  assert.equal(parsed.broken, undefined);
});

test('parseTemperatureDisplayUnits defaults to Celsius', () => {
  assert.equal(parseTemperatureDisplayUnits('C', TemperatureDisplayUnits), TemperatureDisplayUnits.CELSIUS);
  assert.equal(parseTemperatureDisplayUnits(undefined, TemperatureDisplayUnits), TemperatureDisplayUnits.CELSIUS);
  assert.equal(parseTemperatureDisplayUnits('celsius', TemperatureDisplayUnits), TemperatureDisplayUnits.CELSIUS);
});

test('parseTemperatureDisplayUnits accepts Fahrenheit aliases', () => {
  assert.equal(parseTemperatureDisplayUnits('F', TemperatureDisplayUnits), TemperatureDisplayUnits.FAHRENHEIT);
  assert.equal(parseTemperatureDisplayUnits('1', TemperatureDisplayUnits), TemperatureDisplayUnits.FAHRENHEIT);
  assert.equal(parseTemperatureDisplayUnits(1, TemperatureDisplayUnits), TemperatureDisplayUnits.FAHRENHEIT);
});

test('mock sensor fixture is a parseable Daikin payload', () => {
  const parsed = parseResponse(createDefaultState().sensorInfo);

  assert.equal(parsed.ret, 'OK');
  assert.equal(Number.parseFloat(parsed.htemp), 24.5);
  assert.equal(Number.parseFloat(parsed.otemp), 18.0);
});
