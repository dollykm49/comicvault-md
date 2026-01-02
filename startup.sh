#!/bin/bash
# Startup script for Comic Vault Backend
# This script validates the environment before starting the server

echo "============================================================"
echo "Comic Vault Backend - Startup Validation"
echo "============================================================"

# Check Python version
echo "🐍 Checking Python version..."
python --version
if [ $? -ne 0 ]; then
    echo "❌ Python not found!"
    exit 1
fi
echo "✅ Python is available"

# Check if main.py exists
echo ""
echo "📁 Checking required files..."
if [ ! -f "main.py" ]; then
    echo "❌ main.py not found!"
    exit 1
fi
echo "✅ main.py exists"

if [ ! -f "requirements.txt" ]; then
    echo "❌ requirements.txt not found!"
    exit 1
fi
echo "✅ requirements.txt exists"

# Check if routes directory exists
if [ ! -d "routes" ]; then
    echo "❌ routes directory not found!"
    exit 1
fi
echo "✅ routes directory exists"

# Check if utils directory exists
if [ ! -d "utils" ]; then
    echo "❌ utils directory not found!"
    exit 1
fi
echo "✅ utils directory exists"

# Check environment variables
echo ""
echo "🔧 Checking environment variables..."
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY is not set (AI features will not work)"
else
    echo "✅ OPENAI_API_KEY is configured"
fi

if [ -z "$PORT" ]; then
    echo "⚠️  PORT is not set, will use default 8000"
    export PORT=8000
else
    echo "✅ PORT is set to $PORT"
fi

# List installed packages
echo ""
echo "📦 Checking installed packages..."
pip list | grep -E "fastapi|uvicorn|openai|Pillow" || echo "⚠️  Some packages might be missing"

# Test import
echo ""
echo "🧪 Testing Python imports..."
python -c "from fastapi import FastAPI; print('✅ FastAPI imports successfully')" || {
    echo "❌ FastAPI import failed!"
    exit 1
}

python -c "import uvicorn; print('✅ Uvicorn imports successfully')" || {
    echo "❌ Uvicorn import failed!"
    exit 1
}

# All checks passed
echo ""
echo "============================================================"
echo "✅ All validation checks passed!"
echo "============================================================"
echo ""
echo "🚀 Starting Comic Vault API..."
echo ""

# Start the server
exec uvicorn main:app --host 0.0.0.0 --port $PORT
