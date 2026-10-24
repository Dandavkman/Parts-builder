# Parts Builder

Design custom car parts that fit your exact car. Upload a 3D scan (or rent one from our library), describe the part in plain English, and order it printed in nylon, carbon fiber or metal. Designers can sell their parts through their own branded store, and we print every order on demand.

## Status

Phase 0: Foundations. The monorepo scaffold is in place. Next: deploy the web app to Vercel, then the geometry service to Fly.io.

## Checks

```
pnpm install
pnpm lint && pnpm typecheck && pnpm test            # TypeScript (Node 22, pnpm 10)
cd services/geometry && uv sync && uv run pytest     # Python (3.12+, uv)
```

## Deploying

The web app deploys to Vercel straight from this repo (root directory `apps/web`), and the geometry service will deploy to Fly.io. Every push to `main` goes live and every pull request gets a preview link. Step by step: [`docs/deploy-vercel.md`](docs/deploy-vercel.md). Where each key goes: [`docs/accounts-and-keys.md`](docs/accounts-and-keys.md).

## Local development (optional)

You do not need this to review the app: use the Vercel link. Run it locally only if you want to work offline. Needs Docker, Node 22, pnpm 10 and uv.

```
pnpm install
cp apps/web/.env.example apps/web/.env.local   # keys go here; see docs/accounts-and-keys.md
pnpm dev:setup                  # starts Postgres and Redis, seeds, checks
```

`pnpm dev:down` stops the services. `pnpm dev:reset` stops them and deletes all local data. Development file storage uses the `parts-builder-dev` bucket on Cloudflare R2. Next.js only reads `.env` files from `apps/web/`, so every key the web app needs goes in `apps/web/.env.local`. The root `.env.example` is the full list of variable names for reference.

## Where things are

- [`docs/plan.md`](docs/plan.md): the master plan. It covers the business model, architecture, data model, and every task by phase.
- [`docs/decisions.md`](docs/decisions.md): log of design decisions.
- [`docs/deploy-vercel.md`](docs/deploy-vercel.md) and [`docs/accounts-and-keys.md`](docs/accounts-and-keys.md): hosting and keys.
- [`CLAUDE.md`](CLAUDE.md): rules for the AI Builder that writes the code.

## Starting a Builder session

Open a Claude Code session on this repo and paste:

```
Task: B<phase>.<n> from docs/plan.md.
Context: <anything new since the plan was written>.
First, reply with your approach in 3-5 lines and any question for me.
Then implement it on branch task/B<phase>.<n>-<short-name>, meet the "Done when"
criteria with tests, update docs, and open a pull request.
In the PR description list: what changed, how it was tested, what you skipped,
and any decision you need from me.
```

The first task is `B0.1`. It needs the accounts from Owner task `O0.3`.
