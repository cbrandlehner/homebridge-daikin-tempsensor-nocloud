#!/usr/bin/env bash
set -euo pipefail

IP="${1:-192.168.71.136}"
BASE="http://${IP}"

echo "=== get_model_info ==="
curl -s "${BASE}/aircon/get_model_info"
echo ""
echo ""
echo "=== get_sensor_info ==="
curl -s "${BASE}/aircon/get_sensor_info"
echo ""
echo ""
echo "=== basic_info ==="
curl -s "${BASE}/common/basic_info"
echo ""