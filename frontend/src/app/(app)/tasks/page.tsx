"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { TaskActionBar } from "@/components/tasks/task-action-bar";
import { SendConfirmationModal } from "@/components/tasks/send-confirmation-modal";
import { TaskSkeleton } from "@/components/tasks/task-skeleton";
import { TaskEmpty } from "@/components/tasks/task-empty";
import { PageTransition } from "@/components/ui/page-transition";

type Priority = "p0" | "p1" | "p2" | "p3";
type Status = "pending" | "approved" | "sent" | "discarded";
type StatusTab = "all" | "pending" | "approved" | "sent";

interface Task {
  id: string;
  title: string;
  description: string;
  assignee: { id: string; name: string } | null;
  priority: Priority;
  status: Status;
  source_theme: string;
  evidence_count: number;
  labels: string[];
  created_at: string;
}

const MOCK_TASKS: Task[] = [
  {
    id: "task-1",
    title: "Fix photo upload crash on iOS",
    description: "**Context:** Users report that the photo upload feature crashes consistently on iOS 17+ devices. This affects approximately 23% of our mobile user base.\n\n**Acceptance Criteria:**\n- Photo uploads complete without crashes on iOS 17+\n- Support HEIF and JPEG formats\n- Upload progress indicator works correctly\n\n**Related Feedback:**\n> 'The mobile app crashes every time I try to upload a photo.' — Sarah Chen",
    assignee: { id: "u-2", name: "Sarah Chen" },
    priority: "p0",
    status: "pending",
    source_theme: "Mobile performance",
    evidence_count: 8,
    labels: ["bug", "mobile", "critical"],
    created_at: "2h ago",
  },
  {
    id: "task-2",
    title: "Improve app launch time by 40%",
    description: "**Context:** App launch time averages 4.2 seconds, significantly above the 2.5s target. Users frequently cite slow startup in feedback.\n\n**Acceptance Criteria:**\n- Cold start time under 2.5 seconds\n- Lazy load non-critical modules\n- Profile and optimize the critical rendering path",
    assignee: { id: "u-3", name: "Julian Torres" },
    priority: "p1",
    status: "pending",
    source_theme: "Mobile performance",
    evidence_count: 6,
    labels: ["performance", "mobile"],
    created_at: "2h ago",
  },
  {
    id: "task-3",
    title: "Add dark mode support",
    description: "**Context:** Dark mode is one of the most frequently requested features, mentioned by 14 users across multiple channels.\n\n**Acceptance Criteria:**\n- System-preference detection\n- Manual toggle in settings\n- All components render correctly in both modes",
    assignee: { id: "u-4", name: "Lisa Park" },
    priority: "p2",
    status: "pending",
    source_theme: "Search & filter",
    evidence_count: 14,
    labels: ["feature", "ui"],
    created_at: "3h ago",
  },
  {
    id: "task-4",
    title: "Redesign notification preferences",
    description: "**Context:** Users find the notification system too aggressive. 11 complaints about email frequency and lack of granular controls.\n\n**Acceptance Criteria:**\n- Per-channel notification controls\n- Digest mode option (daily/weekly summary)\n- Quiet hours setting",
    assignee: { id: "u-2", name: "Sarah Chen" },
    priority: "p1",
    status: "pending",
    source_theme: "Notifications",
    evidence_count: 11,
    labels: ["feature", "notifications"],
    created_at: "3h ago",
  },
  {
    id: "task-5",
    title: "Fix CSV export 500 error",
    description: "**Context:** CSV export returns a 500 error consistently. Multiple users blocked from exporting their data.\n\n**Acceptance Criteria:**\n- CSV export works for all data sizes\n- Proper error handling for edge cases\n- Progress indicator for large exports",
    assignee: { id: "u-3", name: "Julian Torres" },
    priority: "p0",
    status: "pending",
    source_theme: "API issues",
    evidence_count: 3,
    labels: ["bug", "export"],
    created_at: "Yesterday",
  },
  {
    id: "task-6",
    title: "Add tooltips to onboarding flow",
    description: "**Context:** Users report confusion at the integrations step during onboarding. Adding contextual tooltips would reduce drop-off.\n\n**Acceptance Criteria:**\n- Tooltips on each integration option\n- Skip option clearly visible\n- Progress indicator shows current step",
    assignee: { id: "u-4", name: "Lisa Park" },
    priority: "p2",
    status: "pending",
    source_theme: "Onboarding",
    evidence_count: 4,
    labels: ["ux", "onboarding"],
    created_at: "Yesterday",
  },
  {
    id: "task-7",
    title: "Implement SSO authentication",
    description: "**Context:** Enterprise prospects require SSO. This is a blocker for upgrading to team plans.\n\n**Acceptance Criteria:**\n- SAML 2.0 support\n- OIDC support\n- Admin SSO configuration panel",
    assignee: { id: "u-3", name: "Julian Torres" },
    priority: "p1",
    status: "approved",
    source_theme: "Enterprise",
    evidence_count: 5,
    labels: ["feature", "enterprise", "auth"],
    created_at: "2 days ago",
  },
  {
    id: "task-8",
    title: "Optimize analytics page queries",
    description: "**Context:** Analytics page loads slowly due to unoptimized database queries. Users notice 3-4 second delays.\n\n**Acceptance Criteria:**\n- Page load under 1.5 seconds\n- Add query caching\n- Implement pagination for large datasets",
    assignee: { id: "u-3", name: "Julian Torres" },
    priority: "p1",
    status: "approved",
    source_theme: "Mobile performance",
    evidence_count: 7,
    labels: ["performance", "backend"],
    created_at: "2 days ago",
  },
  {
    id: "task-9",
    title: "Add recurring task intervals",
    description: "**Context:** Users want the ability to set tasks on a recurring schedule with custom intervals.\n\n**Acceptance Criteria:**\n- Daily, weekly, monthly, and custom interval options\n- Calendar view of recurring tasks\n- Edit/pause/delete recurring schedules",
    assignee: { id: "u-2", name: "Sarah Chen" },
    priority: "p2",
    status: "pending",
    source_theme: "Feature requests",
    evidence_count: 9,
    labels: ["feature", "tasks"],
    created_at: "3 days ago",
  },
  {
    id: "task-10",
    title: "Reduce email notification frequency",
    description: "**Context:** Multiple users complain about excessive email notifications for minor updates.\n\n**Acceptance Criteria:**\n- Batch minor notifications into digest\n- Critical-only mode option\n- Unsubscribe from specific notification types",
    assignee: { id: "u-4", name: "Lisa Park" },
    priority: "p2",
    status: "pending",
    source_theme: "Notifications",
    evidence_count: 11,
    labels: ["feature", "notifications"],
    created_at: "3 days ago",
  },
  {
    id: "task-11",
    title: "Improve search result relevance",
    description: "**Context:** Search results don't surface the most relevant items. Users resort to manual scrolling.\n\n**Acceptance Criteria:**\n- Relevance-based ranking algorithm\n- Fuzzy matching support\n- Recent items boosted in results",
    assignee: null,
    priority: "p2",
    status: "pending",
    source_theme: "Search & filter",
    evidence_count: 6,
    labels: ["feature", "search"],
    created_at: "4 days ago",
  },
  {
    id: "task-12",
    title: "Update API rate limiting docs",
    description: "**Context:** API documentation for rate limiting is outdated. Developers are hitting unexpected limits.\n\n**Acceptance Criteria:**\n- Document current rate limits per endpoint\n- Add code examples for retry logic\n- Explain rate limit headers",
    assignee: { id: "u-5", name: "David Kim" },
    priority: "p3",
    status: "sent",
    source_theme: "API issues",
    evidence_count: 2,
    labels: ["docs", "api"],
    created_at: "5 days ago",
  },
];

export default function TasksPage() {
  const isLoading = false; // Will be replaced with React Query loading state
  const showEmpty = false;
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, Status>>({});
  const [showSendModal, setShowSendModal] = useState(false);

  const getStatus = useCallback((task: Task): Status => taskStatuses[task.id] ?? task.status, [taskStatuses]);

  const tasks = useMemo(() => {
    return MOCK_TASKS.map((t) => ({ ...t, status: getStatus(t) }));
  }, [getStatus]);

  const counts = useMemo(() => ({
    pending: tasks.filter((t) => t.status === "pending").length,
    approved: tasks.filter((t) => t.status === "approved").length,
    sent: tasks.filter((t) => t.status === "sent").length,
  }), [tasks]);

  const filtered = useMemo(() => {
    let result = tasks;
    if (activeTab !== "all") {
      result = result.filter((t) => t.status === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.source_theme.toLowerCase().includes(q) ||
          t.assignee?.name.toLowerCase().includes(q),
      );
    }
    return result;
  }, [tasks, activeTab, search]);

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null;

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    const allIds = filtered.map((t) => t.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  function handleApprove(id: string) {
    setTaskStatuses((prev) => ({ ...prev, [id]: "approved" }));
    toast.success("Task approved");
    if (activeTaskId === id) setActiveTaskId(null);
  }

  function handleDiscard(id: string) {
    setTaskStatuses((prev) => ({ ...prev, [id]: "discarded" }));
    toast.success("Task discarded");
    if (activeTaskId === id) setActiveTaskId(null);
  }

  function handleSendConfirm() {
    const ids = Array.from(selectedIds);
    const updates: Record<string, Status> = {};
    ids.forEach((id) => { updates[id] = "sent"; });
    setTaskStatuses((prev) => ({ ...prev, ...updates }));
    toast.success(`${ids.length} tasks sent to Linear`);
    setSelectedIds(new Set());
    setShowSendModal(false);
  }

  const selectedTasks = tasks.filter((t) => selectedIds.has(t.id));

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-0px)]">
        <div className="h-14 border-b border-[#E5E2DC] flex items-center px-8 shrink-0 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Tasks</h1>
        </div>
        <TaskSkeleton />
      </div>
    );
  }

  if (!isLoading && showEmpty) {
    return (
      <div className="flex flex-col h-[calc(100vh-0px)]">
        <div className="h-14 border-b border-[#E5E2DC] flex items-center px-8 shrink-0 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Tasks</h1>
        </div>
        <TaskEmpty />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 shrink-0 bg-[--background]">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
          Tasks
        </h1>
        <span className="text-[12px] font-medium text-[--text-muted]">
          {tasks.length} tasks · {counts.pending} pending review
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: filters + table + action bar */}
        <div className="flex-1 flex flex-col min-w-0">
          <TaskFilters
            search={search}
            onSearchChange={setSearch}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={counts}
          />
          <div className="flex-1 overflow-y-auto">
            <TaskTable
              tasks={filtered}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onOpenDetail={setActiveTaskId}
              onApprove={handleApprove}
              onDiscard={handleDiscard}
            />
          </div>
          <TaskActionBar
            selectedCount={selectedIds.size}
            totalCount={filtered.length}
            onSend={() => setShowSendModal(true)}
          />
        </div>

        {/* Right: detail panel */}
        {activeTask && (
          <TaskDetailPanel
            task={activeTask}
            onClose={() => setActiveTaskId(null)}
            onApprove={handleApprove}
            onDiscard={handleDiscard}
          />
        )}
      </div>

      {/* Send confirmation modal */}
      <SendConfirmationModal
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
        onConfirm={handleSendConfirm}
        tasks={selectedTasks}
      />
    </div>
  );
}
