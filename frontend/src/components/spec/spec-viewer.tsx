"use client";

import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import type { SpecObject } from "@/types/api";

interface SpecViewerProps {
  spec: SpecObject;
}

export function SpecViewer({ spec }: SpecViewerProps) {
  return (
    <div className="space-y-6">
      {/* Decision */}
      {spec.decision && (
        <Card>
          <CardTitle className="flex items-center gap-2">
            Decision
            {spec.decision.type && (
              <Badge
                variant={
                  spec.decision.type === "build"
                    ? "success"
                    : spec.decision.type === "kill"
                      ? "error"
                      : "warning"
                }
              >
                {spec.decision.type}
              </Badge>
            )}
          </CardTitle>
          <CardContent>
            <p className="text-foreground font-medium">{spec.decision.what}</p>
            <p className="text-sm text-muted mt-2">{spec.decision.why}</p>
          </CardContent>
        </Card>
      )}

      {/* UI Changes */}
      {spec.ui_changes && spec.ui_changes.length > 0 && (
        <Card>
          <CardTitle>UI Changes</CardTitle>
          <CardContent className="space-y-3">
            {spec.ui_changes.map((change, i) => (
              <div key={i} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-foreground">
                  {change.screen}
                </p>
                <p className="text-sm text-muted mt-1">{change.description}</p>
                {change.components && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {change.components.map((c, j) => (
                      <Badge key={j} variant="default">
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Data Model */}
      {spec.data_model && spec.data_model.length > 0 && (
        <Card>
          <CardTitle>Data Model</CardTitle>
          <CardContent className="space-y-3">
            {spec.data_model.map((entity, i) => (
              <div key={i} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-foreground font-mono">
                  {entity.entity}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {entity.fields.map((field, j) => (
                    <li key={j} className="text-xs text-muted font-mono">
                      {field}
                    </li>
                  ))}
                </ul>
                {entity.notes && (
                  <p className="text-xs text-muted mt-1">{entity.notes}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Task Breakdown */}
      {spec.task_breakdown && spec.task_breakdown.length > 0 && (
        <Card>
          <CardTitle>Task Breakdown</CardTitle>
          <CardContent className="space-y-3">
            {spec.task_breakdown.map((task, i) => (
              <div key={i} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {task.title}
                  </p>
                  <Badge variant="default">{task.type}</Badge>
                  {task.estimate_hours && (
                    <span className="text-xs text-muted">
                      {task.estimate_hours}h
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted mt-1">{task.description}</p>
                {task.acceptance_criteria.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {task.acceptance_criteria.map((ac, j) => (
                      <li key={j} className="text-xs text-muted flex items-start gap-1">
                        <span className="text-success mt-0.5">&#x2713;</span>
                        {ac}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Success Criteria */}
      {spec.success_criteria && spec.success_criteria.length > 0 && (
        <Card>
          <CardTitle>Success Criteria</CardTitle>
          <CardContent>
            <div className="space-y-2">
              {spec.success_criteria.map((sc, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-accent font-mono">{sc.metric}</span>
                  <span className="text-foreground">{sc.target}</span>
                  <span className="text-muted">{sc.measurement}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cursor Prompt */}
      {spec.cursor_prompt && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="mb-0">Cursor Prompt</CardTitle>
            <CopyButton text={spec.cursor_prompt} />
          </div>
          <CardContent>
            <pre className="text-sm text-foreground bg-background rounded-[8px] p-4 overflow-x-auto whitespace-pre-wrap border border-border">
              {spec.cursor_prompt}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
