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

### Key npm Packages
- `express` - Web server framework
- `drizzle-orm` + `pg` - Database access
- `passport` + `openid-client` - Authentication
- `@tanstack/react-query` - Client-side data fetching
- `react-markdown` - Lesson content rendering
- `p-limit` + `p-retry` - Batch processing utilities