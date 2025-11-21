#!/bin/bash

# Start backend with ngrok tunnel
# This script starts the backend and creates an ngrok tunnel

echo "🚀 Starting backend server..."
cd "$(dirname "$0")"

# Start backend in background
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 3

# Check if backend is running
if ! curl -s http://localhost:5000/api/health > /dev/null; then
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ Backend is running on port 5000"
echo ""
echo "🌐 Starting ngrok tunnel..."
echo ""

# Start ngrok
ngrok http 5000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get ngrok URL"
    echo "Check ngrok status at: http://localhost:4040"
    kill $BACKEND_PID $NGROK_PID 2>/dev/null
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Backend is running!"
echo "✅ Ngrok tunnel is active!"
echo ""
echo "📱 Update mobile/.env with:"
echo "   EXPO_PUBLIC_API_URL=${NGROK_URL}/api"
echo ""
echo "🌐 Ngrok URL: ${NGROK_URL}"
echo "🔗 Backend API: ${NGROK_URL}/api"
echo "🔗 Health Check: ${NGROK_URL}/api/health"
echo ""
echo "📊 Ngrok Dashboard: http://localhost:4040"
echo ""
echo "Press Ctrl+C to stop both backend and ngrok"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping backend and ngrok..."
    kill $BACKEND_PID $NGROK_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait

