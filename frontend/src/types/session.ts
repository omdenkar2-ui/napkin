import type { SessionStage } from "./api";

export interface StageInfo {
  key: SessionStage;
  label: string;
  number: number;
  isInteractive: boolean;
  description: string;
}

export const STAGES: StageInfo[] = [
  { key: "intake", label: "Intake", number: 1, isInteractive: false, description: "Processing feedback" },
  { key: "synthesis", label: "Synthesis", number: 2, isInteractive: false, description: "Discovering patterns" },
  { key: "prioritization", label: "Prioritization", number: 3, isInteractive: false, description: "Ranking opportunities" },
  { key: "four_questions", label: "Context", number: 4, isInteractive: false, description: "Inferring strategic context" },
  { key: "spec_building", label: "Spec Building", number: 5, isInteractive: false, description: "Building spec" },
  { key: "task_planning", label: "Task Planning", number: 6, isInteractive: false, description: "Creating sprint plan" },
  { key: "done", label: "Done", number: 7, isInteractive: false, description: "Session complete" },
  { key: "error", label: "Error", number: -1, isInteractive: false, description: "Something went wrong" },
];

export const AUTO_ADVANCE_STAGES: SessionStage[] = [
  "synthesis",
  "prioritization",
  "four_questions",
  "spec_building",
  "task_planning",
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
