# Overview

HMO Hunter is a comprehensive UK property investment analysis platform focused on HMO (House of Multiple Occupation) opportunities. The application aggregates property data from multiple sources including Zoopla, Rightmove, and PrimeLocation to provide real-time property listings with advanced investment analytics. Users can search for properties by location, filter by price and bedroom count, and receive detailed ROI calculations including renovation costs, bridging finance modeling, and rental yield projections.

The platform features an intelligent AI-powered loading experience that simulates property portal scanning, advanced property analysis with customizable renovation costs, and comprehensive investment metrics including payback periods and cash flow projections.

# User Preferences

Preferred communication style: Simple, everyday language.

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
The application uses a flexible storage architecture with PostgreSQL as the primary database through Drizzle ORM. The schema defines tables for users, property listings, search queries, and cache entries.

Database features include:
- Property listings with comprehensive metadata (price, location, agent details, coordinates)
- Search query tracking with status management
- Cache entries with TTL support
- UUID primary keys for all entities

The storage layer implements an interface pattern allowing for easy testing with in-memory implementations.

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

The application is designed to run on Replit with specific plugins for development mode cartography and runtime error overlays.