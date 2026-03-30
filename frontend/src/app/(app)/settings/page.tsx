"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import {
  getOrCreateDefaultProject,
  getProject,
  updateProject,
} from "@/lib/api/projects";
import { Spinner } from "@/components/ui/spinner";

type Tab = "Workspace" | "Integrations" | "Team" | "Account";

/* ─── Workspace tab ────────────────────────────────────────── */
function WorkspaceTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    staleTime: 30_000,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name ?? "");
      setDescription(project.description ?? "");
    }
  }, [project]);

  const isDirty =
    project &&
    (name !== (project.name ?? "") ||
      description !== (project.description ?? ""));

  async function handleSave() {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await updateProject(projectId, { name, description });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Workspace updated");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <div>
        <label className="block text-[13px] font-medium text-text-secondary mb-2">
          Product name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 w-full bg-card-bg border border-border rounded-lg px-3 text-foreground text-sm focus:border-border-focus focus:outline-none"
        />
      </div>

      <div className="mt-5">
        <label className="block text-[13px] font-medium text-text-secondary mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[80px] w-full bg-card-bg border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:border-border-focus focus:outline-none resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!isDirty || saving}
        className="mt-6 h-9 px-4 bg-cta-bg text-cta-text rounded-lg text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}

/* ─── Integrations tab ─────────────────────────────────────── */
const INTEGRATIONS = [
  {
    key: "github",
    name: "GitHub",
    description: "Connect your repo for smarter specs",
    comingSoon: false,
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-foreground" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    key: "notion",
    name: "Notion",
    description: "Import pages as feedback",
    comingSoon: true,
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-foreground" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
    ),
  },
  {
    key: "slack",
    name: "Slack",
    description: "Share patterns with your team",
    comingSoon: true,
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-foreground" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </svg>
    ),
  },
];

function IntegrationsTab() {
  return (
    <div className="flex flex-col gap-3">
      {INTEGRATIONS.map((integration) => (
        <div
          key={integration.key}
          className="bg-card-bg border border-border rounded-xl p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.04)] border border-border flex items-center justify-center shrink-0">
              {integration.icon}
            </div>
            <div>
              <p className="text-[14px] font-medium text-foreground">
                {integration.name}
              </p>
              <p className="text-[12px] text-text-tertiary mt-0.5">
                {integration.description}
              </p>
            </div>
          </div>
          {integration.comingSoon ? (
            <span className="text-[11px] text-text-ghost">Coming soon</span>
          ) : (
            <button
              onClick={() => toast.info("GitHub integration coming soon")}
              className="h-8 px-3 bg-card-bg border border-border rounded-md text-text-secondary text-[12px] font-medium hover:border-border-hover transition-colors"
            >
              Connect
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Team tab ─────────────────────────────────────────────── */
function TeamTab({ userEmail }: { userEmail?: string }) {
  const [inviteEmail, setInviteEmail] = useState("");

  function handleInvite() {
    toast.info("Team invites coming soon");
    setInviteEmail("");
  }

  const initial = userEmail?.[0]?.toUpperCase() ?? "?";

  return (
    <div>
      <div className="bg-card-bg border border-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[rgba(99,130,255,0.20)] flex items-center justify-center text-accent-blue text-sm font-medium shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] text-foreground truncate">
              {userEmail ?? "—"}
            </p>
          </div>
          <span className="text-[11px] text-text-tertiary shrink-0">Owner</span>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[13px] font-medium text-text-secondary mb-3">
          Invite team members
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="flex-1 h-10 bg-card-bg border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-text-ghost focus:border-border-focus focus:outline-none"
          />
          <button
            onClick={handleInvite}
            className="h-10 px-4 bg-card-bg border border-border rounded-lg text-[13px] font-medium text-text-secondary hover:border-border-hover transition-colors"
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Account tab ──────────────────────────────────────────── */
function AccountTab({
  email,
  userId,
  onSignOut,
}: {
  email?: string;
  userId?: string;
  onSignOut: () => void;
}) {
  return (
    <div>
      <div>
        <p className="text-[12px] text-text-tertiary">Email</p>
        <p className="text-[14px] text-foreground mt-1">{email ?? "—"}</p>
      </div>
      <div className="mt-4">
        <p className="text-[12px] text-text-tertiary">User ID</p>
        <p className="text-[12px] text-text-ghost font-mono mt-1">
          {userId ?? "—"}
        </p>
      </div>
      <div className="border-t border-border my-6" />
      <button
        onClick={onSignOut}
        className="h-9 px-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-[13px] font-medium hover:bg-destructive/20 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
const TABS: Tab[] = ["Workspace", "Integrations", "Team", "Account"];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("Workspace");
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    getOrCreateDefaultProject().then((p) => setProjectId(p.id)).catch(() => {});
  }, []);

  return (
    <div className="max-w-[700px] p-8">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border mb-8">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-foreground text-foreground"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Workspace" &&
        (projectId ? (
          <WorkspaceTab projectId={projectId} />
        ) : (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ))}

      {activeTab === "Integrations" && <IntegrationsTab />}

      {activeTab === "Team" && <TeamTab userEmail={user?.email} />}

      {activeTab === "Account" && (
        <AccountTab
          email={user?.email}
          userId={user?.id}
          onSignOut={signOut}
        />
      )}
    </div>
  );
}
