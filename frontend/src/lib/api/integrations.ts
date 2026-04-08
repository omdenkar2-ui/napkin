import { api } from "./client";

export interface Integration {
  provider: string;
  status: "connected" | "disconnected" | "syncing" | "error";
  last_synced?: string;
  last_synced_at?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderCapability {
  available: boolean;
  method: "oauth" | "token" | "webhook";
  requires?: string;
}

export interface Capabilities {
  gmail: ProviderCapability;
  github: ProviderCapability;
  github_issues: ProviderCapability;
  intercom: ProviderCapability;
  whatsapp: ProviderCapability;
}

export async function getCapabilities(): Promise<Capabilities> {
  return api.get<Capabilities>("/integrations/capabilities");
}

export async function listIntegrations(
  projectId: string,
): Promise<Integration[]> {
  return api.get<Integration[]>(
    `/integrations?project_id=${projectId}`,
  );
}

export async function connectGmail(
  projectId: string,
  redirectUri: string,
): Promise<{ auth_url: string }> {
  return api.post<{ auth_url: string }>("/integrations/gmail/connect", {
    project_id: projectId,
    redirect_uri: redirectUri,
  });
}

export async function handleGmailCallback(
  code: string,
  projectId: string,
  redirectUri: string,
): Promise<void> {
  await api.post("/integrations/gmail/callback", {
    code,
    project_id: projectId,
    redirect_uri: redirectUri,
  });
}

export async function syncGmail(
  projectId: string,
): Promise<{ synced: number; skipped: number; errors: number }> {
  return api.post<{ synced: number; skipped: number; errors: number }>(
    "/integrations/gmail/sync",
    { project_id: projectId },
  );
}

export async function connectGitHub(
  projectId: string,
  redirectUri: string,
): Promise<{ auth_url: string }> {
  return api.post<{ auth_url: string }>("/integrations/github/connect", {
    project_id: projectId,
    redirect_uri: redirectUri,
  });
}

export async function handleGitHubCallback(
  code: string,
  projectId: string,
  redirectUri: string,
): Promise<void> {
  await api.post("/integrations/github/callback", {
    code,
    project_id: projectId,
    redirect_uri: redirectUri,
  });
}

export async function syncGitHub(
  projectId: string,
): Promise<Record<string, unknown>> {
  return api.post<Record<string, unknown>>("/integrations/github/sync", {
    project_id: projectId,
  });
}

export async function getRepoContext(
  projectId: string,
): Promise<{
  summary: string;
  last_synced?: string;
  repo_name?: string;
  metadata?: Record<string, unknown>;
} | null> {
  return api.get(`/integrations/github/context?project_id=${projectId}`);
}

export async function scrapeWebsite(
  projectId: string,
  url: string,
): Promise<{ status: string; product_name?: string }> {
  return api.post("/integrations/website/scrape", {
    project_id: projectId,
    url,
  });
}

export async function getBusinessContext(
  projectId: string,
): Promise<{
  product_name?: string;
  core_value_prop?: string;
  target_customer?: string;
  pricing_model?: string;
  url?: string;
} | null> {
  return api.get(`/integrations/website/context?project_id=${projectId}`);
}

export async function syncGitHubIssues(
  projectId: string,
): Promise<{ items_synced: number; issues_scanned: number; feedback_found: number }> {
  return api.post<{ items_synced: number; issues_scanned: number; feedback_found: number }>(
    "/integrations/github-issues/sync",
    { project_id: projectId },
  );
}

export async function connectIntercom(
  projectId: string,
  accessToken: string,
): Promise<{ status: string }> {
  return api.post<{ status: string }>("/integrations/intercom/connect", {
    project_id: projectId,
    access_token: accessToken,
  });
}

export async function syncIntercom(
  projectId: string,
): Promise<{ items_synced: number; conversations_scanned: number }> {
  return api.post<{ items_synced: number; conversations_scanned: number }>(
    "/integrations/intercom/sync",
    { project_id: projectId },
  );
}

export async function disconnectIntegration(
  provider: string,
  projectId: string,
): Promise<void> {
  await api.delete(
    `/integrations/${provider}?project_id=${projectId}`,
  );
}
