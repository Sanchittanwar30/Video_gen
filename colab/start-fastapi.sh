#!/bin/bash
# Start FastAPI server for Colab

set -e

echo "🚀 Starting FastAPI server for Colab API"
echo ""

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "📦 Activating virtual environment..."
    source venv/bin/activate
fi

# Check if dependencies are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "⚠️  FastAPI not found. Installing dependencies..."
    pip install -r colab/requirements-fastapi.txt
fi

# Start server
echo "🌐 Starting FastAPI server on http://localhost:3000"
echo "📚 API docs: http://localhost:3000/docs"
echo ""
uvicorn colab.fastapi_server:app --host 0.0.0.0 --port 3000 --reload

