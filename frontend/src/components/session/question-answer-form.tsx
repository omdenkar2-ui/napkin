"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

interface QuestionAnswerFormProps {
  questions: string[];
  onSubmit: (answer: string) => void;
  loading?: boolean;
}

export function QuestionAnswerForm({
  questions,
  onSubmit,
  loading,
}: QuestionAnswerFormProps) {
  const [answer, setAnswer] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    onSubmit(answer.trim());
    setAnswer("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (questions.length === 0) return null;

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <Card key={i} className="p-4">
          <p className="text-sm text-foreground">{q}</p>
        </Card>
      ))}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          placeholder="Type your answer..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={loading}
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted">Cmd+Enter to submit</p>
          <Button type="submit" disabled={loading || !answer.trim()}>
            {loading ? "Sending..." : "Submit answer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
