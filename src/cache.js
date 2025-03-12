class Cache {
  constructor(expiration = 5) {
    this.entries = {};
    this.expiration = expiration;
  }

  get(key) {
    const entry = this.entries[key];
    return entry ? entry.value : undefined;
  }

  set(key, value) {
    const timestamp = Date.now();
    this.entries[key] = {key, value, timestamp};
  }

  has(key) {
    return this.entries[key] !== undefined;
  }

  remove(key) {
    delete this.entries[key];
  }

  expired(key) {
    if (!this.has(key)) return true;

    const entry = this.entries[key];
    const delta = (Date.now() - entry.timestamp) / 1000;

    if (delta > this.expiration) {
      this.remove(key);
      return true;
    }

    return false;
  }
}

module.exports = Cache;
