"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { PageTransition } from "@/components/ui/page-transition";
import { StaggerList, StaggerItem } from "@/components/ui/stagger-list";

export default function DashboardPage() {
  const router = useRouter();
  const isLoading = false; // Will be replaced with React Query loading state

  if (isLoading) {
    return (
      <div>
        <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-tight text-[#1A1A1A]">Home</h1>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
        <h1 className="text-[20px] font-semibold tracking-tight text-[#1A1A1A]">
          Home
        </h1>
        <button
          type="button"
          onClick={() => router.push("/sessions/new")}
          className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-lg text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          New Session
        </button>
      </div>

      <PageTransition>
        <div className="p-4 md:p-8 flex flex-col gap-6">
          {/* Row 1 — Stat Cards */}
          <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StaggerItem>
              <StatCard label="Data Points" value="12,847" subtitle="Across all sources" accentColor="#1B6B7A" trend={{ value: "+18%", direction: "up" }} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Active Sources" value="5" subtitle="of 7 connected" accentColor="#22A06B" />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Sessions" value="23" subtitle="Last 30 days" accentColor="#2D7FF9" trend={{ value: "+3", direction: "up" }} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Pending Tasks" value="12" subtitle="Awaiting review" accentColor="#CF9F02" />
            </StaggerItem>
          </StaggerList>

          <QuickActions />
          <ActivityFeed />
        </div>
      </PageTransition>
    </div>
  );
}
