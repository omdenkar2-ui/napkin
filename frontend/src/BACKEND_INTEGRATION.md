# Backend Integration Guide

## Overview
The frontend is fully built with mock data. To connect to the backend, follow this guide.

## Setup
1. Set `NEXT_PUBLIC_API_URL` in `.env.local` to your backend URL (default: http://localhost:8000)
2. All API hooks are in `src/hooks/use-api.ts`
3. All TypeScript types are in `src/types/api.ts`

## How to connect a page to real data

Each page currently uses hardcoded mock data. To switch to real data:

1. Import the appropriate hook from `src/hooks/use-api.ts`
2. Change `enabled: false` to `enabled: true` in the hook
3. Replace the mock data with the hook's `data` property
4. Use the hook's `isLoading` to show the skeleton component
5. Use `!data?.length` to show the empty state component

Example for Sessions page:
```tsx
// Before (mock data)
const sessions = [{ id: '1', name: 'Weekly Analysis', ... }];

// After (real data)
const { data: sessions, isLoading } = useSessions();
// Change enabled: false to enabled: true in use-api.ts
if (isLoading) return <SessionsSkeleton />;
if (!sessions?.length) return <SessionsEmpty />;
```

## API Endpoints Required

### Dashboard
- GET /api/dashboard/stats -> DashboardStats
- GET /api/activity -> ActivityItem[]

### Sessions
- GET /api/sessions -> PlatformSession[]
- GET /api/sessions/:id -> PlatformSession (with patterns and evidence)
- POST /api/sessions -> Create new session (accepts sources, files, options)
- POST /api/sessions/:id/chat -> Send chat message, returns AI response

### Tasks
- GET /api/tasks?status=&priority=&assignee= -> PlatformTask[]
- PATCH /api/tasks/:id -> Update task (title, description, assignee, priority, status)
- POST /api/tasks/send -> Send approved tasks to Linear/Sheets

### Workflows
- GET /api/workflows -> Workflow[]
- GET /api/workflows/:id -> Workflow
- POST /api/workflows -> Create workflow
- PUT /api/workflows/:id -> Update workflow
- DELETE /api/workflows/:id -> Delete workflow
- POST /api/workflows/:id/run -> Trigger workflow manually

### Integrations
- GET /api/integrations -> Integration[]
- POST /api/integrations/connect -> Start OAuth flow for a source
- POST /api/integrations/:id/sync -> Trigger manual sync
- DELETE /api/integrations/:id -> Disconnect source

### Team
- GET /api/team -> WorkspaceMember[]
- POST /api/team/invite -> Send invitation email
- PATCH /api/team/:id -> Update member role
- DELETE /api/team/:id -> Remove member

### File Upload
- POST /api/upload -> Upload file (multipart/form-data), returns PlatformUploadedFile

### Auth (already handled by Supabase)
- Supabase handles auth -- frontend uses @supabase/ssr
- Backend should verify Supabase JWT tokens on each request
- User ID and workspace ID come from the JWT

## Skeleton & Empty State Components
Every page has pre-built skeleton and empty state components. They are already imported in each page file -- just use them when switching from mock to real data.

## Real-time Updates
For session processing status, use polling:
```tsx
useQuery({
  queryKey: ['session', id],
  queryFn: () => apiFetch(`/api/sessions/${id}`),
  refetchInterval: (data) => data?.status === 'processing' ? 3000 : false,
});
```

## Toast Notifications
Use Sonner for all user feedback:
```tsx
import { toast } from 'sonner';
toast.success('Tasks sent to Linear');
toast.error('Failed to create session');
```
