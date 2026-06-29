/**
 * Parse a comma-separated Daikin API response body into key/value pairs.
 *
 * @param {string | null | undefined} response Raw response text from the controller.
 * @returns {Record<string, string>} Parsed fields keyed by name.
 */
function parseResponse(response) {
  const vals = {};
  if (!response) {
    return vals;
  }

  for (const item of response.split(',')) {
    const separator = item.indexOf('=');
    if (separator === -1) {
      continue;
    }

    vals[item.slice(0, separator)] = item.slice(separator + 1);
  }

  return vals;
}

module.exports = parseResponse;
