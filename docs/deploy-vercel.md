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
| `PLANS_ENFORCED` | B2.1a (optional; `1` enforces the Free and Pro limits on AI messages, saved designs and STEP export. The limits in `lib/plans.ts` are placeholders until you decide them; leave empty and nobody is blocked) |
| `ADMIN_USER_IDS` | B2.7 (comma separated Clerk user ids allowed into `/admin/orders`, for example your own user id from the Clerk dashboard; server-side only; empty means nobody is an admin) |
| `PAYMENTS_STUB` | B2.6a (optional; `1` lets checkout mark orders paid with no real payment, for demos and testing. Leave empty in production: ordering then answers "not open yet" until the Stripe provider arrives in B2.6b) |
| `GEOMETRY_SERVICE_TOKEN` | B1.11c (shared secret; must equal the Fly secret of the same name; server-side only, never `NEXT_PUBLIC_`) |
| Stripe keys | Phase 2 |

Vercel's free Hobby plan is for non-commercial use. Move to the paid plan before taking real orders (Phase 2).
