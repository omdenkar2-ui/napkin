"use client";

import { useRouter } from "next/navigation";
import { Sparkles, CheckSquare, Plug, ArrowRight, type LucideIcon } from "lucide-react";

interface QuickAction {
  icon: LucideIcon;
  title: string;
  description: string;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}

export function QuickActions() {
  const router = useRouter();

  const actions: QuickAction[] = [
    {
      icon: Sparkles,
      title: "New Session",
      description: "Upload data or analyze connected sources",
      iconBg: "bg-[#E8F4F6]",
      iconColor: "text-[#1B6B7A]",
      onClick: () => router.push("/sessions/new"),
    },
    {
      icon: CheckSquare,
      title: "Review Tasks",
      description: "12 tasks pending your review",
      iconBg: "bg-[#E6F7EF]",
      iconColor: "text-[#22A06B]",
      onClick: () => router.push("/tasks"),
    },
    {
      icon: Plug,
      title: "Connect Source",
      description: "Add a new feedback source",
      iconBg: "bg-[#F5F3EF]",
      iconColor: "text-[#4A4A4A]",
      onClick: () => router.push("/integrations"),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {actions.map((action) => (
        <button
          key={action.title}
          type="button"
          onClick={action.onClick}
          className="group bg-[--surface] border border-[--border] rounded-xl p-5 text-left cursor-pointer shadow-sm hover:border-[--border-strong] hover:shadow-md transition-all duration-150"
        >
          <div className={`w-10 h-10 rounded-xl ${action.iconBg} flex items-center justify-center mb-3`}>
            <action.icon className={`w-5 h-5 ${action.iconColor}`} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold text-[--text-primary]">
                {action.title}
              </p>
              <p className="text-[13px] text-[--text-muted] mt-0.5">
                {action.description}
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[--text-muted] opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0" />
          </div>
        </button>
      ))}
    </div>
  );
}
