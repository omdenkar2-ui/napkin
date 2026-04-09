"use client";

import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "member" | "viewer";
  product_areas: string[];
  status: "active" | "pending" | "deactivated";
  avatar_url?: string;
}

interface TeamTableProps {
  members: TeamMember[];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  { bg: "bg-[#E8F4F6]", text: "text-[#1B6B7A]" },
  { bg: "bg-[#E6F7EF]", text: "text-[#166534]" },
  { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
  { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const ROLE_STYLES: Record<TeamMember["role"], string> = {
  admin: "bg-[--primary-soft] text-[--primary] border border-[--primary]/20",
  member: "bg-[--surface-alt] text-[--text-secondary] border border-[--border]",
  viewer: "bg-[--surface-alt] text-[--text-muted] border border-[--border]",
};

const STATUS_CONFIG: Record<TeamMember["status"], { dot: string; label: string }> = {
  active: { dot: "bg-[#22A06B]", label: "Active" },
  pending: { dot: "bg-[#CF9F02]", label: "Pending" },
  deactivated: { dot: "bg-[--text-muted]", label: "Inactive" },
};

export function TeamTable({ members }: TeamTableProps) {
  return (
    <div className="bg-[--surface] border border-[--border] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center h-11 px-5 bg-[--surface-alt]">
        <span className="flex-1 min-w-[200px] text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">
          Member
        </span>
        <span className="w-32 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">
          Role
        </span>
        <span className="w-48 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">
          Product Areas
        </span>
        <span className="w-28 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">
          Status
        </span>
        <span className="w-20 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em] text-right">
          Actions
        </span>
      </div>

      {/* Rows */}
      {members.map((member, index) => {
        const status = STATUS_CONFIG[member.status];
        const avatarColor = getAvatarColor(member.full_name);
        return (
          <div
            key={member.id}
            className={cn(
              "flex items-center h-[52px] px-5 hover:bg-[--surface-alt]/50 transition-colors duration-100",
              index < members.length - 1 && "border-b border-[--border]/60",
            )}
          >
            {/* Member */}
            <div className="flex-1 min-w-[200px] flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0", avatarColor.bg, avatarColor.text)}>
                {getInitials(member.full_name)}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[14px] font-medium text-[--text-primary] truncate">
                  {member.full_name}
                </span>
                <span className="text-[12px] text-[--text-muted] truncate">
                  {member.email}
                </span>
              </div>
            </div>

            {/* Role */}
            <div className="w-32">
              <span
                className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded-md capitalize",
                  ROLE_STYLES[member.role],
                )}
              >
                {member.role}
              </span>
            </div>

            {/* Product Areas */}
            <div className="w-48 flex items-center gap-1 overflow-hidden">
              {member.product_areas.length === 0 ? (
                <span className="text-[11px] text-[--text-muted]">—</span>
              ) : (
                <>
                  {member.product_areas.slice(0, 2).map((area) => (
                    <span
                      key={area}
                      className="bg-[--surface-alt] text-[--text-secondary] text-[11px] font-semibold px-2 py-0.5 rounded-md border border-[--border] shrink-0"
                    >
                      {area}
                    </span>
                  ))}
                  {member.product_areas.length > 2 && (
                    <span className="text-[11px] text-[--text-muted] shrink-0">
                      +{member.product_areas.length - 2}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Status */}
            <div className="w-28 flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
              <span className="text-[12px] font-medium text-[--text-secondary]">
                {status.label}
              </span>
            </div>

            {/* Actions */}
            <div className="w-20 flex justify-end">
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[--text-muted] hover:bg-[--surface-alt] transition-colors duration-100"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
