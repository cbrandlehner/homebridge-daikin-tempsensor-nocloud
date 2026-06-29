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
