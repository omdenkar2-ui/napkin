"use client";

import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-[68px] min-h-screen bg-background">
        {children}
      </main>
    </div>
  );
}
