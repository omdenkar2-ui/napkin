"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

export function ProfileForm() {
  const [fullName, setFullName] = useState("Nicolás Martinez");
  const [role, setRole] = useState("Founder & CEO");

  return (
    <div>
      <h3 className="text-[16px] font-semibold text-[--text-primary] tracking-tight mb-1">Profile</h3>
      <p className="text-[13px] text-[--text-muted] mb-6">Manage your personal information</p>

      <div className="flex flex-col gap-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#E8F4F6] text-[#1B6B7A] flex items-center justify-center text-[24px] font-semibold shrink-0">
            NM
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => console.log("upload photo")}
              className="h-8 px-3 border border-[--border] rounded-lg text-[13px] font-medium text-[--text-secondary] hover:bg-[--surface-alt] hover:border-[--border-strong] transition-all duration-150"
            >
              Upload photo
            </button>
            <button
              type="button"
              onClick={() => console.log("remove photo")}
              className="h-8 px-3 rounded-lg text-[13px] font-medium text-[--text-muted] hover:bg-[--surface-alt] transition-colors"
            >
              Remove
            </button>
          </div>
        </div>

        {/* Full name */}
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
            Full name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-[--primary]/20 focus:border-[--primary] transition-colors"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
            Email
          </label>
          <input
            type="email"
            value="nicolas@napkin.ai"
            disabled
            className="w-full h-9 px-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] opacity-60 cursor-not-allowed"
          />
          <p className="text-[11px] text-[--text-muted] mt-1">Email cannot be changed</p>
        </div>

        {/* Role */}
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
            Role
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Product Manager"
            className="w-full h-9 px-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--primary]/20 focus:border-[--primary] transition-colors"
          />
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
            Timezone
          </label>
          <button
            type="button"
            className="w-full h-9 px-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] flex items-center justify-between hover:border-[--border-strong] transition-colors"
          >
            America/Mexico_City (GMT-6)
            <ChevronDown className="w-3.5 h-3.5 text-[--text-muted]" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-5 border-t border-[--border]/60 flex justify-end">
        <button
          type="button"
          onClick={() => toast.success("Profile updated")}
          className="h-9 px-4 rounded-lg bg-[--primary] text-[--primary-text] text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
