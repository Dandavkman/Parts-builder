# Web app

Next.js 16 (App Router), Tailwind 4, Clerk 7 for sign-in, three.js (react-three-fiber) for the viewer.

## Run

```
cp apps/web/.env.example apps/web/.env.local   # add the Clerk development keys
(cd services/geometry && uv run uvicorn geometry.api:app --port 8000)   # in one terminal
pnpm --filter @parts-builder/web dev                                    # in another
```

Open http://localhost:3000. Dashboard and Viewer need a signed-in user. The Viewer loads the demo plate from the geometry service through `/api/demo-plate`.

## How sign-in is decided (`src/lib/auth-mode.ts`)

| Mode | When | Behavior |
| --- | --- | --- |
| `clerk` | Both Clerk keys are set | `/dashboard`, `/viewer` and `/api/demo-plate` require sign-in |
| `dev-bypass` | No keys, `NODE_ENV=development`, `ALLOW_UNAUTHENTICATED_DEV=true` | No sign-in, so pages can be built before Clerk exists |
| `unconfigured` | Anything else, including every production build without keys | Every page redirects to `/setup` (fails closed) |

## Notes for the next Builder

- **Next 16 renamed `middleware.ts` to `proxy.ts`.** Auth lives in `src/proxy.ts`.
- **Clerk 7 removed `<SignedIn>` and `<SignedOut>`.** Use `<Show when="signed-in">` and `<Show when="signed-out">`.
- The root layout is `force-dynamic`, so the auth mode is read per request, not frozen at build time.
- CAD models are Z-up and three.js is Y-up. The viewer rotates the model -90 degrees about X.
- Files often arrive fully metallic (the glTF default) and render black without an environment map, so the viewer applies its own matte material.
- Open the dev server at `localhost` or `127.0.0.1` (both are allowed in `next.config.ts`).
- Protected API routes must check the user themselves as well (see `src/app/api/demo-plate/route.ts`), not rely on the proxy alone.
