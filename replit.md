# Overview
HMO Hunter is a comprehensive UK property investment analysis platform specializing in HMO (House of Multiple Occupation) opportunities. It aggregates real-time property listings from sources like Zoopla, Rightmove, and PrimeLocation, providing advanced investment analytics. Key capabilities include location-based property search, filtering by price and bedrooms, and detailed ROI calculations encompassing renovation costs, bridging finance modeling, and rental yield projections. The platform features an intelligent AI-powered loading experience simulating property portal scanning, advanced property analysis with customizable renovation costs, and comprehensive investment metrics such as payback periods and cash flow projections.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is a React application built with Vite, utilizing `shadcn/ui` components (based on Radix UI) and styled with TailwindCSS. State management uses TanStack Query for server state and React hooks for local state. Wouter handles client-side routing, and Framer Motion is used for loading animations.

## Backend Architecture
The backend is a Node.js/Express application written in TypeScript, featuring a modular design. Key services include `ScraperManager` for orchestrating Python-based web scraping, `PropertyCache` for intelligent caching, and a `Storage Interface` for data persistence. The API follows RESTful principles.

## Data Storage Solutions
The primary data storage is a cache-file-based persistent system. JSON files, organized by city in `cache/primelocation/`, serve as the main data repository. This system supports automatic duplicate prevention, advanced filtering (price, bedrooms, keywords), and flexible city name matching.

## Property Scraping System
A sophisticated Python-based system scrapes property data from UK portals. It features concurrent requests, an advanced HTTP client with retry logic, user agent rotation, site-specific parsers (Zoopla, PrimeLocation), and JSON-LD schema extraction for data enrichment.

## Investment Analysis Engine
The platform includes a comprehensive HMO investment calculator. This engine models bridging finance (with configurable LTV and fees), renovation costs (per room, with financing options), refinancing scenarios (with BTL mortgage modeling), and comprehensive cash flow projections. It also performs detailed ROI calculations and payback period analysis.

## Authentication and Authorization
The system includes a basic user management schema for username/password authentication, though the authentication middleware is not fully implemented.

# External Dependencies

## Third-party Services
- **Property Portals**: Zoopla, Rightmove, and PrimeLocation (for data scraping)
- **Google Fonts**: Inter font family

## Key NPM Packages
- `@tanstack/react-query`
- `radix-ui`
- `tailwindcss`
- `wouter`
- `zod`
- `framer-motion`
- `date-fns`

## Python Dependencies
- `requests`
- `beautifulsoup4`
- `concurrent.futures`

## Build and Development Tools
- **Vite**
- **esbuild**
- **tsx**

# Recent Updates

## Migration to Replit Environment (August 17, 2025)
- **Migration Completed**: Successfully migrated HMO Hunter from Replit Agent to standard Replit environment
- **Dependencies Installed**: All required packages properly configured and working
- **Server Optimization**: Express server running smoothly on port 5000 with Python integration
- **Scraper Upgrade**: Integrated v2 scraper removing forced HMO keywords injection
- **Performance Improvements**: New scraper includes parallel detail fetching, improved link harvesting, and multi-sort optimization
- **Security Enhanced**: Proper client/server separation maintained throughout migration
- **Localization Fixed**: Replaced Serbian/Croatian text with English throughout frontend
- **Data Structure Resolved**: Fixed mismatch between API response format and frontend expectations
- **Console Logging**: Reduced verbose cache processing logs to prevent chat spam
- **Cache Management**: Cleared all cached property data and updated scraper settings
- **Scraper Configuration**: Updated MAX_PAGES from 12 to 30 for broader property coverage
- **Keywords Removed**: Eliminated HMO keyword filtering from bulk scraper for unrestricted property searches
- **Application Status**: Fully functional with property search, analysis, and investment calculations working

## Python Scraper Debugging (August 17, 2025)
- **Type Errors Fixed**: Resolved 15 LSP diagnostics in scraper.py related to BeautifulSoup element handling
- **Helper Function Added**: Created safe_get_attr() function for robust element attribute access
- **Timeout Increased**: Extended DEFAULT_TIMEOUT from 3 minutes to 10 minutes for bulk scraping
- **Resource Optimization**: Reduced max fetch from 400 to 100 properties and workers from 6 to 3
- **Scraper Stability**: Fixed crashes during property detail collection phase

## Previous Deployment (August 14, 2025)
- **Deployment Completed**: Successfully deployed HMO Hunter to Hetzner Cloud server at IP 188.34.176.15
- **ES Module Issues Resolved**: Fixed CommonJS/ES module conflicts by creating custom HTTP server bypassing Express
- **Production Server**: Created production-server.cjs with native Node.js HTTP module for stability