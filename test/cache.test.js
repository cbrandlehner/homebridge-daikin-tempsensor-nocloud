const test = require('node:test');
const assert = require('node:assert/strict');
const Cache = require('../src/cache.js');

test('cache stores and returns values', () => {
  const cache = new Cache();

  cache.set('sensor', 'ret=OK,htemp=20');

  assert.equal(cache.has('sensor'), true);
  assert.equal(cache.get('sensor'), 'ret=OK,htemp=20');
});

test('cache reports missing keys as expired', () => {
  const cache = new Cache();

  assert.equal(cache.has('missing'), false);
  assert.equal(cache.expired('missing'), true);
  assert.equal(cache.get('missing'), undefined);
});

test('cache expires entries after the configured ttl', () => {
  const cache = new Cache(5);

  cache.set('sensor', 'value');
  cache.entries.sensor.timestamp = Date.now() - 6000;

  assert.equal(cache.expired('sensor'), true);
  assert.equal(cache.has('sensor'), false);
});

test('cache remove deletes an entry', () => {
  const cache = new Cache();

  cache.set('sensor', 'value');
  cache.remove('sensor');

  assert.equal(cache.has('sensor'), false);
});
