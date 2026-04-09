"use client";

import { SettingsLayout } from "@/components/settings/settings-layout";

export default function SettingsLayoutPage({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center px-8 bg-[--background]">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
          Settings
        </h1>
      </div>
      <SettingsLayout>{children}</SettingsLayout>
    </div>
  );
}
