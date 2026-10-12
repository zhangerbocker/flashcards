# Deploying to Vercel

The app lives in `web/`. Production runs on Vercel with a Neon Postgres database; every page and
API route needs the passcode login.

## One-time setup

1. **Import the repo:** Vercel → Add New → Project → `ScharanCysne/mandarin`. Leave **Root Directory**
   to `web` (framework: Next.js, defaults otherwise). Production deploys from `main`.
2. **Add the database:** in the project, Storage → Create → Neon (Postgres), connected to the
   project for all environments. This sets `DATABASE_URL`; tables are created on first request.
3. **Environment variables** (Settings → Environment Variables, Production):

   | Name | Value | Sensitive |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | your personal Anthropic key | yes |
   | `NEXT_PUBLIC_API_KEY_EXPIRES` | last valid day of the key, e.g. `2026-12-31` | no (shown in the expiry notice) |
   | `APP_PASSCODE_HASH` | output of `npx tsx scripts/hash-passcode.ts` (run in `web/`, type the passcode) | yes |
   | `SESSION_SECRET` | output of `openssl rand -base64 32` | yes |

   Generate the last two in your own terminal so the passcode and secret never leave it.
   Never give the API key a `NEXT_PUBLIC_` prefix: only `NEXT_PUBLIC_*` values reach the browser.
4. **Deploy** (Deployments → Redeploy, or push to `main`).

## Bringing over progress from the local app

Browser data belongs to one address, so progress studied at `localhost:3000` doesn't reach the
Vercel URL by itself. Upload it once: copy the Neon connection string (Vercel → Storage → your
database → `.env.local` tab, `DATABASE_URL`), then in `web/`:

    DATABASE_URL='<connection string>' npm run dev

and open `http://localhost:3000/cards` in the browser you studied in. An empty database is filled
from that browser on the first sync. Stop the dev server afterwards.

## Using it

- Open the URL and log in on each device; on the phone, use Share → Add to Home Screen.
- Sessions last 30 days. Ten wrong passcodes lock logins for 15 minutes.

## Renewing the API key

From a week before `NEXT_PUBLIC_API_KEY_EXPIRES` the app shows a notice every time it opens.
Create a new key, update `ANTHROPIC_API_KEY` and `NEXT_PUBLIC_API_KEY_EXPIRES`, and redeploy
(the expiry date is built into the page, so it only changes on a new deployment).

## Local development

`npm run dev` in `web/` uses a local PGlite database in `web/.data/` and no login (unless
`SESSION_SECRET` is set). Set `ANTHROPIC_API_KEY` in the shell for chat and new stories.
