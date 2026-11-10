#!/usr/bin/env bash
# Weights & Measures - Local iPhone Server Runner

PORT=${1:-8080}
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || python3 -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0]); s.close()" 2>/dev/null || echo "localhost")
APP_URL="http://${LOCAL_IP}:${PORT}"

echo "=========================================================="
echo "  Weights & Measures — Baking Volume-to-Weight PWA"
echo "=========================================================="
echo ""
echo "  Local Wi-Fi URL: ${APP_URL}"
echo ""
echo "  To install on your iPhone:"
echo "  1. Make sure your iPhone is on the same Wi-Fi network."
echo "  2. Open the URL or scan this QR code with your iPhone camera:"
echo ""

curl -s "qrenco.de/${APP_URL}" 2>/dev/null || true

echo ""
echo "  3. In Safari on your iPhone, tap the Share button (square + arrow)."
echo "  4. Tap 'Add to Home Screen' -> tap 'Add'."
echo "  5. Enjoy 100% offline baking conversions directly on your phone!"
echo ""
echo "  Press Ctrl+C to stop the server."
echo "=========================================================="
echo ""

cd "$(dirname "$0")"
python3 -m http.server "${PORT}"
