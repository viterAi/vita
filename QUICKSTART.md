# Vita — Quick start (users)

Vita is hosted at **[https://vita-web-ten.vercel.app/](https://vita-web-ten.vercel.app/)**. You do not need to install anything locally. Sign in, connect your sources in **Corn jobs**, then explore synthesized views in the main workspace.

---


## 1. Sign in

1. Open [https://vita-web-ten.vercel.app/](https://vita-web-ten.vercel.app/).
2. Enter your **email** and **password**.
3. Click **Sign in**.

You land on the main workspace. If you are not signed in, any page redirects you back to the login screen.

---

## 2. Open Corn jobs

**Corn jobs** is where you connect external services so Vita can ingest events (commits, PRs, issues, or email).

Open it from either place:

- **Left sidebar** — click **Corn jobs** at the bottom of the **Sources** panel.
- **Empty canvas** — if nothing is connected yet, the center area shows a prompt with **Open Corn jobs**.

The Corn jobs page title is **Corn jobs** with the subtitle: *Connect GitHub repos, Gmail, or Outlook — events are synthesized automatically.*

---

## 3. Connect a service

1. Click **+ Connect service**.
2. Choose a provider:

   | Service | What gets ingested |
   |---------|-------------------|
   | **GitHub** | Commits, pull requests, and issues (via webhook after you authorize) |
   | **Gmail** | Incoming mail (polled about every 5 minutes after you authorize) |
   | **Outlook** | Incoming mail (polled about every 5 minutes after you authorize) |

3. **Authorize** — a popup opens. Sign in to the provider and approve access. When finished, the popup closes automatically.
4. **Pick a target** — select a repo (GitHub) or mailbox (Gmail / Outlook). You can search the list if you have many.
5. **Confirm** — Vita suggests an agent goal from the repo or mailbox description. You can expand **Advanced** to edit it, then click **Connect**.
6. **Done** — the modal shows success and closes. Your connection appears as a card with a green **Live** indicator.

To connect more sources, click **+ Connect service** again.

### Tips

- If the auth popup does not appear, allow popups for this site and try again.
- **GitHub:** webhook setup is handled for you in most cases. If webhook install fails, the done step may show a URL to add manually in GitHub repo settings — copy it there and reconnect if needed.
- **Gmail / Outlook:** you do not configure cron or polling yourself; the hosted app checks mailboxes on a schedule after you connect.
- To disconnect a source, open the **···** menu on its card and choose **Remove**.

---

## 4. Browse sources

After a successful connection:

1. Leave Corn jobs by selecting a **source** in the left **Sources** sidebar (or click any source name under a channel such as **GitHub**, **Gmail**, or **Outlook**).
2. Connected services show up grouped by channel. Expand a channel to see individual repos or mailboxes.
3. Click a source to open it in the main canvas.

If the sidebar still says **No sources connected**, refresh the page or return to Corn jobs and confirm the card shows **Live**.

---

## 5. Use the main workspace

The UI has three layers:

| Area | Purpose |
|------|---------|
| **Top bar (Murmur)** | Shows the active source and page title while content loads or updates. |
| **Center (canvas)** | AI-generated multi-page views built from your ingested data. |
| **Bottom (Dock)** | Type messages to steer or ask questions about the current source (when pages exist). |

### First time on a source

When you select a source, Vita **generates** an initial layout. You will see progress while pages are composed. This can take a minute depending on how much data is available.

### Tabs and actions

Above the canvas, the tab bar shows the source name and controls:

- **Page tabs** — switch between generated pages (e.g. overview, detail).
- **Save layout** — appears after generation; saves the current layout as the default for this source.
- **Regenerate** — rebuild the layout from scratch (explicit action; use when you want a fresh design).
- **Refresh** — appears on saved layouts with dynamic components; updates data without changing the layout.

A **Saved** checkmark means your layout is persisted and will load quickly next time without a full regeneration.

### When there is no data yet

New GitHub repos need activity (commits, PRs, or issues) before views are meaningful. New mailboxes need incoming messages; allow a few minutes after connecting for the first poll. Select the source again or use **Refresh** once data has arrived.
---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| **Invalid login** | Confirm email/password with your admin. Password reset is handled in Supabase by your team. |
| **Popup blocked** | Allow popups for `vita-web-ten.vercel.app`, then start connect again. |
| **No tenant / permission error on Corn jobs** | Your user may not be assigned to a team in the database. Contact your admin to add you to `tenant_memberships`. |
| **GitHub connected but no events** | Push a commit or open a PR/issue, or confirm the webhook in GitHub repo **Settings → Webhooks**. |
| **Email connected but empty views** | Wait ~5 minutes for the first mailbox poll, then select the source and use **Refresh**. |
| **Layout looks wrong** | Use **Regenerate** for a new layout, or **Save layout** after you are happy with one. |

