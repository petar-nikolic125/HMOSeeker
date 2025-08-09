# HMO Hunter

A comprehensive UK property investment analysis platform focused on HMO (House of Multiple Occupation) opportunities.

## Features

- Real-time property listings from multiple UK portals
- Advanced investment analytics and ROI calculations
- HMO rental yield projections
- Bridging finance modeling
- Comprehensive property analysis dashboard

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Scraping**: Python with BeautifulSoup4
- **State Management**: TanStack Query
- **Deployment**: Railway-ready with Nixpacks

## Railway Deployment

This application is optimized for Railway deployment with:

- Automatic builds via Nixpacks
- Health check endpoint at `/health`
- Python dependencies management
- Production-ready configuration

### Environment Variables

Required for production:

```bash
DATABASE_URL=postgresql://...
NODE_ENV=production
PORT=5000
```

### Deployment Commands

The application includes Railway-specific configurations:

- `Procfile` for process management
- `railway.toml` for deployment settings
- `nixpacks.toml` for build configuration

## Development

```bash
npm install
npm run dev
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/properties` - Get cached property listings
- `GET /api/search` - Search properties with filters
- `POST /api/scrape` - Start property scraping
- `GET /api/properties/:id/analysis` - Property investment analysis

## License

MIT