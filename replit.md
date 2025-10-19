# HMO Hunter - Property Investment Analysis Tool

## Overview
HMO Hunter is a full-stack property investment analysis application built with React, TypeScript, Express, and integrated with property data scraping capabilities. The application helps users find and analyze HMO (House in Multiple Occupation) investment opportunities in UK cities.

## Current State
- ✅ Application successfully running on port 5000
- ✅ Frontend: React with TypeScript, Vite dev server, Tailwind CSS, shadcn/ui components
- ✅ Backend: Express server with TypeScript, Python integration for scraping
- ✅ Data: Currently using in-memory storage with extensive cached property data from multiple UK cities
- ✅ Features: Property search, filtering, Article 4 area checking, rental yield analysis

## Recent Changes

### October 19, 2025 - Article 4 Cache System Implementation
- ✅ **Article 4 Cache Service**: Implemented local caching system to minimize API calls (article4-cache.ts)
  - 24-hour cache TTL with daily automatic refresh at 3 AM via cron job
  - Caches 92 UK postcodes from property dataset
  - Reduces API usage from 400 calls/month to just daily cache refreshes
- ✅ **Python Helper Integration**: Added article4-helper.py for cache-based Article 4 filtering during scraping
  - Scraper now checks cache first before making API calls
  - Falls back to pattern matching if postcode not in cache
- ✅ **Cron Job**: Automated daily cache refresh (article4-cron.ts)
  - Scheduled refresh at 3 AM daily
  - Manual refresh available via API endpoint
  - Initial cache population on startup if no cache exists
- ✅ **Cache API Endpoints**: Added management endpoints for monitoring and control
  - GET /api/article4-cache/stats - View cache statistics
  - POST /api/article4-cache/refresh - Manually trigger refresh
  - GET /api/article4-cache/check/:postcode - Check cache for specific postcode
- ✅ **Database SSL Fix**: Resolved Neon database WebSocket SSL certificate issue in development
- ✅ **Sort Order**: Scraper now prioritizes newest_listings instead of highest_price for better results

### October 19, 2025 - Comprehensive Scraper Upgrades (Patch 2)
- ✅ **TypeScript ScraperManager**: Added default ENV variables for wider scraping (PL_EXPAND_SORTS, PL_TYPES, PL_MAX_PAGES_TOTAL, PL_MIN_RESULTS, PL_WORKERS, ARTICLE4_MODE)
- ✅ **HTTP Retry Logic**: Implemented robust HTTPAdapter with retry strategy (3 retries, backoff 0.5s, handles 429/5xx status codes)
- ✅ **Multiple Feed Paths**: Scraper now searches across /property, /houses, and /flats feeds for maximum coverage
- ✅ **Dynamic Page Discovery (BFS)**: Implemented breadth-first search with deque for automatic discovery of related/next pages
- ✅ **JSON-LD Parsing**: Enhanced data extraction using structured JSON-LD metadata with DOM fallbacks for reliability
- ✅ **Configurable Article 4 Modes**: Support for strict/relaxed/off modes via ARTICLE4_MODE environment variable
- ✅ **Smart Empty Page Detection**: Automatic stopping after configured consecutive empty pages (default: 5)
- ✅ **Improved Session Management**: Better Accept-Encoding headers, connection pooling (64 connections), and anti-bot resilience
- ✅ **Architect Reviewed**: All changes passed comprehensive code review with no functional regressions

### October 16, 2025 - Automatic Article 4 Enrichment for All Properties
- ✅ **Automatic Article 4 checking**: All property listings now automatically get Article 4 status via Article4Maps API
- ✅ **Smart enrichment**: Only enriches paginated slice (20 properties) instead of full dataset for optimal performance
- ✅ **Post-enrichment filtering**: Article 4 filter now applies AFTER enrichment to ensure 100% accuracy
- ✅ **Performance optimized**: Batch API checks take ~600-1400ms for 19 unique postcodes per page
- ✅ **Postcode extraction**: Automatically extracts postcodes from address field when not explicitly provided
- ✅ **Architecture**: CacheDatabase passes `article4_filter: "all"` to prevent premature filtering, then routes.ts applies filter after enrichment
- ⚠️ **IMPORTANT**: Requires `ARTICLE4MAPS_API_KEY` environment variable (development in Replit Secrets, production on Hetzner server)

### October 16, 2025 - Removed All Fake Article 4 Logic
- ✅ Deleted `article4-service.ts` (fake planning.data.gov.uk logic)
- ✅ Deleted `comprehensive-postcode-service.ts` (fake postcode database)
- ✅ Simplified `enhanced-article4-service.ts` to use ONLY Article4Maps API
- ✅ Removed Article 4 detection from `zoopla_scraper.py`
- ✅ Updated `cache-database.ts` to use simple boolean flags
- ✅ Fixed all TypeScript errors and cleaned up imports
- ✅ Architect review PASSED - production ready

### September 30, 2025 - Initial Setup
- ✅ Fresh GitHub import successfully configured for Replit environment
- ✅ Installed all npm dependencies (489 packages)
- ✅ Installed Python dependencies (beautifulsoup4, lxml, requests) via uv package manager
- ✅ Configured workflow with webview output type for frontend on port 5000
- ✅ Verified Vite configuration properly allows all hosts (`allowedHosts: true` in server/vite.ts)
- ✅ Application successfully running with frontend and backend on port 5000
- ✅ Property cache loaded: 11,486 properties from London, Manchester, Birmingham, Liverpool, Leeds and other UK cities
- ✅ Deployment configuration set for production (autoscale with npm build/start)
- ✅ Frontend successfully connected to backend with Vite HMR working

## Project Architecture
### Frontend (`client/`)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with dark mode support
- **State Management**: TanStack Query for server state
- **Build Tool**: Vite with hot module replacement

### Backend (`server/`)
- **Framework**: Express.js with TypeScript
- **Database**: Drizzle ORM with PostgreSQL schema (currently using in-memory storage)
- **Python Integration**: Property scraping with BeautifulSoup, requests, lxml
- **Article 4 Service**: Article4Maps API integration (single source of truth, 99.9% accuracy)
- **Services**: Property analysis, cache management
- **APIs**: RESTful endpoints for property search and analysis

### Shared (`shared/`)
- **Schema**: Drizzle database schema with Zod validation
- **Types**: Shared TypeScript types between frontend and backend

## Key Features
1. **Property Search**: Multi-city property search with price and bedroom filters
2. **Article 4 Checking**: Real-time HMO licensing restriction checks via Article4Maps API (99.9% accuracy)
3. **Investment Analysis**: Rental yield calculations and property analysis
4. **Data Caching**: Extensive property data cached from PrimeLocation and other sources
5. **Responsive UI**: Modern interface with dark/light theme support

## Configuration
- **Host Configuration**: Properly configured for Replit with `allowedHosts: true`
- **Port**: Frontend and backend served on port 5000
- **Storage**: Using in-memory storage (no database needed currently)
- **Python**: Managed with uv package manager for scraping dependencies
- **Article 4 API**: Requires `ARTICLE4MAPS_API_KEY` environment variable (production critical)

## User Preferences
- No specific user preferences documented yet

## Development Setup
- Workflow: `npm run dev` serves both frontend and backend
- Build: `npm run build` creates production build
- Database: `npm run db:push` for schema changes (if database used)
- Type Checking: `npm run check` for TypeScript validation

## Data Sources
- Cached property data from multiple UK cities including London, Manchester, Birmingham (11,486+ properties)
- Article 4 direction data from Article4Maps API (https://article4map.com/information/api)
  - Coverage: All 307 English councils
  - Daily monitoring and updates
  - 99.9% accuracy
- Real-time property scraping capabilities with Python services