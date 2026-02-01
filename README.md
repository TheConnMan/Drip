# Drip

AI-powered micro-learning platform that generates personalized bite-sized lessons using Claude AI.

## Local Development

```bash
# Start postgres
npm run db:local

# Apply database schema
npm run db:push

# Add your Anthropic API key
echo "AI_INTEGRATIONS_ANTHROPIC_API_KEY=sk-ant-..." > .env

# Start dev server
npm run dev
```

App runs at http://localhost:5000. Auth is bypassed locally (auto-login as test user).

## Stack

- **Frontend**: React 18, Vite, Wouter, TanStack Query, shadcn/ui, Tailwind
- **Backend**: Express 5, TypeScript, Drizzle ORM
- **Database**: PostgreSQL
- **AI**: Anthropic Claude API

## How It Works

1. User enters a topic
2. AI asks clarifying questions if needed
3. AI generates course outline for user approval
4. Lessons are generated on-demand as user accesses them
5. User feedback influences subsequent lesson generation
