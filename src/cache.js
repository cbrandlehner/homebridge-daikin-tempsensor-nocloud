/**
 * Simple in-memory cache with a time-to-live per entry.
 */
class Cache {
  /**
   * @param {number} [expiration=5] Entry lifetime in seconds.
   */
  constructor(expiration = 5) {
    this.entries = {};
    this.expiration = expiration;
  }

  /**
   * @param {string} key Cache key.
   * @returns {string | undefined} Cached value, if present.
   */
  get(key) {
    const entry = this.entries[key];
    return entry ? entry.value : undefined;
  }

  /**
   * @param {string} key Cache key.
   * @param {string} value Value to store.
   */
  set(key, value) {
    const timestamp = Date.now();
    this.entries[key] = {key, value, timestamp};
  }

  /**
   * @param {string} key Cache key.
   * @returns {boolean} Whether the key exists in the cache.
   */
  has(key) {
    return this.entries[key] !== undefined;
  }

  /**
   * @param {string} key Cache key.
   */
  remove(key) {
    delete this.entries[key];
  }

  /**
   * @param {string} key Cache key.
   * @returns {boolean} True when the entry is missing or past its TTL.
   */
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
