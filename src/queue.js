class Queue {
  constructor() {
    this.queue = [];
    this.running = false;
  }

  add(callback, prepend = false) {
    const action = () => {
      const next = this.next.bind(this);
      callback(next);
    };

    if (prepend)
      this.queue.unshift(action);
    else
      this.queue.push(action);

    if (!this.running)
      this.next();

    return this;
  }

  append(callback) {
    return this.add(callback, false);
  }

  prepend(callback) {
    return this.add(callback, true);
  }

  next() {
    this.running = false;

    const next = this.queue.shift();
    if (next) {
      this.running = true;
      next();
    }
  }
}

module.exports = Queue;
