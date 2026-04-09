"use client";

import {
  Hash,
  MessageCircle,
  Video,
  FileText,
  BookOpen,
  Mail,
  Table,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { IntegrationOverviewCard } from "@/components/integrations/integration-overview-card";
import { IntegrationsSkeleton } from "@/components/integrations/integrations-skeleton";
import { PageTransition } from "@/components/ui/page-transition";
import { StaggerList, StaggerItem } from "@/components/ui/stagger-list";

interface Integration {
  name: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  connected: boolean;
  lastSync?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    name: "Slack",
    description: "Import feedback from Slack channels and threads",
    icon: Hash,
    iconBg: "#E8D5F5",
    iconColor: "#611F69",
    connected: true,
    lastSync: "2h ago",
  },
  {
    name: "Intercom",
    description: "Import support conversations and tickets",
    icon: MessageCircle,
    iconBg: "#E0F0FF",
    iconColor: "#1F8DED",
    connected: true,
    lastSync: "30min ago",
  },
  {
    name: "Zoom",
    description: "Import meeting transcripts and recordings",
    icon: Video,
    iconBg: "#E0EDFF",
    iconColor: "#2D8CFF",
    connected: false,
  },
  {
    name: "Typeform",
    description: "Import survey responses and NPS scores",
    icon: FileText,
    iconBg: "#E8E8E8",
    iconColor: "#262627",
    connected: false,
  },
  {
    name: "Notion",
    description: "Import feature requests and feedback docs",
    icon: BookOpen,
    iconBg: "#F0F0F0",
    iconColor: "#1A1A1A",
    connected: true,
    lastSync: "1 day ago",
  },
  {
    name: "Email",
    description: "Forward feedback emails to your Napkin inbox",
    icon: Mail,
    iconBg: "#FFF3E0",
    iconColor: "#E67E22",
    connected: false,
  },
  {
    name: "Spreadsheets",
    description: "Import CSV or Google Sheets data",
    icon: Table,
    iconBg: "#E6F4EA",
    iconColor: "#34A853",
    connected: false,
  },
  {
    name: "Manual",
    description: "Add feedback directly through the app",
    icon: PenLine,
    iconBg: "var(--primary-soft)",
    iconColor: "var(--primary)",
    connected: true,
    lastSync: "Always available",
  },
];

export default function IntegrationsPage() {
  const isLoading = false; // Will be replaced with React Query loading state

  if (isLoading) {
    return (
      <div>
        <div className="h-14 border-b border-[#E5E2DC] flex items-center px-8 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Integrations</h1>
        </div>
        <div className="p-4 md:p-8"><IntegrationsSkeleton /></div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center px-8 bg-[--background]">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
          Integrations
        </h1>
      </div>

      {/* Content */}
      <PageTransition className="p-4 md:p-8">
        <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATIONS.map((integration) => (
            <StaggerItem key={integration.name}>
            <IntegrationOverviewCard
              key={integration.name}
              name={integration.name}
              description={integration.description}
              icon={integration.icon}
              iconBg={integration.iconBg}
              iconColor={integration.iconColor}
              connected={integration.connected}
              lastSync={integration.lastSync}
              onConnect={() => console.log(`Connect ${integration.name}`)}
              onConfigure={() => console.log(`Configure ${integration.name}`)}
            />
            </StaggerItem>
          ))}
        </StaggerList>
      </PageTransition>
    </div>
  );
}
