"use client";

import { Users, UserPlus } from "lucide-react";

interface TeamEmptyProps {
  onInvite: () => void;
}

export function TeamEmpty({ onInvite }: TeamEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 text-[--text-muted]">
        <Users className="w-12 h-12" />
      </div>
      <h3 className="text-[16px] font-medium text-[--text-primary] mb-1">
        Just you for now
      </h3>
      <p className="text-[14px] text-[--text-muted] max-w-[360px] mx-auto mb-6">
        Invite your team to collaborate on feedback analysis and task review.
      </p>
      <button
        type="button"
        onClick={onInvite}
        className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Invite Team Member
      </button>
    </div>
  );
}
