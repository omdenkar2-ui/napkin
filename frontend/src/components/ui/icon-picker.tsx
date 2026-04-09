"use client";

import {
  MessageSquare, Lightbulb, Target, BarChart2, Zap, Wrench,
  Puzzle, Rocket, FileText, Flame, Brain, CheckSquare,
  Pin, Layers, Link, Settings, Leaf, Package,
  Search, Users, Bug, Megaphone, Map, Star,
  TrendingUp, Shield, Eye, Code2, Compass, Flag,
  Inbox, GitBranch, type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export const SESSION_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: "MessageSquare", icon: MessageSquare },
  { name: "Lightbulb",     icon: Lightbulb },
  { name: "Target",        icon: Target },
  { name: "BarChart2",     icon: BarChart2 },
  { name: "Zap",           icon: Zap },
  { name: "Wrench",        icon: Wrench },
  { name: "Puzzle",        icon: Puzzle },
  { name: "Rocket",        icon: Rocket },
  { name: "FileText",      icon: FileText },
  { name: "Flame",         icon: Flame },
  { name: "Brain",         icon: Brain },
  { name: "CheckSquare",   icon: CheckSquare },
  { name: "Pin",           icon: Pin },
  { name: "Layers",        icon: Layers },
  { name: "Link",          icon: Link },
  { name: "Settings",      icon: Settings },
  { name: "Leaf",          icon: Leaf },
  { name: "Package",       icon: Package },
  { name: "Search",        icon: Search },
  { name: "Users",         icon: Users },
  { name: "Bug",           icon: Bug },
  { name: "Megaphone",     icon: Megaphone },
  { name: "Map",           icon: Map },
  { name: "Star",          icon: Star },
  { name: "TrendingUp",    icon: TrendingUp },
  { name: "Shield",        icon: Shield },
  { name: "Eye",           icon: Eye },
  { name: "Code2",         icon: Code2 },
  { name: "Compass",       icon: Compass },
  { name: "Flag",          icon: Flag },
  { name: "Inbox",         icon: Inbox },
  { name: "GitBranch",     icon: GitBranch },
];

interface IconPickerProps {
  onIconSelect: (iconName: string) => void;
  selectedIcon?: string;
}

export function IconPicker({ onIconSelect, selectedIcon }: IconPickerProps) {
  return (
    <div className="p-2 grid grid-cols-8 gap-0.5">
      {SESSION_ICONS.map(({ name, icon: Icon }) => (
        <button
          key={name}
          type="button"
          onClick={(e) => { e.stopPropagation(); onIconSelect(name); }}
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
            selectedIcon === name
              ? "bg-[--primary-soft] text-[--primary]"
              : "text-[--text-muted] hover:bg-[--surface-hover] hover:text-[--text-primary]"
          )}
        >
          <Icon size={16} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}
