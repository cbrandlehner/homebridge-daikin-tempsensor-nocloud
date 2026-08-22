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

/**
 * Map a config `temperature_unit` value to HomeKit TemperatureDisplayUnits.
 * Invalid or missing values default to Celsius to avoid NaN in HomeKit.
 *
 * @param {unknown} value Configured unit (`C`, `F`, 0, 1, …).
 * @param {{CELSIUS: number, FAHRENHEIT: number}} units HomeKit enum.
 * @returns {number}
 */
function parseTemperatureDisplayUnits(value, units) {
  if (value === units.FAHRENHEIT || value === 1 || value === '1' || value === 'F' || value === 'f') {
    return units.FAHRENHEIT;
  }

  return units.CELSIUS;
}

module.exports = parseResponse;
module.exports.parseTemperatureDisplayUnits = parseTemperatureDisplayUnits;
