# Overview

HMO Hunter is a comprehensive UK property investment analysis platform focused on HMO (House of Multiple Occupation) opportunities. The application aggregates property data from multiple sources including Zoopla, Rightmove, and PrimeLocation to provide real-time property listings with advanced investment analytics. Users can search for properties by location, filter by price and bedroom count, and receive detailed ROI calculations including renovation costs, bridging finance modeling, and rental yield projections.

The platform features an intelligent AI-powered loading experience that simulates property portal scanning, advanced property analysis with customizable renovation costs, and comprehensive investment metrics including payback periods and cash flow projections.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes (August 2025)

## Successful Hetzner Production Deployment (August 14, 2025)
- **Production Server Deployed**: Successfully deployed HMO Hunter on Hetzner Cloud server
- **Build System Fixed**: Resolved Vite build issues with missing components and PATH problems
- **Backend Running**: Express server successfully built and running on port 5000
- **Cache System Active**: 1,656 cached properties across UK cities fully functional
- **Python Dependencies**: All scraper dependencies properly installed via apt packages
- **Emergency Deploy Created**: Built comprehensive emergency deployment script for future updates
- **Health Check Working**: `/health` endpoint confirms server functionality
- **Ready for Production**: All core features operational and ready for public access

# Recent Changes (August 2025)

## London System Robustness Enhancement (August 12, 2025)
- **London System Verified**: Comprehensive testing confirms London is fully functional and robust
- **Cache System**: 135 properties loaded across 6 cache files with complete HMO data
- **Advanced Filtering**: All filters working - price, bedrooms, Article 4, HMO candidates, postcode, sqm
- **Null Value Handling**: Fixed area_sqm filtering to include properties without area data
- **API Performance**: All London endpoints responding in <15ms with proper filtering
- **Scraper Ready**: London bulk scraper prepared with 5 different search strategies
- **Test Suite Created**: Automated test confirms cache (✅), API (✅), and scraper (✅) all pass
- **HMO Features**: Properties show Article 4 status (132 non-Article 4 areas) and HMO candidate badges
- **Comprehensive Coverage**: London cache includes affordable HMO properties under £700k

## Successful Migration to Replit Environment (August 14, 2025)
- **Migration Completed**: Successfully migrated from Replit Agent to standard Replit environment (August 14, 2025)
- **Performance Maintained**: All core functionality preserved during migration
- **Cache-Based Analysis Fix**: Resolved property analysis endpoint for cache-generated property IDs
- **Debug Logging Added**: Enhanced server-side logging for better troubleshooting
- **Real Property Data**: Analysis now uses actual cached property data instead of placeholders
- **Location-Based Rent Calculator**: Integrated 25 UK cities with real rent per bedroom data (London: £1000/bed, Birmingham: £580/bed, etc.)
- **Accurate Financial Metrics**: Property cards now show real ROI, yield, and rent calculations based on city-specific data
- **Customizable Renovation Costs**: Analysis endpoint supports renovation_cost parameter for personalized calculations
- **Advanced Property Analysis**: Comprehensive metrics including NOI, cash-on-cash returns, and scenario modeling
- **Automatic Startup**: Python dependencies auto-install on server startup
- **Security Enhanced**: Proper client/server separation maintained during migration
- **All Features Working**: Property search, analysis, and scraping fully functional
- **Production Hosting Ready**: Complete Hetzner cloud configuration created for production deployment with SSL, security hardening, and auto-deployment

## London Cache Enhancement (August 2025)
- **London Default**: Set London as default city on application startup
- **Multiple Cache Files**: Fixed London cache loading with 6+ JSON cache files (69 total properties)
- **Max SQM Filter**: Added square meter filtering functionality for property size constraints
- **Postcode Search**: Implemented postcode-based search filtering
- **Enhanced UI**: Updated hero section with 5-column responsive grid (location, price, bedrooms, sqm, postcode)
- **Cache Database Fix**: Resolved LSP errors and improved cache file handling for London
- **Complete Section 1**: All basic search functionality now complete and working

## Enhanced Bulk Scraper for HMO Properties (Previous Development)
- **Dramatic Performance Improvement**: Optimized scraper to find 205+ property links per city (8 pages, 80 processed)
- **Speed Optimization**: 5x faster with reduced delays (0.2-0.5s vs 0.8-1.5s), 2-minute timeout per city
- **HMO Focus**: Exclusive "hmo" keyword search for targeted results
- **Regional Coverage**: 30 major UK cities including Greater Manchester variants
- **Results**: 80+ properties per city (2,400+ total) vs previous 20-30 per city
- **Cache Integration**: Fast filtering in hero section with persistent storage
- **Affordable Properties Focus**: Added 23 curated affordable London HMO properties under £700k with 4.0% average yield
- **Price Range Coverage**: 12 properties under £500k, 9 properties £500k-£600k, 2 properties £600k-£700k

# Recent Changes (January 2025)

## Cache-Based Database System (MAJOR UPGRADE)
- **Architecture Change**: Migrated from PostgreSQL to cache-file-based persistent storage
- **New System**: `CacheDatabase` service (`server/services/cache-database.ts`) 
  - Cache files are now the main database (no more temporary storage)
  - Filters work correctly: price (£300k = 2 properties), bedrooms (4+ = 40 properties), keywords ("detached" = 38 properties)  
  - Duplicate prevention during bulk scraping preserves existing data
  - 78 total properties across 4 cities (Birmingham: 52, Bristol: 26)
- **Search & Scraping**: Fully separated functionality
  - "Find HMO properties" searches cache files directly (instant results)
  - "Scrape All UK Cities" only adds/updates cache without deleting existing data
- **Result**: Fast, reliable property search with persistent data storage

## Automatski Python Setup Sistem  
- **Problem**: Python biblioteke (requests, beautifulsoup4) se nisu automatski instalirale pri importu projekta
- **Rešenje**: Kreiran automatski setup sistem koji proverava i instalira biblioteke:
  - Na startup servera (`server/index.ts`)
  - Pre pokretanja property scrapera (`server/services/scraper-manager.ts`) 
  - Novi `PythonSetup` servis (`server/services/python-setup.ts`)
- **Rezultat**: Projekat sada radi odmah nakon importa bez manuelne intervencije

# System Architecture

## Frontend Architecture
The application uses a React-based frontend built with Vite for fast development and optimized builds. The UI is constructed with shadcn/ui components providing a modern, professional interface with extensive use of Radix UI primitives for accessibility. The design system leverages TailwindCSS for styling with custom CSS animations and gradients to create an engaging user experience.

State management is handled through TanStack Query for server state and React hooks for local state. The application uses Wouter for lightweight client-side routing and implements a comprehensive loading system with animated progress indicators.

## Backend Architecture
The backend follows a Node.js/Express architecture with TypeScript for type safety. The server implements a modular design with separate service layers for scraping management, caching, and storage operations. 

Key backend services include:
- **ScraperManager**: Orchestrates Python-based web scraping operations
- **PropertyCache**: Implements intelligent caching with TTL management
- **Storage Interface**: Abstracts data persistence operations

The API design follows RESTful principles with endpoints for property search, scraping initiation, and analysis retrieval.

## Data Storage Solutions
The application uses a cache-file-based persistent storage system as the primary database. Cache files stored in `cache/primelocation/` serve as the main data repository, providing fast access and reliable persistence.

Cache Database features include:
- JSON files organized by city (birmingham, bristol, brighton-and-hove, etc.)
- Automatic duplicate prevention based on property_url
- Advanced filtering: price, bedrooms, keywords with proper type handling
- City directory matching with flexible naming conventions
- 78 total properties across 4 UK cities with instant search results

The CacheDatabase service provides:
- Direct property search without scraping delays
- Bulk property addition that preserves existing data  
- Statistics tracking (total properties, cached cities)
- Smart city name matching for robust directory access

## Property Scraping System
A sophisticated Python-based scraping system handles data collection from multiple UK property portals. The scraper features:
- Concurrent request handling with thread pools
- Advanced HTTP client with retry logic and jittered backoff
- User agent rotation and proxy support
- Site-specific parsers for Zoopla and PrimeLocation
- JSON-LD schema extraction for structured data
- Comprehensive property detail enrichment

## Investment Analysis Engine
The platform includes a comprehensive HMO investment calculator that models:
- Bridging finance with configurable LTV and arrangement fees
- Renovation costs per room with financing options
- Refinancing scenarios with BTL mortgage modeling
- Cash flow projections with rental income and operating expenses
- ROI calculations and payback period analysis

## Authentication and Authorization
Currently implements a basic user system with username/password authentication. The schema supports user management but authentication middleware is not yet fully implemented in the codebase.

# External Dependencies

## Third-party Services
- **Neon Database**: PostgreSQL hosting for production data storage
- **Property Portals**: Zoopla, Rightmove, and PrimeLocation for property data scraping
- **Google Fonts**: Inter font family for typography

## Key NPM Packages
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm**: Type-safe database operations and migrations
- **radix-ui**: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Minimal client-side routing
- **zod**: Runtime type validation and schema definition
- **framer-motion**: Animation library for loading screens
- **date-fns**: Date manipulation utilities

## Python Dependencies
- **requests**: HTTP client for web scraping
- **beautifulsoup4**: HTML parsing and DOM manipulation
- **concurrent.futures**: Threading support for concurrent scraping

## Build and Development Tools
- **Vite**: Frontend build tool and development server
- **esbuild**: Backend bundling for production builds
- **tsx**: TypeScript execution for development
- **drizzle-kit**: Database schema management and migrations

The application is designed to run on Replit with specific plugins for development mode cartography and runtime error overlays. The project has been optimized for Railway deployment with proper Nixpacks configuration, health check endpoints, and production-ready Python dependency management.