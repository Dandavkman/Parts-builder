# Accounts and keys (owner task O0.3)

Create only what the current phase needs. Save every key in a password manager first, then put it in the places listed in "Where keys go". Never paste a key into a chat, an issue, a pull request or a commit.

## Where keys go

| Place | What goes there | When |
| --- | --- | --- |
| Password manager | Every key, as you create it. Several services show a secret only once. | Always |
| `apps/web/.env.local` on your computer | Keys the web app reads while you run it locally. Git ignores this file. Next.js only reads env files inside `apps/web/`, not the repo root. | When you run the app |
| Claude Code environment (title bar menu, then Edit, then Network secrets or environment variables) | Test and development keys the Builder needs to run things in its own session. Use the exact variable names. New sessions pick them up. | Only when a task needs them (see below) |
| Vercel and Fly.io dashboards | Production keys, pasted by you into their own settings | At deployment |

Never put live (production) Stripe keys in the Claude Code environment.

## Order

1. **GitHub**: turn on two-factor login (Settings, Password and authentication).
2. **Clerk** (sign-in), needed now for B0.4. Sign up at dashboard.clerk.com, create an application called "Parts Builder", turn on Email and Google, then open API keys and copy the Publishable key (`pk_test_...`) and Secret key (`sk_test_...`). Put them in `apps/web/.env.local` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
3. **Anthropic Console** (the AI), needed from B1.8. At console.anthropic.com add prepaid credits under Billing, **set a monthly spend limit** under Limits, then create an API key called `parts-builder-dev`. Variable: `ANTHROPIC_API_KEY`. Local file and Claude environment.
4. **Vercel** (hosting): sign up with GitHub. Do not import the repo yet.
5. **Cloudflare R2** (file storage), needed from B1.1. Enable R2 (it asks for a card; there is a free allowance), create a bucket called `parts-builder-dev`, then create an R2 API token with Object Read & Write limited to that bucket. Copy the Access Key ID, Secret Access Key and your Account ID. Variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=parts-builder-dev`. Local file and Claude environment.
6. **Fly.io** (geometry workers): later, when deployment is set up.
7. **Stripe** (payments), Phase 2. Test mode only until owner task O2.4.

## Check that it works

```
(cd services/geometry && uv run uvicorn geometry.api:app --port 8000)   # terminal 1
pnpm --filter @parts-builder/web dev                                    # terminal 2
```

Open http://localhost:3000/dashboard. You should be sent to sign in, then land on the dashboard. Open `/viewer`: the plate should appear and orbit when dragged.
