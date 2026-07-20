# Zgram — deployment guide

This is a real, multi-user version of Zgram. Accounts, posts, reels, likes, and
DMs are stored in a Postgres database (via Supabase), not in Claude's sandbox
storage — so it works on a public URL, in any browser, for anyone.

## 1. Create the Supabase project (free)

1. Go to https://supabase.com → Sign up / log in → **New project**.
2. Pick any name/region, set a database password (save it somewhere), wait
   ~2 minutes for it to spin up.
3. In the left sidebar: **SQL Editor** → **New query**.
4. Paste in the entire contents of `supabase-schema.sql` (included in this
   project) and click **Run**. This creates all the tables (`profiles`,
   `posts`, `reels`, `messages`) and the security rules that control who can
   read/write what.
5. In the left sidebar: **Project Settings → API**. Copy:
   - **Project URL** → this is `VITE_SUPABASE_URL`
   - **anon public** key → this is `VITE_SUPABASE_ANON_KEY`
6. Still in Project Settings: **Authentication → Providers → Email** — turn
   **off** "Confirm email" (since Zgram uses usernames, not real email
   addresses, so users can't click a confirmation link).

## 2. Upload this project to your repo

Repo: `https://github.com/threatintel-ops/zgram`
Direct upload page: `https://github.com/threatintel-ops/zgram/upload/main`

Drag every file and folder from this project (including the hidden
`.github` folder — make sure your file browser shows hidden files) into that
upload page, then commit. **Do not upload `node_modules` or `.env`** if you
happen to have created them locally — they're already in `.gitignore` for
when you use git directly, but the web upload doesn't know about
`.gitignore`, so just leave those two out manually.

## 3. Add your Supabase keys as repo secrets

GitHub Pages can't read a `.env` file — the included GitHub Actions workflow
needs your Supabase keys as **repository secrets** instead:

1. In the repo: **Settings → Secrets and variables → Actions → New repository secret**.
2. Add `VITE_SUPABASE_URL` = (Project URL from step 1).
3. Add `VITE_SUPABASE_ANON_KEY` = (anon public key from step 1).

## 4. Turn on GitHub Pages

1. **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.
3. That's it — the included workflow (`.github/workflows/deploy.yml`) builds
   the app and deploys it automatically every time you push/upload to `main`.
4. After the Actions tab shows a green check (takes ~1-2 min), your site is
   live at:
   `https://threatintel-ops.github.io/zgram/`

Any future change: just re-upload the changed files (or `git push` if you
switch to using git locally) — the workflow rebuilds and redeploys on its own.

## 4. Test it

Open your Vercel URL, sign up with a username + password, then open it in a
private/incognito tab and sign up as a second user to test follows, likes,
and DMs between two real accounts.

## Local development (optional)

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

## Known simplifications (worth knowing, especially for your SOC track)

- **Post/reel updates use a broad RLS policy.** Likes/comments need to be
  writable by other users, so the current policy allows any logged-in user
  to update any post row — in theory someone could rewrite another user's
  caption via a raw API call. The proper fix is a Postgres RPC function
  (`security definer`) that only exposes the likes/comments/saved_by fields.
  Good next step once this is live and you want to harden it.
- **Images are stored as base64 text** directly in the database for
  simplicity. Fine for a personal project; at real scale you'd move to
  Supabase Storage (object storage) instead.
- **DMs and the feed poll every few seconds** rather than using Supabase
  Realtime (websockets). Works fine, just not instant. Realtime is a
  straightforward upgrade later if you want it.
