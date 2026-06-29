const test = require('node:test');
const assert = require('node:assert/strict');
const parseResponse = require('../src/parse-response.js');

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
