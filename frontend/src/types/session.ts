import type { SessionStage } from "./api";

export interface StageInfo {
  key: SessionStage;
  label: string;
  number: number;
  isInteractive: boolean;
  description: string;
}

export const STAGES: StageInfo[] = [
  { key: "intake", label: "Intake", number: 1, isInteractive: true, description: "Paste customer feedback" },
  { key: "synthesis", label: "Synthesis", number: 2, isInteractive: false, description: "Discovering patterns" },
  { key: "prioritization", label: "Prioritization", number: 3, isInteractive: false, description: "Ranking opportunities" },
  { key: "four_questions", label: "Questions", number: 4, isInteractive: true, description: "Strategic questions" },
  { key: "repo_context", label: "Repo Context", number: 5, isInteractive: false, description: "Analyzing codebase" },
  { key: "spec_building", label: "Spec Building", number: 6, isInteractive: false, description: "Building spec" },
  { key: "spec_qa", label: "Spec QA", number: 7, isInteractive: true, description: "Quality checks" },
  { key: "task_planning", label: "Task Planning", number: 8, isInteractive: false, description: "Creating sprint plan" },
  { key: "export", label: "Export", number: 9, isInteractive: false, description: "Generating exports" },
  { key: "done", label: "Done", number: 10, isInteractive: false, description: "Session complete" },
];

export const AUTO_ADVANCE_STAGES: SessionStage[] = [
  "synthesis",
  "prioritization",
  "repo_context",
  "spec_building",
  "task_planning",
  "export",
  "review",
];

export function getStageIndex(stage: SessionStage): number {
  const idx = STAGES.findIndex((s) => s.key === stage);
  return idx === -1 ? 0 : idx;
}

export function isAutoAdvanceStage(stage: SessionStage): boolean {
  return AUTO_ADVANCE_STAGES.includes(stage);
}

export function getStageInfo(stage: SessionStage): StageInfo | undefined {
  return STAGES.find((s) => s.key === stage);
}
