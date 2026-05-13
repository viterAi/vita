import { executeComposioTool } from "@/lib/composio/execute";

export type GitHubRepoSummary = {
  full_name: string;
  description: string;
  private: boolean;
  pushed_at?: string;
  owner: string;
  is_org_repo: boolean;
  /** True when GitHub reports admin permission (required for auto webhook install). */
  can_install_webhook: boolean;
};

type RawGitHubRepo = {
  full_name?: string;
  description?: string | null;
  private?: boolean;
  pushed_at?: string;
  owner?: { login?: string; type?: string };
  permissions?: { admin?: boolean };
};

type RawGitHubOrg = {
  login?: string;
};

const MAX_REPOS = 500;
const MAX_PAGES = 5;

function listFromPayload(data: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  for (const key of keys) {
    const list = record[key];
    if (Array.isArray(list)) return list;
  }
  return [];
}

function reposFromPayload(data: unknown): RawGitHubRepo[] {
  return listFromPayload(data, "repositories", "details", "items") as RawGitHubRepo[];
}

function orgsFromPayload(data: unknown): RawGitHubOrg[] {
  return listFromPayload(data, "organizations", "details") as RawGitHubOrg[];
}

function toSummary(repo: RawGitHubRepo, orgLogins: Set<string>): GitHubRepoSummary | null {
  const fullName = repo.full_name?.trim();
  if (!fullName) return null;
  const owner = repo.owner?.login ?? fullName.split("/")[0] ?? "";
  const isOrgOwner = repo.owner?.type === "Organization";
  return {
    full_name: fullName,
    description: repo.description ?? "",
    private: Boolean(repo.private),
    pushed_at: repo.pushed_at,
    owner,
    is_org_repo: isOrgOwner || orgLogins.has(owner),
    can_install_webhook: repo.permissions?.admin === true,
  };
}

function sortRepos(repos: GitHubRepoSummary[]): GitHubRepoSummary[] {
  return [...repos].sort((a, b) => {
    const ta = a.pushed_at ? Date.parse(a.pushed_at) : 0;
    const tb = b.pushed_at ? Date.parse(b.pushed_at) : 0;
    return tb - ta;
  });
}

async function listAuthenticatedUserRepos(
  userId: string,
  connectedAccountId: string,
): Promise<RawGitHubRepo[]> {
  const merged: RawGitHubRepo[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await executeComposioTool({
      slug: "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
      userId,
      connectedAccountId,
      arguments: {
        page,
        per_page: 100,
        sort: "pushed",
        type: "all",
        direction: "desc",
      },
    });
    const batch = reposFromPayload(data);
    if (batch.length === 0) break;
    for (const repo of batch) {
      const key = repo.full_name?.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(repo);
    }
    if (batch.length < 100) break;
  }

  return merged;
}

async function listOrgLogins(userId: string, connectedAccountId: string): Promise<string[]> {
  const logins = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await executeComposioTool({
      slug: "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER",
      userId,
      connectedAccountId,
      arguments: { page, per_page: 100 },
    });
    const batch = orgsFromPayload(data);
    if (batch.length === 0) break;
    for (const org of batch) {
      const login = org.login?.trim();
      if (login) logins.add(login);
    }
    if (batch.length < 100) break;
  }

  return [...logins];
}

async function listOrgRepos(
  userId: string,
  connectedAccountId: string,
  org: string,
): Promise<RawGitHubRepo[]> {
  const merged: RawGitHubRepo[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await executeComposioTool({
      slug: "GITHUB_LIST_ORGANIZATION_REPOSITORIES",
      userId,
      connectedAccountId,
      arguments: {
        org,
        page,
        per_page: 100,
        sort: "pushed",
        type: "all",
        direction: "desc",
      },
    });
    const batch = reposFromPayload(data);
    if (batch.length === 0) break;
    for (const repo of batch) {
      const key = repo.full_name?.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(repo);
    }
    if (batch.length < 100) break;
  }

  return merged;
}

/** Personal, collaborator, and organization repos visible to the connected GitHub account. */
export async function listGitHubReposForConnect(
  userId: string,
  connectedAccountId: string,
): Promise<GitHubRepoSummary[]> {
  const [userRepos, orgLogins] = await Promise.all([
    listAuthenticatedUserRepos(userId, connectedAccountId),
    listOrgLogins(userId, connectedAccountId),
  ]);

  const orgSet = new Set(orgLogins);
  const orgRepoBatches = await Promise.all(
    orgLogins.map(async (org) => {
      try {
        return await listOrgRepos(userId, connectedAccountId, org);
      } catch {
        return [] as RawGitHubRepo[];
      }
    }),
  );

  const byName = new Map<string, GitHubRepoSummary>();
  for (const raw of [...userRepos, ...orgRepoBatches.flat()]) {
    const summary = toSummary(raw, orgSet);
    if (summary) byName.set(summary.full_name, summary);
  }

  return sortRepos([...byName.values()]).slice(0, MAX_REPOS);
}
