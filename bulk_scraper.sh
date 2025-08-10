#!/bin/bash
# Quick bulk scraper runner

echo "🚀 Starting HMO bulk scraper..."

# Start bulk scraping
curl -s -X POST http://localhost:5000/api/bulk-scrape > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Bulk scraping started successfully"
else
    echo "❌ Failed to start bulk scraping"
    exit 1
fi

# Monitor progress
last_city=""
start_time=$(date +%s)

while true; do
    # Get progress
    response=$(curl -s http://localhost:5000/api/bulk-scrape/progress)
    
    if [ $? -eq 0 ]; then
        # Extract data using grep and sed
        current_city=$(echo "$response" | grep -o '"currentCity":"[^"]*"' | sed 's/"currentCity":"\([^"]*\)"/\1/')
        completed=$(echo "$response" | grep -o '"completedCities":[0-9]*' | sed 's/"completedCities"://')
        total=$(echo "$response" | grep -o '"totalCities":[0-9]*' | sed 's/"totalCities"://')
        is_completed=$(echo "$response" | grep -o '"completed":true')
        
        # Show progress if city changed
        if [ "$current_city" != "$last_city" ] && [ -n "$current_city" ]; then
            current_time=$(date +%s)
            elapsed=$((current_time - start_time))
            
            if [ "$completed" -gt 0 ]; then
                avg_time=$((elapsed / completed))
                remaining=$(((total - completed) * avg_time))
                eta_min=$((remaining / 60))
                eta_sec=$((remaining % 60))
            else
                avg_time=0
                eta_min=0
                eta_sec=0
            fi
            
            echo "📍 [$((completed + 1))/$total] $current_city | Avg: ${avg_time}s/city | ETA: ${eta_min}m${eta_sec}s"
            last_city="$current_city"
        fi
        
        # Check if completed
        if [ -n "$is_completed" ]; then
            current_time=$(date +%s)
            total_time=$((current_time - start_time))
            total_min=$((total_time / 60))
            total_sec=$((total_time % 60))
            
            echo ""
            echo "🎉 Bulk scraping completed!"
            echo "⏱️  Total time: ${total_min}m${total_sec}s"
            echo "📊 Processed $total cities"
            break
        fi
    fi
    
    sleep 2
done