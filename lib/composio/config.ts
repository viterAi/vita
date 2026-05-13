import { getComposioClient } from "@/lib/composio/client";

export type ComposioProvider = "github" | "google" | "microsoft";

const TOOLKIT_SLUG: Record<ComposioProvider, string> = {
  github: "github",
  google: "gmail",
  microsoft: "outlook",
};

const authConfigCache = new Map<string, string>();

/** Scopes required to list org memberships and auto-install repo webhooks. */
const GITHUB_OAUTH_SCOPES = [
  "repo",
  "user",
  "gist",
  "notifications",
  "project",
  "workflow",
  "codespace",
  "read:org",
  "admin:repo_hook",
] as const;

async function ensureGithubAuthConfigScopes(authConfigId: string): Promise<void> {
  const composio = getComposioClient();
  const cfg = await composio.authConfigs.get(authConfigId);
  const scopeList = cfg.credentials?.scopes;
  const current = new Set(Array.isArray(scopeList) ? scopeList : []);
  const missing = GITHUB_OAUTH_SCOPES.filter((s) => !current.has(s));
  if (missing.length === 0) return;

  const merged = [...new Set([...current, ...GITHUB_OAUTH_SCOPES])];
  await composio.authConfigs.update(authConfigId, {
    type: "default",
    scopes: merged.join(","),
  });
}

/** Resolve the Composio auth config (`ac_…`) for a provider from the project API. */
export async function resolveComposioAuthConfigId(provider: ComposioProvider): Promise<string> {
  const slug = TOOLKIT_SLUG[provider];
  const cached = authConfigCache.get(slug);
  if (cached) return cached;

  const composio = getComposioClient();
  let list = await composio.authConfigs.list({ toolkit: slug, isComposioManaged: true });
  let id = list.items?.[0]?.id;

  if (!id) {
    list = await composio.authConfigs.list({ toolkit: slug });
    id = list.items?.[0]?.id;
  }

  if (!id) {
    throw new Error(
      `No Composio auth config for toolkit "${slug}". Enable ${slug} (managed OAuth) in your Composio project.`,
    );
  }

  if (provider === "github") {
    await ensureGithubAuthConfigScopes(id);
  }

  authConfigCache.set(slug, id);
  return id;
}

export function appBaseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}
