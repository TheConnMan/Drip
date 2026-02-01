# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Start Express + Vite dev server (port 5000)
npm run db:local         # Start/restart local postgres docker container
npm run db:push          # Apply Drizzle schema to database

# Production
npm run build            # Bundle client (Vite) + server (esbuild)
npm run start            # Run production server

# Checks
npm run check            # TypeScript type checking
```

## Architecture

Full-stack TypeScript monorepo with three layers:
- `client/` - React 18 frontend (Vite, Wouter routing, TanStack Query, shadcn/ui)
- `server/` - Express 5 backend (Drizzle ORM, Passport.js auth)
- `shared/` - Database schema and types (imported by both)

### Key Entry Points
- `server/index.ts` - Express app setup, middleware, route registration
- `server/routes.ts` - All `/api/*` endpoints
- `server/storage.ts` - DatabaseStorage class implementing IStorage interface
- `client/src/App.tsx` - React router and query client setup
- `shared/schema.ts` - Drizzle ORM schema with Zod validation

### Path Aliases
- `@/` maps to `client/src/`
- `@shared/` maps to `shared/`

### Database
PostgreSQL with Drizzle ORM. Schema in `shared/schema.ts`, config in `drizzle.config.ts`.

Core tables: `courses`, `lessons`, `lesson_progress`, `lesson_feedback`, `topic_expansions`, `course_research`, `users`, `sessions`

### Authentication
- **On Replit**: OpenID Connect via Replit Auth (requires `REPL_ID` env var)
- **Local dev**: When `REPL_ID` is not set, auth is bypassed with auto-login as test user

### Environment Variables
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` - Required for lesson generation (Claude API)
- `PERPLEXITY_API_KEY` - Optional, enables deep research grounding for courses

Database URL and session secret have sensible defaults for local dev.

### Lesson Generation Pattern
Lessons are generated on-demand when accessed, not upfront:
1. Course build creates lessons with "PENDING_GENERATION" content
2. GET `/api/lessons/:id` triggers background Claude API call
3. Frontend polls every 2 seconds until content is ready
4. Race condition protection prevents duplicate API calls

User feedback from previous lessons is included in prompts for subsequent lesson generation.

### Perplexity Deep Research
When `PERPLEXITY_API_KEY` is configured, course creation triggers async deep research:
1. Course build creates a `course_research` record with "pending" status
2. Background job calls Perplexity `sonar-deep-research` model (5 min timeout)
3. Research content and citations are stored when complete
4. Lesson generation includes research context with citation notation [1], [2], etc.
5. Frontend can poll `/api/courses/:id/research` to check research status

Key files:
- `server/perplexity.ts` - Perplexity API client and research formatting
- `shared/schema.ts` - `courseResearch` table with JSONB citations
