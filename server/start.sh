#!/bin/bash
# CarWatch Backend Startup Script

echo "🚀 Starting CarWatch Backend..."
echo ""

# Check if Docker is running
if ! docker ps &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if database container is running
if ! docker ps | grep -q carwatch_db; then
    echo "📦 Starting PostgreSQL database..."
    docker-compose up -d
    echo "⏳ Waiting for database to be ready..."
    sleep 3
else
    echo "✓ Database is already running"
fi

# Activate virtual environment and start server
echo "✓ Activating Python virtual environment..."
source .venv/bin/activate

echo "✓ Starting FastAPI server..."
echo ""
python main.py
