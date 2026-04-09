"use client";

import { ProfileForm } from "@/components/settings/profile-form";
import { PageTransition } from "@/components/ui/page-transition";

export default function ProfileSettingsPage() {
  return <PageTransition><ProfileForm /></PageTransition>;
}
