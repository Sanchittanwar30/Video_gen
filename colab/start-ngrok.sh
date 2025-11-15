#!/bin/bash
# Helper script to start ngrok tunnel for Colab API

set -e

PORT=${1:-3000}
API_URL="http://localhost:${PORT}"

echo "🚀 Starting ngrok tunnel for Colab API"
echo "📡 Forwarding to: ${API_URL}"
echo ""
echo "⚠️  Note: Free ngrok tunnels close after 2 hours"
echo "💡 Visit http://127.0.0.1:4040 to see requests and keep tunnel alive"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok not found. Please install it first:"
    echo "   https://ngrok.com/download"
    exit 1
fi

# Check if API server is running
if ! curl -s "${API_URL}/health" > /dev/null; then
    echo "⚠️  Warning: API server doesn't seem to be running on ${API_URL}"
    echo "   Start it with: npm run start:api"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Start ngrok
echo "🔗 Starting ngrok tunnel..."
echo ""
ngrok http ${PORT} --log=stdout

