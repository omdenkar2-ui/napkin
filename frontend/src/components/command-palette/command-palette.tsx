"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  BarChart3,
  CheckSquare,
  Zap,
  Plug,
  Users,
  Settings,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  group: "navigation" | "actions";
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  action: () => void;
}

const GROUP_LABELS: Record<string, string> = {
  navigation: "Navigation",
  actions: "Actions",
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = useMemo(() => [
    { id: "nav-home", group: "navigation", label: "Go to Home", icon: LayoutDashboard, action: () => router.push("/") },
    { id: "nav-sessions", group: "navigation", label: "Go to Sessions", icon: BarChart3, action: () => router.push("/sessions") },
    { id: "nav-tasks", group: "navigation", label: "Go to Tasks", icon: CheckSquare, action: () => router.push("/tasks") },
    { id: "nav-workflows", group: "navigation", label: "Go to Workflows", icon: Zap, action: () => router.push("/workflows") },
    { id: "nav-integrations", group: "navigation", label: "Go to Integrations", icon: Plug, action: () => router.push("/integrations") },
    { id: "nav-team", group: "navigation", label: "Go to Team", icon: Users, action: () => router.push("/team") },
    { id: "nav-settings", group: "navigation", label: "Go to Settings", icon: Settings, action: () => router.push("/settings/profile") },
    { id: "act-session", group: "actions", label: "New Session", icon: Sparkles, action: () => router.push("/sessions/new") },
    { id: "act-invite", group: "actions", label: "Invite team member", icon: UserPlus, action: () => router.push("/team") },
    { id: "act-workflow", group: "actions", label: "Create workflow", icon: Zap, action: () => router.push("/workflows/new") },
  ], [router]);

  const filtered = useMemo(() => {
    if (!search.trim()) return commands;
    const q = search.toLowerCase();
    return commands.filter((cmd) => cmd.label.toLowerCase().includes(q));
  }, [commands, search]);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(filtered.length > 0 ? 0 : -1);
  }, [search, filtered.length]);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setHighlightedIndex(-1);
  }, []);

  const execute = useCallback((cmd: Command) => {
    cmd.action();
    close();
  }, [close]);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-command-item]");
    items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filtered.length - 1 ? prev + 1 : 0,
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filtered.length - 1,
      );
      return;
    }

    if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
      e.preventDefault();
      execute(filtered[highlightedIndex]);
    }
  }

  if (!open) return null;

  // Group the filtered results (only show groups when not searching or many results)
  const showGroups = !search.trim();
  const groups = showGroups
    ? (["navigation", "actions"] as const).map((group) => ({
        group,
        label: GROUP_LABELS[group],
        items: filtered.filter((cmd) => cmd.group === group),
      })).filter((g) => g.items.length > 0)
    : [{ group: "all" as const, label: "", items: filtered }];

  // Build flat index mapping for keyboard navigation
  let flatIndex = 0;

  return (
    <div
      data-command-palette
      className="fixed inset-0 z-50"
      onClick={close}
      onKeyDown={handleKeyDown}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

      {/* Container */}
      <div className="relative max-w-[560px] w-full mx-auto mt-[20vh]" onClick={(e) => e.stopPropagation()}>
        <div
          className="bg-[--surface] border border-[--border]/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Search input */}
          <div className="h-14 px-5 flex items-center border-b border-[--border]">
            <Search className="w-5 h-5 text-[--text-muted] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 mx-3 text-base bg-transparent border-none outline-none text-[--text-primary] placeholder:text-[--text-muted]"
            />
            <kbd className="text-[10px] font-semibold text-[--text-muted] bg-[--surface-alt] border border-[--border] px-1.5 py-0.5 rounded shrink-0">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] text-[--text-muted]">No results found</p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.group}>
                  {group.label && (
                    <div className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em] px-4 py-2">
                      {group.label}
                    </div>
                  )}
                  {group.items.map((cmd) => {
                    const itemIndex = flatIndex++;
                    const highlighted = itemIndex === highlightedIndex;
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        data-command-item
                        onClick={() => execute(cmd)}
                        onMouseEnter={() => setHighlightedIndex(itemIndex)}
                        className={cn(
                          "w-[calc(100%-16px)] mx-2 h-11 px-4 flex items-center gap-3 rounded-lg cursor-pointer transition-colors text-left",
                          highlighted ? "bg-[--surface-alt]" : "bg-transparent",
                        )}
                      >
                        <cmd.icon className="w-[18px] h-[18px] text-[--text-muted] shrink-0" />
                        <span className="text-[13px] font-medium text-[--text-primary] flex-1">
                          {cmd.label}
                        </span>
                        {cmd.shortcut && (
                          <kbd className="text-[10px] font-semibold text-[--text-muted] bg-[--surface-alt] px-1.5 py-0.5 rounded border border-[--border]">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
