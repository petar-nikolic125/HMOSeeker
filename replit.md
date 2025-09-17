# HMO Hunter - Property Investment Analysis Tool

## Overview
HMO Hunter is a full-stack property investment analysis application built with React, TypeScript, Express, and integrated with property data scraping capabilities. The application helps users find and analyze HMO (House in Multiple Occupation) investment opportunities in UK cities.

## Current State
- ✅ Application successfully running on port 5000
- ✅ Frontend: React with TypeScript, Vite dev server, Tailwind CSS, shadcn/ui components
- ✅ Backend: Express server with TypeScript, Python integration for scraping
- ✅ Data: Currently using in-memory storage with extensive cached property data from multiple UK cities
- ✅ Features: Property search, filtering, Article 4 area checking, rental yield analysis

## Recent Changes (September 17, 2025)
- Successfully imported GitHub project and configured for Replit environment
- Fixed tsx execution runtime issue and npm dependencies
- Configured workflow with webview output type for frontend on port 5000
- Verified Vite configuration properly allows all hosts (`allowedHosts: true`)
- Python dependencies installed and working with uv package manager
- Application serving cached property data from London, Manchester, Birmingham, Liverpool, Leeds and other UK cities
- Enhanced Article 4 checking system with comprehensive database schema and multi-source integration
- Integrated article4map.com/information/api for 99.9% accurate Article 4 direction coverage across all 307 English councils

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
- **Services**: Article 4 area checking, property analysis, cache management
- **APIs**: RESTful endpoints for property search and analysis

### Shared (`shared/`)
- **Schema**: Drizzle database schema with Zod validation
- **Types**: Shared TypeScript types between frontend and backend

## Key Features
1. **Property Search**: Multi-city property search with price and bedroom filters
2. **Article 4 Checking**: Automatic checking of HMO licensing restrictions
3. **Investment Analysis**: Rental yield calculations and property analysis
4. **Data Caching**: Extensive property data cached from PrimeLocation and other sources
5. **Responsive UI**: Modern interface with dark/light theme support

## Configuration
- **Host Configuration**: Properly configured for Replit with `allowedHosts: true`
- **Port**: Frontend and backend served on port 5000
- **Storage**: Using in-memory storage (no database needed currently)
- **Python**: Managed with uv package manager for scraping dependencies

## User Preferences
- No specific user preferences documented yet

## Development Setup
- Workflow: `npm run dev` serves both frontend and backend
- Build: `npm run build` creates production build
- Database: `npm run db:push` for schema changes (if database used)
- Type Checking: `npm run check` for TypeScript validation

## Data Sources
- Cached property data from multiple UK cities including London, Manchester, Birmingham
- Article 4 area data from planning.data.gov.uk
- article4map.com/information/api - Comprehensive Article 4 direction data covering all 307 English councils with daily monitoring
- Real-time property scraping capabilities with Python services