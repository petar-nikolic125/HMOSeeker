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

### October 19, 2025 - Postcode Autocomplete & City/Address Radius Search
- ✅ **Postcode autocomplete**: Shows outcode suggestions (e.g., "M7" when typing "M7 3PG")
- ✅ **City name support**: Radius search now works with city names (e.g., "5 miles from Manchester")
- ✅ **Address support**: Radius search accepts full addresses via Nominatim geocoding
- ✅ **Rate limiting**: Respects Nominatim's 1 req/sec policy with built-in throttling
- ✅ **Smart debouncing**: 1.5s delay for location searches, 300ms for other filters
- ✅ **Geocoding APIs**: Uses postcodes.io for UK postcodes, Nominatim (OSM) for cities/addresses
- ✅ **Performance**: Caches all geocoding results, limits radius searches to 100 properties
- ✅ **UI improvements**: Updated label to "Postcode or City", new placeholder text

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
- **Geocoding Services**: 
  - postcodes.io for UK postcodes (free, no key needed)
  - Nominatim (OpenStreetMap) for city names and addresses (rate-limited to 1 req/sec)
  - Intelligent caching and rate limiting
- **Article 4 Service**: Article4Maps API integration (single source of truth, 99.9% accuracy)
- **Services**: Property analysis, cache management, postcode geocoding
- **APIs**: RESTful endpoints for property search, analysis, and postcode suggestions

### Shared (`shared/`)
- **Schema**: Drizzle database schema with Zod validation
- **Types**: Shared TypeScript types between frontend and backend

## Key Features
1. **Property Search**: Multi-city property search with price and bedroom filters
2. **Radius Search**: Distance-based search supporting postcodes (M7, SW1A 1AA), city names (Manchester), and addresses
3. **Postcode Autocomplete**: Smart suggestions showing outcodes when typing full postcodes
4. **Article 4 Checking**: Real-time HMO licensing restriction checks via Article4Maps API (99.9% accuracy)
5. **Investment Analysis**: Rental yield calculations and property analysis
6. **Data Caching**: Extensive property data cached from PrimeLocation and other sources
7. **Responsive UI**: Modern interface with dark/light theme support

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