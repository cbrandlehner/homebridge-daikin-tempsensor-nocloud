/* eslint quotes: ["error", "single", { "avoidEscape": true }] */

const dns = require('node:dns');
const net = require('node:net');

const DNS_CACHE_TTL_MS = 60_000;
const dnsCache = new Map();

/**
 * @param {string} host Hostname or IP address.
 * @returns {boolean}
 */
function isIpAddress(host) {
  return net.isIP(host) !== 0;
}

/**
 * @param {string} hostname Configured controller hostname.
 * @returns {string|undefined}
 */
function getCachedDnsAddress(hostname) {
  const cached = dnsCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.address;
  }

  return undefined;
}

/**
 * @param {string} hostname Configured controller hostname.
 * @param {string} address Resolved IPv4 address.
 */
function setCachedDnsAddress(hostname, address) {
  dnsCache.set(hostname, {address, expiresAt: Date.now() + DNS_CACHE_TTL_MS});
}

/** Clear the in-memory DNS cache (used by tests). */
function clearDnsCache() {
  dnsCache.clear();
}

/**
 * Resolve a configured controller host to IPv4. IP literals pass through unchanged.
 *
 * @param {string} hostname Hostname or IP from apiroute.
 * @returns {Promise<string>}
 */
async function resolveControllerHost(hostname) {
  if (isIpAddress(hostname)) {
    return hostname;
  }

  const cached = getCachedDnsAddress(hostname);
  if (cached) {
    return cached;
  }

  try {
    const {address} = await dns.promises.lookup(hostname, {family: 4});
    setCachedDnsAddress(hostname, address);
    return address;
  } catch {
    return hostname;
  }
}

/**
 * Swap the URL hostname for a resolved IP while preserving port, path, and query.
 *
 * @param {string} url Request URL.
 * @param {string} resolvedIP Resolved IPv4 address.
 * @returns {string}
 */
function replaceHostInUrl(url, resolvedIP) {
  try {
    const parsed = new URL(url);
    parsed.hostname = resolvedIP;
    return parsed.href;
  } catch {
    return url;
  }
}

module.exports = {
  isIpAddress,
  resolveControllerHost,
  replaceHostInUrl,
  clearDnsCache,
};