/**
 * Turn a GitHub webhook JSON body into user-facing L2 fields (commits, PRs, issues).
 * Internal ingest metadata stays out of the returned object.
 */

export type GitHubEventPayload = {
  source: "github";
  event_type: string;
  action?: string;
  repo: string;
  title: string;
  actor: string;
  occurred_at: string;
  url?: string;
  ref?: string;
  body?: string;
  commit_count?: number;
  /** Short commit messages or PR/issue bullets for activity feeds. */
  highlights: string[];
};

type JsonRecord = Record<string, unknown>;

function asRecord(v: unknown): JsonRecord | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as JsonRecord) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function login(v: unknown): string | undefined {
  const r = asRecord(v);
  return str(r?.login) ?? str(r?.name);
}

function repoFullName(j: JsonRecord): string {
  return (
    str(asRecord(j.repository)?.full_name) ??
    str(asRecord(j.organization)?.login) ??
    "unknown/repo"
  );
}

function branchFromRef(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  return ref.replace(/^refs\/heads\//, "").replace(/^refs\/tags\//, "tag:");
}

function firstLine(message: string): string {
  return message.split("\n")[0]?.trim() ?? message.trim();
}

function inferEventType(j: JsonRecord): string {
  if (Array.isArray(j.commits) && str(j.ref)) return "push";
  if (asRecord(j.pull_request)) return "pull_request";
  if (asRecord(j.issue) && !asRecord(j.pull_request)) return "issues";
  if (asRecord(j.release)) return "release";
  if (asRecord(j.comment)) return "comment";
  if (str(j.zen)) return "ping";
  return str(j.action) ? `github.${j.action}` : "github";
}

/** Parse webhook JSON into fields the canvas should show (not ingest job internals). */
export function parseGitHubWebhookPayload(rawBody: string): GitHubEventPayload | null {
  let j: JsonRecord;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    const r = asRecord(parsed);
    if (!r) return null;
    j = r;
  } catch {
    return null;
  }

  const repo = repoFullName(j);
  const eventType = inferEventType(j);
  const action = str(j.action);

  if (eventType === "ping") {
    return {
      source: "github",
      event_type: "ping",
      repo,
      title: "Webhook connected",
      actor: login(j.sender) ?? "github",
      occurred_at: new Date().toISOString(),
      highlights: [str(j.zen) ?? "GitHub webhook is active"],
    };
  }

  if (eventType === "push") {
    const commits = Array.isArray(j.commits) ? j.commits : [];
    const ref = branchFromRef(str(j.ref));
    const messages = commits
      .map((c) => {
        const row = asRecord(c);
        return row ? firstLine(str(row.message) ?? "") : "";
      })
      .filter(Boolean)
      .slice(0, 12);
    const pusher = login(j.pusher) ?? login(asRecord(j.sender)) ?? "unknown";
    const compare = str(j.compare);
    const latest = commits.length > 0 ? asRecord(commits[commits.length - 1]) : null;
    const occurred =
      str(latest?.timestamp) ??
      str(asRecord(j.head_commit)?.timestamp) ??
      new Date().toISOString();

    return {
      source: "github",
      event_type: "push",
      action,
      repo,
      title: ref ? `Push to ${ref}` : "Push",
      actor: pusher,
      occurred_at: occurred,
      url: compare,
      ref,
      commit_count: commits.length,
      highlights: messages.length > 0 ? messages : ["(no commit messages in payload)"],
    };
  }

  if (eventType === "pull_request") {
    const pr = asRecord(j.pull_request)!;
    const user = login(pr.user) ?? login(j.sender) ?? "unknown";
    const title = str(pr.title) ?? "Pull request";
    const verb = action ? `${action} ` : "";
    return {
      source: "github",
      event_type: "pull_request",
      action,
      repo,
      title: `${verb}${title}`.trim(),
      actor: user,
      occurred_at: str(pr.updated_at) ?? str(pr.created_at) ?? new Date().toISOString(),
      url: str(pr.html_url),
      body: str(pr.body)?.slice(0, 2000),
      highlights: [
        `State: ${str(pr.state) ?? "unknown"}`,
        ...(str(pr.merged_at) ? ["Merged"] : []),
      ],
    };
  }

  if (eventType === "issues") {
    const issue = asRecord(j.issue)!;
    const user = login(issue.user) ?? login(j.sender) ?? "unknown";
    const title = str(issue.title) ?? "Issue";
    const verb = action ? `${action} ` : "";
    return {
      source: "github",
      event_type: "issues",
      action,
      repo,
      title: `${verb}${title}`.trim(),
      actor: user,
      occurred_at: str(issue.updated_at) ?? str(issue.created_at) ?? new Date().toISOString(),
      url: str(issue.html_url),
      body: str(issue.body)?.slice(0, 2000),
      highlights: [str(issue.state) ? `State: ${issue.state}` : "Issue update"],
    };
  }

  if (eventType === "release") {
    const rel = asRecord(j.release)!;
    const tag = str(rel.tag_name);
    return {
      source: "github",
      event_type: "release",
      action,
      repo,
      title: tag ? `Release ${tag}` : "Release",
      actor: login(j.sender) ?? "unknown",
      occurred_at: str(rel.published_at) ?? str(rel.created_at) ?? new Date().toISOString(),
      url: str(rel.html_url),
      body: str(rel.body)?.slice(0, 2000),
      highlights: [str(rel.name) ?? tag ?? "New release"],
    };
  }

  return {
    source: "github",
    event_type: eventType,
    action,
    repo,
    title: action ? `GitHub ${action}` : "GitHub event",
    actor: login(j.sender) ?? "unknown",
    occurred_at: new Date().toISOString(),
    highlights: [],
  };
}

const GITHUB_INTERNAL_PAYLOAD_KEYS = new Set([
  "schema_version",
  "ingest_kind",
  "last_n_count",
  "synthesized_at",
  "agent_goal",
  "model",
  "stub",
  "raw_preview",
]);

/** Strip ingest internals; map legacy synthesis rows to GitHub-shaped fields for the canvas. */
export function normalizeGithubPayloadForDisplay(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof payload.event_type === "string" && typeof payload.title === "string") {
    const out: Record<string, unknown> = { ...payload };
    for (const k of GITHUB_INTERNAL_PAYLOAD_KEYS) delete out[k];
    return out;
  }

  const summary = typeof payload.summary === "string" ? payload.summary : "";
  const highlights = Array.isArray(payload.highlights)
    ? payload.highlights.filter((h): h is string => typeof h === "string")
    : [];

  return {
    source: "github",
    event_type: "activity",
    title: summary.slice(0, 160) || "GitHub activity",
    actor: "unknown",
    occurred_at:
      typeof payload.synthesized_at === "string" ? payload.synthesized_at : new Date().toISOString(),
    repo: typeof payload.repo === "string" ? payload.repo : "",
    summary,
    highlights,
  };
}
