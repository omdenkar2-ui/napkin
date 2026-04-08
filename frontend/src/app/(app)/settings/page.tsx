"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import {
  getOrCreateDefaultProject,
  getProject,
  updateProject,
} from "@/lib/api/projects";
import {
  listIntegrations,
  connectGmail,
  syncGmail,
  connectGitHub,
  syncGitHub,
  syncGitHubIssues,
  connectIntercom,
  syncIntercom,
  disconnectIntegration,
  getCapabilities,
  handleGmailCallback,
  handleGitHubCallback,
} from "@/lib/api/integrations";
import { BusinessContextCard } from "@/components/context/business-context-card";
import { Spinner } from "@/components/ui/spinner";
import { Mail, GitBranch, Bug, MessageSquare, Headphones } from "lucide-react";

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
function IntegrationsTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [intercomToken, setIntercomToken] = useState("");

  const { data: integrations } = useQuery({
    queryKey: ["integrations", projectId],
    queryFn: () => listIntegrations(projectId),
    enabled: !!projectId,
  });

  const { data: caps } = useQuery({
    queryKey: ["integration-capabilities"],
    queryFn: () => getCapabilities(),
    staleTime: 120_000,
  });

  const intMap = new Map(
    (integrations ?? []).map((i: { provider: string }) => [i.provider, i]),
  );

  function isConnected(provider: string): boolean {
    const i = intMap.get(provider) as { status?: string } | undefined;
    return i?.status === "connected" || i?.status === "active";
  }

  function getLastSynced(provider: string): string | undefined {
    return (intMap.get(provider) as { last_synced_at?: string } | undefined)?.last_synced_at ?? undefined;
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
  const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/settings` : "";
  const noop = () => {};

  const gmailConnect = useMutation({
    mutationFn: () => connectGmail(projectId, redirectUri),
    onSuccess: (d) => { window.location.href = d.auth_url; },
    onError: () => toast.error("Couldn't connect Gmail. Please try again."),
  });
  const githubConnect = useMutation({
    mutationFn: () => connectGitHub(projectId, redirectUri),
    onSuccess: (d) => { window.location.href = d.auth_url; },
    onError: () => toast.error("Couldn't connect GitHub. Please try again."),
  });
  const gmailSync = useMutation({
    mutationFn: () => syncGmail(projectId),
    onSuccess: (d) => { toast.success(`Synced ${d.synced ?? 0} emails`); invalidate(); },
    onError: () => toast.error("Sync failed. Please try again."),
  });
  const githubSync = useMutation({
    mutationFn: () => syncGitHub(projectId),
    onSuccess: () => { toast.success("Repo context updated"); invalidate(); },
    onError: () => toast.error("Sync failed. Please try again."),
  });
  const githubIssuesSync = useMutation({
    mutationFn: () => syncGitHubIssues(projectId),
    onSuccess: (d) => { toast.success(`Synced ${d.items_synced ?? 0} issues`); invalidate(); },
    onError: () => toast.error("Sync failed. Please try again."),
  });
  const intercomConnect = useMutation({
    mutationFn: (token: string) => connectIntercom(projectId, token),
    onSuccess: () => { toast.success("Intercom connected!"); setIntercomToken(""); invalidate(); },
    onError: () => toast.error("Connection failed. Check your token and try again."),
  });
  const intercomSync = useMutation({
    mutationFn: () => syncIntercom(projectId),
    onSuccess: (d) => { toast.success(`Synced ${d.items_synced ?? 0} conversations`); invalidate(); },
    onError: () => toast.error("Sync failed. Please try again."),
  });
  const doDisconnect = useMutation({
    mutationFn: (p: string) => disconnectIntegration(p, projectId),
    onSuccess: () => { toast.success("Disconnected"); invalidate(); },
    onError: () => toast.error("Something went wrong. Try again."),
  });

  // ── Card builder ──

  type CardDef = {
    key: string;
    name: string;
    desc: string;
    icon: React.ReactNode;
    provider: string;          // key in caps + intMap
    available: boolean;
    connected: boolean;
    onConnect: () => void;
    onSync: () => void;
    onDisconnect: () => void;
    lastSynced?: string;
    requiresNote?: string;     // shown when a dependency isn't met
    customSlot?: React.ReactNode;
  };

  const githubConnected = isConnected("github");

  const cards: CardDef[] = [
    {
      key: "gmail", name: "Gmail", provider: "gmail",
      desc: "Scan inbox for support replies, NPS responses, and user feedback",
      icon: <Mail className="w-5 h-5 text-foreground" />,
      available: caps?.gmail?.available ?? false,
      connected: isConnected("gmail"),
      onConnect: () => gmailConnect.mutate(),
      onSync: () => gmailSync.mutate(),
      onDisconnect: () => doDisconnect.mutate("gmail"),
      lastSynced: getLastSynced("gmail"),
    },
    {
      key: "github", name: "GitHub", provider: "github",
      desc: "Connect your repo so Napkin understands what's already built",
      icon: <GitBranch className="w-5 h-5 text-foreground" />,
      available: caps?.github?.available ?? false,
      connected: githubConnected,
      onConnect: () => githubConnect.mutate(),
      onSync: () => githubSync.mutate(),
      onDisconnect: () => doDisconnect.mutate("github"),
      lastSynced: getLastSynced("github"),
    },
    {
      key: "github_issues", name: "GitHub Issues", provider: "github_issues",
      desc: "Pull bug reports, feature requests, and user feedback from your repo",
      icon: <Bug className="w-5 h-5 text-foreground" />,
      available: caps?.github_issues?.available ?? false,
      connected: githubConnected,
      onConnect: noop,
      onSync: () => githubIssuesSync.mutate(),
      onDisconnect: noop,
      lastSynced: getLastSynced("github"),
      requiresNote: !githubConnected ? "Connect GitHub above to enable this." : undefined,
    },
    {
      key: "intercom", name: "Intercom", provider: "intercom",
      desc: "Pull customer support conversations as feedback",
      icon: <Headphones className="w-5 h-5 text-foreground" />,
      available: true,
      connected: isConnected("intercom"),
      onConnect: noop,
      onSync: () => intercomSync.mutate(),
      onDisconnect: () => doDisconnect.mutate("intercom"),
      lastSynced: getLastSynced("intercom"),
      customSlot: !isConnected("intercom") ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="Paste your Intercom access token"
              value={intercomToken}
              onChange={(e) => setIntercomToken(e.target.value)}
              className="flex-1 h-8 bg-background border border-border rounded-md px-2 text-[12px] text-foreground placeholder:text-text-ghost focus:border-border-focus focus:outline-none"
            />
            <button
              type="button"
              onClick={() => intercomToken.trim() && intercomConnect.mutate(intercomToken.trim())}
              disabled={!intercomToken.trim() || intercomConnect.isPending}
              className="h-8 px-3 bg-cta-bg text-cta-text rounded-md text-[12px] font-medium disabled:opacity-40"
            >
              {intercomConnect.isPending ? "..." : "Connect"}
            </button>
          </div>
          <p className="text-[11px] text-text-ghost">
            Find it in Intercom: Settings &gt; Integrations &gt; API Keys
          </p>
        </div>
      ) : undefined,
    },
    {
      key: "whatsapp", name: "WhatsApp Business", provider: "whatsapp",
      desc: "Receive customer messages as feedback in real-time",
      icon: <MessageSquare className="w-5 h-5 text-foreground" />,
      available: caps?.whatsapp?.available ?? false,
      connected: isConnected("whatsapp"),
      onConnect: noop,
      onSync: () => toast.info("WhatsApp syncs automatically via webhook"),
      onDisconnect: () => doDisconnect.mutate("whatsapp"),
      lastSynced: getLastSynced("whatsapp"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-text-secondary mb-1">
        Connect data sources to automatically pull feedback into Napkin.
      </p>

      {cards.map((c) => {
        // State 1: Connected
        if (c.connected) {
          return (
            <div key={c.key} className="rounded-[12px] bg-card-bg border border-border p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                  {c.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-foreground">{c.name}</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[rgba(72,199,142,0.12)] text-accent-green border border-[rgba(72,199,142,0.2)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                      Connected
                    </span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-3">{c.desc}</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={c.onSync}
                      className="h-8 px-3 bg-card-bg border border-border rounded-md text-[12px] font-medium text-text-secondary hover:border-border-hover transition-colors"
                    >
                      Sync now
                    </button>
                    <button
                      type="button"
                      onClick={c.onDisconnect}
                      className="text-[12px] text-text-ghost hover:text-accent-red transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                  {c.lastSynced && (
                    <p className="text-[11px] text-text-ghost mt-2">
                      Last synced {c.lastSynced}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // State 2: Has a dependency not met
        if (c.requiresNote) {
          return (
            <div key={c.key} className="rounded-[12px] bg-card-bg border border-border p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 opacity-50">
                  {c.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground mb-1">{c.name}</h3>
                  <p className="text-[13px] text-text-secondary mb-2">{c.desc}</p>
                  <p className="text-[12px] text-text-tertiary">{c.requiresNote}</p>
                </div>
              </div>
            </div>
          );
        }

        // State 3: Available — show Connect button or custom slot
        if (c.available) {
          return (
            <div key={c.key} className="rounded-[12px] bg-card-bg border border-border p-5 hover:border-border-hover transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                  {c.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground mb-1">{c.name}</h3>
                  <p className="text-[13px] text-text-secondary mb-3">{c.desc}</p>
                  {c.customSlot ? c.customSlot : (
                    <button
                      type="button"
                      onClick={c.onConnect}
                      className="h-9 px-4 bg-cta-bg text-cta-text rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity"
                    >
                      Connect {c.name}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // State 4: Coming soon
        return (
          <div key={c.key} className="rounded-[12px] bg-card-bg border border-border p-5 opacity-50">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-foreground">{c.name}</h3>
                  <span className="text-[11px] text-text-ghost">Coming soon</span>
                </div>
                <p className="text-[13px] text-text-secondary">{c.desc}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Website scraper / Business context */}
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-[13px] font-medium text-text-secondary mb-3">
          Product context
        </p>
        <BusinessContextCard projectId={projectId} />
      </div>
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

function SettingsPageInner() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("Workspace");
  const [projectId, setProjectId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const callbackHandled = useRef(false);

  useEffect(() => {
    getOrCreateDefaultProject().then((p) => setProjectId(p.id)).catch(() => {});
  }, []);

  // ── OAuth callback handler ──
  // After GitHub/Google redirects back with ?code=, exchange it for tokens
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !projectId || callbackHandled.current) return;
    callbackHandled.current = true;

    const redirectUri = `${window.location.origin}/settings`;

    // Determine provider: GitHub state is base64 JSON, Gmail state is "projectId:userId"
    let isGitHub = false;
    try {
      const decoded = atob(state || "");
      if (decoded.includes("project_id")) isGitHub = true;
    } catch {
      // Not valid base64 → Gmail format
    }

    const toastId = toast.loading(isGitHub ? "Connecting GitHub..." : "Connecting Gmail...");

    const callback = isGitHub
      ? handleGitHubCallback(code, projectId, redirectUri)
      : handleGmailCallback(code, projectId, redirectUri);

    callback
      .then(() => {
        toast.success(isGitHub ? "GitHub connected!" : "Gmail connected!", { id: toastId });
        setActiveTab("Integrations");
        queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
        router.replace("/settings", { scroll: false });
      })
      .catch(() => {
        toast.error("Connection failed. Please try again.", { id: toastId });
        router.replace("/settings", { scroll: false });
      });
  }, [searchParams, projectId, queryClient, router]);

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

      {activeTab === "Integrations" &&
        (projectId ? (
          <IntegrationsTab projectId={projectId} />
        ) : (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ))}

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

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="md" /></div>}>
      <SettingsPageInner />
    </Suspense>
  );
}
