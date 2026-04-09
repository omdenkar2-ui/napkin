"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { TeamTable } from "@/components/team/team-table";
import { InviteModal } from "@/components/team/invite-modal";
import { TeamSkeleton } from "@/components/team/team-skeleton";
import { TeamEmpty } from "@/components/team/team-empty";
import { PageTransition } from "@/components/ui/page-transition";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "member" | "viewer";
  product_areas: string[];
  status: "active" | "pending" | "deactivated";
}

const MOCK_MEMBERS: TeamMember[] = [
  {
    id: "1",
    full_name: "Nicolás Martinez",
    email: "nicolas@napkin.ai",
    role: "admin",
    product_areas: ["Product", "Growth"],
    status: "active",
  },
  {
    id: "2",
    full_name: "Sarah Chen",
    email: "sarah@napkin.ai",
    role: "member",
    product_areas: ["Mobile", "Frontend"],
    status: "active",
  },
  {
    id: "3",
    full_name: "Julian Torres",
    email: "julian@napkin.ai",
    role: "member",
    product_areas: ["Backend", "Infrastructure"],
    status: "active",
  },
  {
    id: "4",
    full_name: "Lisa Park",
    email: "lisa@napkin.ai",
    role: "member",
    product_areas: ["Design", "UX Research"],
    status: "active",
  },
  {
    id: "5",
    full_name: "David Kim",
    email: "david@napkin.ai",
    role: "viewer",
    product_areas: ["Sales"],
    status: "active",
  },
  {
    id: "6",
    full_name: "Alex Rivera",
    email: "alex@napkin.ai",
    role: "member",
    product_areas: [],
    status: "pending",
  },
];

export default function TeamPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const isLoading = false; // Will be replaced with React Query loading state
  const showEmpty = false;

  if (isLoading) {
    return (
      <div>
        <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Team</h1>
        </div>
        <div className="p-4 md:p-8"><TeamSkeleton /></div>
      </div>
    );
  }

  if (!isLoading && showEmpty) {
    return (
      <div>
        <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Team</h1>
        </div>
        <div className="p-4 md:p-8">
          <TeamEmpty onInvite={() => setInviteOpen(true)} />
        </div>
        <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
          Team
        </h1>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Content */}
      <PageTransition className="p-4 md:p-8">
        <TeamTable members={MOCK_MEMBERS} />
      </PageTransition>

      {/* Invite modal */}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
