#!/bin/bash
# Automatska instalacija Python biblioteka za HMO Hunter

echo "🔧 Proveravam Python biblioteke..."

# Proveri da li su biblioteke instalirane
python3 -c "import requests, bs4" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "📦 Instaliram potrebne Python biblioteke..."
    
    # Instaliraj biblioteke pomoću uv (Replit package manager)
    if command -v uv &> /dev/null; then
        uv add requests beautifulsoup4 lxml
        echo "✅ Python biblioteke uspešno instalirane pomoću uv"
    else
        # Fallback na pip ako uv nije dostupan
        pip install requests beautifulsoup4 lxml
        echo "✅ Python biblioteke uspešno instalirane pomoću pip"
    fi
else
    echo "✅ Python biblioteke su već instalirane"
fi

echo "🚀 Python setup završen!"