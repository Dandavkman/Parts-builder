# Accounts and keys (owner task O0.3)

Create only what the current phase needs. Save every key in a password manager first, then put it in the places listed in "Where keys go". Never paste a key into a chat, an issue, a pull request or a commit.

The web app runs on Vercel, so **Vercel's Environment Variables screen is where the keys live** (see `docs/deploy-vercel.md`). A local file is only needed if you also run the app on your own computer.

## Where keys go

| Place | What goes there | When |
| --- | --- | --- |
| Password manager | Every key, as you create it. Several services show a secret only once. | Always |
| **Vercel** (project, Settings, Environment Variables) | Every key the web app reads. This is the main place. | Now |
| Fly.io secrets | Keys the geometry service reads | When B0.7 deploys it |
| `apps/web/.env.local` on your computer | Same keys, only if you run the app locally. Git ignores this file. Next.js only reads env files inside `apps/web/`, not the repo root. | Optional |
| Claude Code environment (title bar menu, then Edit, then Network secrets or environment variables) | Test and development keys the Builder needs in its own session. Use the exact variable names. New sessions pick them up. | Only when a task needs them |

Never put live (production) Stripe keys in the Claude Code environment.

## Order

1. **GitHub**: turn on two-factor login (Settings, Password and authentication).
2. **Clerk** (sign-in), needed now. Sign up at dashboard.clerk.com, create an application called "Parts Builder", turn on Email and Google, then open **API keys** and copy the Publishable key (`pk_test_...`) and Secret key (`sk_test_...`). They go into Vercel as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (step 3). Do not run any `clerk init` command from Clerk's setup prompt: the app already has Clerk built in.
3. **Vercel** (hosting), needed now. Follow `docs/deploy-vercel.md`.
4. **Anthropic Console** (the AI), needed from B1.8. At console.anthropic.com add prepaid credits under Billing, **set a monthly spend limit** under Limits, then create an API key called `parts-builder-dev`. Variable: `ANTHROPIC_API_KEY`. Add it to Vercel and the Claude environment.
5. **Fly.io** (geometry service). **Deferred to Phase 1**: nothing before then needs it, so you do not need a card yet. When it is time: Fly.io needs a credit card or prepaid credits. Fly reportedly refuses prepaid cards as the saved card but lets you buy prepaid credits with one (about $25 minimum), and credits also cap what you can spend. Check Fly's billing page for current terms and set a billing alert. Then follow `docs/deploy-fly.md`; it ends with you pasting one address into Vercel (`GEOMETRY_SERVICE_URL`).
6. **Cloudflare R2** (file storage), needed from B1.1. Enable R2 (it asks for a card; there is a free allowance), create a bucket called `parts-builder-dev`, then create an R2 API token with Object Read & Write limited to that bucket. Copy the Access Key ID, Secret Access Key and your Account ID. Variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=parts-builder-dev`. Add them to Vercel and the Claude environment.
7. **Stripe** (payments), Phase 2. Test mode only until owner task O2.4.

## Check that it works

Open your Vercel link, then **Dashboard**. You should be sent to sign in, then land on the dashboard. The **Viewer** shows "Could not load the plate" until the geometry service is deployed (B0.7).

### Optional: run it on your own computer

Needs Node 22, pnpm 10 and uv.

```
cp apps/web/.env.example apps/web/.env.local     # paste the keys into it
(cd services/geometry && uv sync && uv run uvicorn geometry.api:app --port 8000)   # terminal 1
pnpm install && pnpm --filter @parts-builder/web dev                               # terminal 2
```

Open http://localhost:3000/dashboard. The Viewer shows the plate in this setup, because the geometry service runs on your computer.
