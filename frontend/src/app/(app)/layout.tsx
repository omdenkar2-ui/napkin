"use client";

import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <Sidebar />
      <main
        style={{
          marginLeft: 220,
          minHeight: "100vh",
          background: "#000",
        }}
      >
        {children}
      </main>
    </div>
  );
}
