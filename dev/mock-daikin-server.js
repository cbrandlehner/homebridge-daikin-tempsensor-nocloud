#!/usr/bin/env node
'use strict';

const http = require('node:http');
const process = require('node:process');
const {createDefaultState} = require('./fixtures/daikin-responses.js');

const PORT = Number.parseInt(process.env.MOCK_DAIKIN_PORT ?? String(18_765), 10);
const state = createDefaultState();

const routeMap = {
  '/aircon/get_model_info': () => state.modelInfo,
  '/skyfi/aircon/get_model_info': () => state.modelInfo,
  '/aircon/get_sensor_info': () => state.sensorInfo,
  '/skyfi/aircon/get_sensor_info': () => state.sensorInfo,
  '/common/basic_info': () => state.basicInfo,
  '/skyfi/common/basic_info': () => state.basicInfo,
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  if (request.method === 'GET' && routeMap[pathname]) {
    response.writeHead(200, {'Content-Type': 'text/plain'});
    response.end(routeMap[pathname]());
    return;
  }

  response.writeHead(404, {'Content-Type': 'text/plain'});
  response.end('ret=PARAM NG,msg=404 Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock Daikin server listening on http://127.0.0.1:${PORT}`);
  console.log('Endpoints: /aircon/get_model_info, /aircon/get_sensor_info, /common/basic_info');
});
