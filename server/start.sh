#!/bin/bash
# CarWatch Backend Startup Script (Supabase)

echo "Starting CarWatch Backend..."
echo ""

# Activate virtual environment
echo "Activating Python virtual environment..."
source .venv/bin/activate

# Kill any existing process on port 8000
if lsof -ti:8000 &> /dev/null; then
    echo "Port 8000 in use — killing existing process..."
    kill $(lsof -ti:8000) 2>/dev/null
    sleep 1
fi

echo "Starting FastAPI server..."
echo ""
python main.py
