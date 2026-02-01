# Drip - AI-Powered Micro-Learning Platform

## Overview

Drip is a full-stack web application that provides AI-powered micro-learning experiences. Users can request any topic, and the system generates personalized bite-sized lessons using Claude AI (Anthropic). The platform tracks learning progress, allows topic expansion within lessons, and provides a complete course management system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (dark mode default)
- **Build Tool**: Vite with React plugin

The frontend follows a page-based structure under `client/src/pages/` with reusable components in `client/src/components/ui/`. Path aliases are configured (`@/` for client source, `@shared/` for shared code).

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Structure**: RESTful endpoints under `/api/`
- **Authentication**: Replit Auth (OpenID Connect) with Passport.js
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple

The server uses a modular structure with routes registered in `server/routes.ts` and specialized integrations in `server/replit_integrations/` for auth, chat, and batch processing.

### Database Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Drizzle Kit (`drizzle-kit push` for development)

Key tables:
- `courses` - User courses with progress tracking and archive status
- `lessons` - Individual lessons within courses
- `lesson_progress` - Per-user completion status
- `lesson_feedback` - User feedback that influences future lesson generation
- `topic_expansions` - AI-generated deep dives on specific topics
- `users` and `sessions` - Authentication (required for Replit Auth)

### AI Integration
- **Provider**: Anthropic Claude via `@anthropic-ai/sdk`
- **Features**: Course generation, topic expansion within lessons
- **Batch Processing**: Utility module for rate-limited parallel AI requests with retry logic

### Course Creation Flow
The app uses a conversational process for course creation:
1. **Clarifying Questions** - For vague topics (e.g., "marketing"), AI asks clarifying questions first
2. **Preview** - Once topic is specific enough, AI generates an outline preview with title, description, and session topics
3. **Feedback** - User can request changes (e.g., "add more practical examples"), AI regenerates the outline
4. **Build** - Once satisfied, user clicks "Build Course" to create the course

API Endpoints:
- `POST /api/courses/preview` - Generates clarifying questions or outline based on topic specificity
- `POST /api/courses/build` - Create course from approved outline (lessons created with placeholder content)
- `DELETE /api/courses/:id` - Delete a course
- `POST /api/courses/:id/archive` - Archive a course
- `POST /api/courses/:id/unarchive` - Restore an archived course

### Lesson Generation
Lessons are generated **on-demand** when the user accesses them (not upfront). This provides:
- Faster course creation (no waiting for all lessons)
- Personalized content based on user feedback from previous lessons

The generation flow:
1. User opens a lesson → API returns immediately with "PENDING_GENERATION" status
2. Frontend shows "Generating your lesson..." with a spinner
3. Content generates in the background (using Claude AI)
4. Frontend polls every 2 seconds until content is ready
5. Once generated, content replaces the loading state

Each lesson includes professional content with a "Further Reading" section containing 2-3 credible references.

Note: The "5 minutes to read" estimate is hardcoded (defaulted to 5 in the schema), not calculated based on content length.

The feedback system allows users to influence future lesson generation:
- `POST /api/lessons/:id/feedback` - Submit feedback after completing a lesson
- Feedback is stored directly on the lesson (`userFeedback` column) and displayed at the bottom of the lesson page
- Users can view and edit their feedback via a pencil icon
- Recent feedback from previous lessons is included in prompts when generating subsequent lessons

### Development vs Production
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Static file serving from `dist/public`, bundled server in `dist/index.cjs`
- **Build Process**: Custom script using esbuild for server, Vite for client

## External Dependencies

### AI Services
- **Anthropic Claude API**: Used for generating courses and expanding lesson topics
  - Configured via `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` environment variables

### Database
- **PostgreSQL**: Primary data store
  - Connection via `DATABASE_URL` environment variable
  - Required for user data, courses, lessons, progress tracking, and session storage

### Authentication
- **Replit Auth (OpenID Connect)**: User authentication
  - Configured via `ISSUER_URL` (defaults to Replit's OIDC endpoint)
  - Requires `SESSION_SECRET` for session encryption
  - Uses `REPL_ID` for client identification

### Object Storage (Audio)
- **Replit Object Storage**: Used for storing lesson audio files (GCS-backed)
  - Configured via `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR`
  - Audio files stored with key pattern: `audio/lesson-{id}.mp3`
  - Integration module at `server/replit_integrations/object_storage/`
  - Audio wrapper at `server/objectStorage.ts` providing `uploadAudio()`, `downloadAudio()`, `deleteAudio()`
  - Local fallback to `.local-audio/` directory when running outside Replit

### Key npm Packages
- `express` - Web server framework
- `drizzle-orm` + `pg` - Database access
- `passport` + `openid-client` - Authentication
- `@tanstack/react-query` - Client-side data fetching
- `react-markdown` - Lesson content rendering
- `p-limit` + `p-retry` - Batch processing utilities
- `@google-cloud/storage` - GCS client for object storage

### PWA Support
The app is installable as a Progressive Web App:
- `client/public/manifest.json` - App manifest with name, icons, theme colors
- `client/public/sw.js` - Service worker caching static assets only (not API calls)
- `client/public/pwa-192.png` and `pwa-512.png` - App icons
- Service worker registration in `client/index.html`

To install on Android: Open in Chrome → Menu → "Add to Home Screen"

### Background Lesson Pre-generation
When a course is built, the first lesson is automatically generated in the background:
- Course build API returns immediately after creating lessons
- First lesson generation starts in background (fire and forget)
- Race condition protection prevents duplicate Claude API calls

### Database Schema Sync
The app includes automatic schema synchronization on startup (`server/db.ts: ensureSchemaSync()`). When the server starts, it checks for required columns and adds them if missing. This ensures production databases stay in sync after deployments.

**Automatic migration for required columns:**
- `courses.icon_url` - text, auto-added if missing
- `courses.icon_generated_at` - timestamp, auto-added if missing

**Manual steps (if auto-migration fails due to permissions):**
```sql
ALTER TABLE courses ADD COLUMN icon_url text;
ALTER TABLE courses ADD COLUMN icon_generated_at timestamp;
```

**Adding new columns to the schema:**
1. Update the schema in `shared/schema.ts`
2. Add column check to `ensureSchemaSync()` in `server/db.ts` for production compatibility
3. Run `npm run db:push` to sync the development database
4. Deploy to apply changes to production