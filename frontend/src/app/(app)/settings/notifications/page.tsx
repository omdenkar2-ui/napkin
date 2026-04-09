"use client";

import { NotificationsForm } from "@/components/settings/notifications-form";
import { PageTransition } from "@/components/ui/page-transition";

export default function NotificationSettingsPage() {
  return <PageTransition><NotificationsForm /></PageTransition>;
}
