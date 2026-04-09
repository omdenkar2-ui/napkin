"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function WorkspaceForm() {
  const [name, setName] = useState("Napkin");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  return (
    <div>
      <h3 className="text-[16px] font-semibold text-[--text-primary] tracking-tight mb-1">Workspace</h3>
      <p className="text-[13px] text-[--text-muted] mb-6">Manage your workspace settings</p>

      <div className="flex flex-col gap-5">
        {/* Workspace name */}
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
            Workspace name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-[--primary]/20 focus:border-[--primary] transition-colors"
          />
        </div>

        {/* Workspace slug */}
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
            Workspace slug
          </label>
          <input
            type="text"
            value="napkin"
            disabled
            className="w-full h-9 px-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] opacity-60 cursor-not-allowed"
          />
          <p className="text-[11px] text-[--text-muted] mt-1">Used in URLs: app.napkin.ai/napkin</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-5 border-t border-[--border]/60 flex justify-end">
        <button
          type="button"
          onClick={() => toast.success("Workspace updated")}
          className="h-9 px-4 rounded-lg bg-[--primary] text-[--primary-text] text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          Save Changes
        </button>
      </div>

      {/* Danger zone */}
      <div className="mt-12">
        <h4 className="text-[14px] font-semibold text-[--error] mb-4">Danger Zone</h4>
        <div className="border border-[#FEE2E2] rounded-xl bg-[#FEF2F2]/50 p-4 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-[--text-primary]">Delete workspace</p>
            <p className="text-[12px] text-[--text-muted]">Permanently delete this workspace and all its data</p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="h-8 px-3 rounded-lg bg-[--error-soft] text-[--error] text-[13px] font-medium hover:bg-[--error]/10 transition-colors shrink-0"
          >
            Delete Workspace
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Dialog open={deleteOpen} onClose={() => { setDeleteOpen(false); setDeleteConfirm(""); }}>
        <DialogTitle>Delete Workspace?</DialogTitle>
        <DialogDescription className="text-[13px] text-[--text-muted]">
          This action cannot be undone. All feedback, analyses, tasks, and team data will be permanently deleted.
        </DialogDescription>

        <div className="mt-4">
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
            Type &quot;napkin&quot; to confirm
          </label>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-[--primary]/20 focus:border-[--primary] transition-colors"
          />
        </div>

        <div className="pt-5 mt-5 border-t border-[--border]/60 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}
            className="h-9 px-4 rounded-lg border border-[--border] text-sm font-medium text-[--text-secondary] hover:bg-[--surface-alt] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleteConfirm !== "napkin"}
            onClick={() => { console.log("delete workspace"); setDeleteOpen(false); setDeleteConfirm(""); }}
            className="h-9 px-4 rounded-lg bg-[--error] text-white text-sm font-medium hover:bg-[--error]/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            Delete Workspace
          </button>
        </div>
      </Dialog>
    </div>
  );
}
