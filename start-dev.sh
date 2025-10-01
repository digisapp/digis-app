#!/bin/bash

# Development startup script for Digis app

echo "🚀 Starting Digis Development Environment..."

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the digis-app root directory"
    exit 1
fi

# Function to cleanup processes on exit
cleanup() {
    echo "🛑 Shutting down services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

# Set up cleanup trap
trap cleanup SIGINT SIGTERM

# Kill any existing processes on the ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Wait a moment for ports to be freed
sleep 2

# Start backend
echo "🔧 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Test backend health
BACKEND_HEALTH=$(curl -s http://localhost:3001/health | grep -o '"status":"healthy"' || echo "")
if [ -z "$BACKEND_HEALTH" ]; then
    echo "⚠️ Backend health check failed, but continuing..."
else
    echo "✅ Backend is healthy"
fi

# Start frontend
echo "🎨 Starting frontend development server..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 10

echo "🎉 Development environment ready!"
echo ""
echo "📍 Services running at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   Health:   http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for processes to complete
wait $BACKEND_PID $FRONTEND_PID