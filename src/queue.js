/**
 * Serial job queue that runs one callback at a time.
 */
class Queue {
  constructor() {
    this.queue = [];
    this.running = false;
  }

  /**
   * @param {(done: () => void) => void} callback Job to run. Call `done` when finished.
   * @param {boolean} [prepend=false] Insert at the front of the queue.
   * @returns {this}
   */
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

  /**
   * @param {(done: () => void) => void} callback Job to append.
   * @returns {this}
   */
  append(callback) {
    return this.add(callback, false);
  }

  /**
   * @param {(done: () => void) => void} callback Job to prepend.
   * @returns {this}
   */
  prepend(callback) {
    return this.add(callback, true);
  }

  /** Start the next queued job, if any. */
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
