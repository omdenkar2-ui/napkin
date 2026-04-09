# CLAUDE.md — Napkin Platform

> Instructions for Claude Code when working on the Napkin platform codebase.
> This repo contains BOTH frontend and backend code.

---

## Project Overview

**Napkin** is an AI agent for product teams that:
1. Extracts feedback from multiple sources (Slack, Intercom, Zoom, Typeform, Notion, email, spreadsheets)
2. Analyzes patterns, sentiment, and themes using AI
3. Generates actionable tasks for team members
4. Sends approved tasks to PM tools (Linear, Google Sheets, etc.)

---

## Codebase Structure

```
├── app/                    # Next.js App Router
│   ├── api/                # API routes (BACKEND — ignore design system)
│   ├── (auth)/             # Auth pages (login, signup, onboarding)
│   ├── (dashboard)/        # Main app pages (FRONTEND — follow design system)
│   └── layout.tsx          # Root layout
├── components/             # Shared UI components (FRONTEND)
│   ├── ui/                 # Base components (Button, Input, Card, etc.)
│   └── [feature]/          # Feature-specific components
├── lib/                    # Utilities
│   ├── supabase/           # Supabase client, auth helpers (BACKEND)
│   ├── api/                # API client functions (BACKEND)
│   └── utils/              # Shared utilities
├── .claude/
│   └── design-system-platform.md   # UI source of truth
├── public/                 # Static assets
└── tailwind.config.ts      # Tailwind configuration
```

---

## Critical Rules

### Rule 1: Read the design system first

Before making ANY frontend/UI change:
```
Read .claude/design-system-platform.md completely before making any changes.
```

### Rule 2: Frontend vs Backend

**Frontend** (follow design system):
- Any file that renders JSX/TSX
- Components, pages, layouts
- Styling, animations, UI logic
- Client-side data fetching hooks

**Backend** (ignore design system):
- `app/api/` routes
- Supabase functions, database queries
- Server actions, webhooks
- Cron jobs, background workers
- Type definitions for database schemas

### Rule 3: One change at a time

Never combine unrelated changes. Each prompt should result in ONE focused change:
- ✅ "Add the sidebar navigation component"
- ✅ "Create the feedback inbox page with filter bar"
- ❌ "Build the entire dashboard with all components"

### Rule 4: Component architecture

```
components/ui/           → Base primitives (Button, Input, Card, Badge, etc.)
                           Built with Radix + CVA + Tailwind
                           No business logic, fully reusable

components/[feature]/    → Feature components (FeedbackRow, TaskCard, etc.)
                           Compose ui/ components
                           May contain feature-specific logic

app/(dashboard)/[page]/  → Page components
                           Compose feature components
                           Handle data fetching via React Query
```

### Rule 5: Styling

```
✅ Use Tailwind CSS classes (utility-first)
✅ Use CSS variables for colors (--primary, --surface, etc.)
✅ Use CVA for component variants
✅ Use tailwind-merge + clsx for conditional classes
✅ Use Motion 12 for animations

❌ Never use inline style={{ }} objects
❌ Never hardcode color hex values in components
❌ Never use CSS modules or styled-components
❌ Never use arbitrary Tailwind values when a token exists
```

### Rule 6: Data fetching

```
✅ Use TanStack React Query for all server data
✅ Use Supabase client via lib/supabase
✅ Use optimistic updates for mutations
✅ Show skeleton loaders while loading

❌ Never use useEffect for data fetching
❌ Never show blank screens while loading
❌ Never block UI while mutations are in flight
```

### Rule 7: Accessibility

```
✅ Use Radix UI primitives for interactive components
✅ Every interactive element must be keyboard accessible
✅ Maintain 4.5:1 contrast for text
✅ Add aria-label to icon-only buttons
✅ Test with Tab key after every interactive component change
```

---

## File Naming Conventions

```
Components:     PascalCase.tsx          (Button.tsx, FeedbackRow.tsx)
Pages:          page.tsx                (Next.js convention)
Layouts:        layout.tsx              (Next.js convention)
Utilities:      camelCase.ts            (formatDate.ts, parseQuery.ts)
Types:          camelCase.types.ts      (feedback.types.ts)
Hooks:          use[Name].ts            (useFeedback.ts, useTeam.ts)
Constants:      UPPER_CASE in file      (const API_BASE = ...)
```

---

## Component Creation Checklist

When creating a new UI component:

1. Check if it exists in `components/ui/` first
2. Read the design system for the component spec
3. Use Radix primitive if the component needs accessibility (dialogs, menus, tabs, etc.)
4. Define variants with CVA
5. Use `forwardRef` for all base components
6. Export from `components/ui/index.ts`
7. Include TypeScript props interface
8. Test: keyboard navigation, focus states, dark mode, responsive

---

## Page Creation Checklist

When creating a new page:

1. Read the design system Page Patterns section for the page type
2. Create route in `app/(dashboard)/[page-name]/page.tsx`
3. Use the standard page layout: header bar + scrollable content
4. Implement loading state (skeleton) immediately
5. Implement empty state with guidance and CTA
6. Add page to sidebar navigation
7. Add Cmd+K command palette entry
8. Test: mobile responsive, keyboard navigation, loading state, empty state

---

## Environment

```
Node.js 20+
Package manager: npm (or pnpm if configured)
Dev server: next dev (port 3000)
Database: Supabase (hosted)
```

---

## Common Patterns

### Page header
```tsx
<div className="flex items-center justify-between h-14 px-8 border-b border-[--border]">
  <h1 className="text-lg font-semibold text-[--text-primary]">Page Title</h1>
  <Button variant="primary" size="default">Action</Button>
</div>
```

### Data fetching with React Query
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['feedback', filters],
  queryFn: () => fetchFeedback(filters),
});

if (isLoading) return <FeedbackSkeleton />;
if (!data?.length) return <EmptyState />;
return <FeedbackList items={data} />;
```

### Optimistic mutation
```tsx
const mutation = useMutation({
  mutationFn: updateTask,
  onMutate: async (newTask) => {
    await queryClient.cancelQueries({ queryKey: ['tasks'] });
    const prev = queryClient.getQueryData(['tasks']);
    queryClient.setQueryData(['tasks'], old => /* optimistic update */);
    return { prev };
  },
  onError: (err, vars, context) => {
    queryClient.setQueryData(['tasks'], context?.prev);
    toast.error('Failed to update task');
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
});
```

---

## What NOT to Do

```
❌ Don't rebuild existing components — check components/ui/ first
❌ Don't use useEffect for data fetching — use React Query
❌ Don't hardcode colors — use CSS variables
❌ Don't skip loading/empty states — always implement both
❌ Don't make AI actions auto-execute — always human-in-the-loop
❌ Don't ignore keyboard accessibility — test with Tab key
❌ Don't mix frontend and backend concerns in one component
❌ Don't use console.log in production code — use proper error handling
❌ Don't skip TypeScript types — every prop and function must be typed
```

---

## Verification

After every change, verify:
```bash
# Type check
npx tsc --noEmit

# Lint
npx eslint .

# Dev server works
npm run dev
```
