"use client";

import { useState } from "react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createProject } from "@/lib/api/projects";
import { toast } from "sonner";

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProjectDialog({
  open,
  onClose,
  onCreated,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Project created");
      setName("");
      setDescription("");
      onCreated();
      onClose();
    } catch {
      toast.error("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>New project</DialogTitle>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">Project name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Mobile App Feedback"
            className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-muted"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            rows={3}
            className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-muted resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || loading}>
            {loading ? "Creating..." : "Create project"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
