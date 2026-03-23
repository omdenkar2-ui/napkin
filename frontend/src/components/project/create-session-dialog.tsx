"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSession } from "@/lib/api/sessions";
import { toast } from "sonner";

interface CreateSessionDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function CreateSessionDialog({
  projectId,
  open,
  onClose,
}: CreateSessionDialogProps) {
  const [title, setTitle] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const feedbackTexts = feedback
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await createSession({
        project_id: projectId,
        title: title.trim() || undefined,
        initial_feedback:
          feedbackTexts.length > 0
            ? { texts: feedbackTexts }
            : undefined,
      });

      toast.success("Session created");
      onClose();
      router.push(`/sessions/${result.session_id}`);
    } catch {
      toast.error("Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>New session</DialogTitle>
      <DialogDescription>
        Start a new feedback analysis session. Optionally paste initial feedback.
      </DialogDescription>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="session-title" className="block text-sm text-muted mb-1.5">
            Title (optional)
          </label>
          <Input
            id="session-title"
            placeholder="Q1 User Feedback"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="session-feedback" className="block text-sm text-muted mb-1.5">
            Initial feedback (optional, one per line)
          </label>
          <Textarea
            id="session-feedback"
            placeholder={"The dashboard is too slow\nI can't find the export button\nLove the new search feature"}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={5}
          />
        </div>
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Start session"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
