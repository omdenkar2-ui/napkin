"use client";

import { useState } from "react";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
      await createProject({ name: name.trim(), description: description.trim() || undefined });
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
      <DialogDescription>
        Create a project to organize your feedback sessions.
      </DialogDescription>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="project-name" className="block text-sm text-muted mb-1.5">
            Name
          </label>
          <Input
            id="project-name"
            placeholder="My Product"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="project-desc" className="block text-sm text-muted mb-1.5">
            Description (optional)
          </label>
          <Textarea
            id="project-desc"
            placeholder="What this project is about..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? "Creating..." : "Create project"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
