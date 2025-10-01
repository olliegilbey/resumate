# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Resumate is an intelligent resume curation system that can be used as a personal portfolio site. The project is currently in **Phase 1 MVP - COMPLETE AND FUNCTIONAL** with a beautiful data explorer showing all resume experience in a filterable, searchable interface.

## Current Status (Updated 2025-09-30)

**Phase 1 MVP is COMPLETE:**
- ✅ Landing page at `/` with hero, contact links, and about section
- ✅ Resume download page at `/resume` with stats and Resumate explanation
- ✅ Full data explorer at `/resume/view` with search, tag filtering, company grouping
- ✅ All 60+ experience bullets from 6 companies loaded
- ✅ Responsive design with slate/blue aesthetic
- ✅ TypeScript types and data structure fully implemented

**Completed:**
1. ✅ Navigation bar on all pages
2. ✅ Contact links (LinkedIn, GitHub only - email/phone hidden)
3. ✅ Downloadable contact card with Cloudflare Turnstile protection
4. ✅ Environment variables for sensitive data (.env.local)

**Next Steps:**
1. Test download functionality thoroughly
2. Get real Cloudflare Turnstile keys
3. Deploy to Vercel or preferred hosting
4. Add resume PDF (optional)

## Technology Stack

- **Framework**: Next.js 15.5.4 with App Router
- **Runtime**: React 19.1.0
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4 with PostCSS
- **Build Tool**: Turbopack (Next.js's new bundler)
- **Icons**: Lucide React
- **Utilities**: clsx, tailwind-merge (cn utility)
- **Fonts**: Geist Sans and Geist Mono from next/font/google
- **Linting**: ESLint 9 with Next.js configuration

## Development Commands

### Essential Commands
```bash
# Start development server with Turbopack
npm run dev

# Build for production with Turbopack
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint
```

### Development Server
The development server runs on http://localhost:3000 with Turbopack enabled for faster builds and hot reloading.

## Architecture & Structure

### App Router Structure
The project uses Next.js App Router with the following structure:

```
app/
├── layout.tsx          # Root layout with fonts and metadata
├── page.tsx            # Home page component
├── globals.css         # Global styles with Tailwind and custom properties
└── favicon.ico         # Favicon

public/                 # Static assets (SVG icons)
```

### Key Architectural Decisions

1. **App Router**: Uses the modern Next.js App Router (not Pages Router)
2. **Turbopack Integration**: Both dev and build scripts use `--turbopack` flag for improved performance
3. **Font Optimization**: Uses `next/font/google` for automatic font optimization with Geist fonts
4. **CSS Architecture**: 
   - Tailwind CSS v4 with new `@import "tailwindcss"` syntax
   - CSS custom properties for theming (`--background`, `--foreground`)
   - Automatic dark mode support via `prefers-color-scheme`
5. **TypeScript Paths**: Configured with `@/*` alias pointing to root directory

### Configuration Files

- **TypeScript**: ES2017 target with strict mode, Next.js plugin enabled
- **ESLint**: Flat config format with Next.js core-web-vitals and TypeScript rules
- **PostCSS**: Minimal config using `@tailwindcss/postcss` plugin
- **Next.js**: Default configuration with TypeScript support

### Styling System

The project uses Tailwind CSS v4 with a custom theming approach:
- CSS custom properties for colors (`--background`, `--foreground`)
- Font variables for Geist Sans and Mono fonts
- Automatic dark/light mode switching
- Inline theme configuration using `@theme inline` directive

## Development Notes

### Tailwind CSS v4
This project uses the latest Tailwind CSS v4 which has a new import syntax (`@import "tailwindcss"`) and inline theme configuration.

### Turbopack
All build commands use Turbopack (`--turbopack` flag) for faster development and production builds.

### Font Loading
The project uses optimized Google Fonts (Geist) loaded via `next/font/google` with proper variable font setup.

### ESLint Configuration
Uses the new flat config format (eslint.config.mjs) with Next.js recommended rules and TypeScript support.