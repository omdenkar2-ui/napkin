"use client";

import { WorkspaceForm } from "@/components/settings/workspace-form";
import { PageTransition } from "@/components/ui/page-transition";

export default function WorkspaceSettingsPage() {
  return <PageTransition><WorkspaceForm /></PageTransition>;
}
