"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Role = "admin" | "member" | "viewer";

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

const ROLES: { value: Role; label: string; subtitle: string }[] = [
  { value: "admin", label: "Admin", subtitle: "Full access" },
  { value: "member", label: "Member", subtitle: "Can edit & approve" },
  { value: "viewer", label: "Viewer", subtitle: "Read-only" },
];

export function InviteModal({ open, onClose }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [message, setMessage] = useState("");

  function handleSubmit() {
    if (!email.trim()) return;
    console.log("Invite sent:", { email, role, message });
    toast.success(`Invitation sent to ${email}`);
    setEmail("");
    setRole("member");
    setMessage("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Invite Team Member</DialogTitle>
      <DialogDescription className="text-[13px] text-[--text-muted]">
        They&apos;ll receive an email invitation to join your workspace.
      </DialogDescription>

      <div className="flex flex-col gap-4 mt-6">
        {/* Email */}
        <div>
          <label className="block text-[12px] font-medium text-[--text-muted] uppercase tracking-wider mb-1.5">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="w-full h-9 px-3 rounded-md border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:border-[--border-focus] transition-colors"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-[12px] font-medium text-[--text-muted] uppercase tracking-wider mb-1.5">
            Role
          </label>
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={cn(
                  "flex-1 border rounded-md p-3 cursor-pointer transition-colors text-left",
                  role === r.value
                    ? "border-[--primary] bg-[--primary-soft]"
                    : "border-[--border] hover:border-[--border-strong]",
                )}
              >
                <span className="block text-[13px] font-medium text-[--text-primary]">
                  {r.label}
                </span>
                <span className="block text-[11px] text-[--text-muted] mt-0.5">
                  {r.subtitle}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-[12px] font-medium text-[--text-muted] uppercase tracking-wider mb-1.5">
            Personal message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Join our team on Napkin to collaborate on product feedback."
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:border-[--border-focus] transition-colors resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-[--border] flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-4 rounded-md border border-[--border] text-sm font-medium text-[--text-secondary] hover:bg-[--surface-hover] hover:border-[--border-strong] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!email.trim()}
          className="h-9 px-4 rounded-md bg-[--primary] text-[--primary-text] text-sm font-medium hover:bg-[--primary-hover] transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Send Invite
        </button>
      </div>
    </Dialog>
  );
}
