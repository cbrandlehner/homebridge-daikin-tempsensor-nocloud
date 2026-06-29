const test = require('node:test');
const assert = require('node:assert/strict');
const Queue = require('../src/queue.js');

test('queue runs appended jobs in order', () => {
  const queue = new Queue();
  const order = [];

  queue.append(done => {
    order.push('first');
    done();
  });
  queue.append(done => {
    order.push('second');
    done();
  });

  assert.deepEqual(order, ['first', 'second']);
});

test('queue prepends jobs ahead of pending work', () => {
  const queue = new Queue();
  const order = [];
  let finishSecond;

  queue.append(done => {
    finishSecond = done;
  });
  queue.prepend(done => {
    order.push('first');
    done();
  });

  assert.deepEqual(order, []);
  finishSecond();
  assert.deepEqual(order, ['first']);
});

test('queue does not start until a job is added', () => {
  const queue = new Queue();

  assert.equal(queue.running, false);
  assert.equal(queue.queue.length, 0);
});
