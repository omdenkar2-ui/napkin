"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSession } from "@/lib/api/sessions";
import { getOrCreateDefaultProject } from "@/lib/api/projects";
import { FeedbackInput } from "@/components/feedback/feedback-input";

export default function NewSessionPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (texts: string[]) => {
    if (texts.length === 0) {
      toast.error("No feedback found");
      return;
    }
    setIsSubmitting(true);
    try {
      const project = await getOrCreateDefaultProject();
      const result = await createSession({
        project_id: project.id,
        initial_feedback: { texts },
      });
      router.push(`/s/${result.session_id}`);
    } catch {
      toast.error("Failed to start analysis");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-2rem)] px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">New session</h1>
          <p className="text-sm text-text-secondary mt-2">
            Paste feedback from any source — interviews, support tickets, surveys, NPS comments.
          </p>
        </div>

        <FeedbackInput
          onSubmit={handleSubmit}
          placeholder="Paste customer feedback here..."
          minTextareaHeight="120px"
          disabled={isSubmitting}
        />
      </div>
    </div>
  );
}
