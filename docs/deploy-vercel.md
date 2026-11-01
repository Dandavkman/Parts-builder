# Deploy the web app to Vercel (owner task O0.8)

The web app deploys to Vercel straight from this repo. Every push to `main` goes live, and every pull request gets its own preview link, so you can review work in a browser without installing anything.

You need: the Clerk keys (`pk_test_...` and `sk_test_...`, from task O0.3) and a GitHub login.

## Steps

1. Go to **vercel.com** and sign in with **Continue with GitHub**. The free Hobby plan is fine while you are building.
2. Click **Add New...**, then **Project**.
3. Find **Dandavkman/Parts-builder** in the list and click **Import**. If it is not listed, click **Adjust GitHub App Permissions**, choose the repo, save, and come back.
4. On the **Configure Project** screen:
   - **Framework Preset** should say **Next.js**. Leave it.
   - **Root Directory**: click **Edit**, choose **apps/web**, and click **Continue**. This is the one setting people miss.
   - Leave the Build and Install commands alone.
   - Leave **Include source files outside of the Root Directory** switched on.
5. Open **Environment Variables** on the same screen and add these. You can paste all the lines into the first name field at once and Vercel splits them. Leave all three environment boxes ticked.

   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
   ```

   Do not add `ALLOW_UNAUTHENTICATED_DEV`. It is for local development only and is ignored in production.
6. Click **Deploy**. It takes one to two minutes.
7. Click **Visit**. Open **Dashboard** from the menu. You should be sent to a sign-in page. Create an account, and you should land on the dashboard with three empty boxes.

## What to expect

- **The Viewer page shows "Could not load the plate."** That is correct for now. The viewer asks the geometry service for the plate, and that service is not deployed yet (task B0.7, on Fly.io; follow `docs/deploy-fly.md` when you are ready). Everything else works.
- **Production link vs preview links.** The main link is public. Vercel puts preview links behind a Vercel login by default, so you may be asked to sign in to open one.
- **Adding or changing a variable later** only affects the next deployment. After changing one, open **Deployments**, click the three dots on the latest one, and choose **Redeploy**.

## If something goes wrong

| What you see | What it means |
| --- | --- |
| The page says "This site is not available right now" | The app cannot find both Clerk keys. Check the two names are spelled exactly as above with no spaces, then redeploy. |
| The build fails (red) | Open the build log and copy the red error lines to me. Do not copy any keys. |
| Clerk shows an error, or sign-in loops | Send me the exact words on screen. |

## Custom domain (ktiso.app)

Added 2026-11-01. In Vercel, Settings, Domains: `ktiso.app` is connected to Production with no redirect (it is the main address), and `www.ktiso.app` redirects to it. In Cloudflare, DNS records: an `A` record for `@` pointing at `76.76.21.21` and a `CNAME` for `www` pointing at `cname.vercel-dns.com`, both **DNS only** (grey cloud) so Vercel can issue the HTTPS certificate. `.app` domains work only over HTTPS. Use the values Vercel shows if they differ.

Then set `SITE_URL=https://ktiso.app` (Production) and redeploy. It feeds the sitemap, robots file, the page `metadataBase` and each page's canonical link. Other services tied to the domain: Clerk production instance (domain and its CNAME records), the Stripe webhook `https://ktiso.app/api/stripe/webhook`, and Resend (verify `ktiso.app`, then set `EMAIL_FROM`). `contact@ktiso.app` needs an inbox, for example Cloudflare Email Routing.

## Variables added later

| Variable | Needed from |
| --- | --- |
| `ANTHROPIC_API_KEY` | B1.8 (design agent) |
| `DATABASE_URL` | B1.8b (Neon pooled connection string; tick Sensitive; read at request time, tables are created on first use) |
| `DESIGN_AGENT_MODEL` | B1.8a (optional; model id for the design agent, default `claude-sonnet-5-5`) |
| `DESIGN_AGENT_WEB_SEARCH` | B1.16 (optional; `off` stops the agent searching the web for product measurements, which costs about 1 cent per search; the Anthropic Console must allow web search for it to work, and the agent carries on without it if it does not) |
| `DESIGN_AGENT_SPEC_VERSION` | B1.17d (optional; set to `2.0` to let the design agent write Part Spec 2.0 solid bodies such as vases, boxes and knobs, or `2.1` to add blind bores and separate top and bottom round-overs (B1.22). Set it only after `fly deploy` has put that Part Spec on the geometry service, otherwise builds of those specs fail; leave it empty to keep 1.1. Any other value keeps 1.1) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | B1.1 (scan upload) |
| `GEOMETRY_SERVICE_URL` | B0.7 (address of the Fly.io geometry service) |
| `LIMITS_ENFORCED` | B2.1 (optional; `1` enforces the abuse limits on AI messages and saved designs, the same for everyone. The limits in `lib/limits.ts` are placeholders until you decide them; leave empty and nobody is blocked. Replaces `PLANS_ENFORCED`; delete `PLANS_ENFORCED`, `STRIPE_PRO_PRICE_ID` and `PRO_PRICE_CONFIRMED` from Vercel if you set them) |
| `RESEND_API_KEY` | B2.9 (optional; API key from resend.com, server-side only. With `EMAIL_FROM` it turns on order emails; without them emails are only logged) |
| `EMAIL_FROM` | B2.9 (optional; the From line, for example `Parts Builder <orders@yourdomain.com>`, on a domain verified in Resend) |
| `SITE_URL` | B3.2 (optional; the public address, for the sitemap, page metadata and canonical links, for example `https://yourdomain.com`. Falls back to the Vercel production URL) |
| `SENTRY_DSN` | B2.11c (optional; the project DSN from sentry.io, server-side only. Without it, errors are only logged to the console) |
| `STRIPE_CONNECT` | B4.1 (optional; `1` turns on seller payout setup, with `STRIPE_SECRET_KEY`. Use a test key first) |
| `CONNECT_TERMS_CONFIRMED` | B4.1 (optional; `1` once the platform fee and payout rules are real. Until then a live Stripe key is refused for Connect) |
| `ADMIN_USER_IDS` | B2.7 (comma separated Clerk user ids allowed into `/admin/orders`, for example your own user id from the Clerk dashboard; server-side only; empty means nobody is an admin) |
| `STRIPE_SECRET_KEY` | B2.6b (Stripe secret key, a `sk_test_` key for now; server-side only. When set, checkout uses Stripe instead of the stub. A `sk_live_` key is refused while prices are placeholders) |
| `STRIPE_WEBHOOK_SECRET` | B2.6b (signing secret of the Stripe webhook endpoint `https://<site>/api/stripe/webhook`, event `checkout.session.completed`; server-side only; without it the webhook answers 503 and orders stay unpaid) |
| `STRIPE_TAX` | B2.6b (optional; `1` turns on Stripe Tax at checkout, only after Stripe Tax is set up) |
| `PAYMENTS_STUB` | B2.6a (optional; `1` lets checkout mark orders paid with no real payment, for demos and testing. Leave empty in production: ordering then answers "not open yet" until the Stripe provider arrives in B2.6b) |
| `GEOMETRY_SERVICE_TOKEN` | B1.11c (shared secret; must equal the Fly secret of the same name; server-side only, never `NEXT_PUBLIC_`) |
| Stripe keys | Phase 2 |

Vercel's free Hobby plan is for non-commercial use. Move to the paid plan before taking real orders (Phase 2).
