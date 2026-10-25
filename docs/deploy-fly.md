# Deploy the geometry service to Fly.io

The geometry service is the Python app that builds 3D parts. It is too big for Vercel, so it runs on Fly.io. The web app on Vercel only needs its address (`GEOMETRY_SERVICE_URL`) and a generated secret (`GEOMETRY_SERVICE_TOKEN`).

Commands below are for PowerShell on Windows. They work the same in a Mac or Linux terminal, except for the folder path.

## What it costs and uses

- **Machine:** `shared-cpu-2x` with **2 GB of memory** (set in `services/geometry/fly.toml`). The demo build used about 0.55 GB in a test run on a laptop-sized machine. 2 GB leaves room for the fit check and normal-size parts. Scan processing (B1.2) will need a bigger machine, and that is a later decision.
- **It stops when idle.** `auto_stop_machines = "stop"` and `min_machines_running = 0` mean the machine shuts down when nobody is using it and starts on the next request. The first request after a stop takes about 10 to 20 seconds.
- **Expected monthly cost (estimate, check Fly's pricing page at fly.io/docs/about/pricing):** about $11 to $12 a month if it ran all day and night, but with auto-stop the bill is for running seconds only, so for demos and testing think **under $1 a month**, plus a few cents for the stored image. One request that takes 5 seconds costs a fraction of a cent.
- **Free trial limits:** the trial gives 2 hours of total machine time and machines up to 4 GB, which this fits. It expires about 2026-11-01, so add a card and a low spending alert before then (see `docs/accounts-and-keys.md`).
- Nothing here needs a dedicated IPv4 address. Do **not** run `fly ips allocate-v4` without `--shared`: a dedicated address costs money every month.

## Steps

1. Get the latest code and open the service folder:

   ```powershell
   cd C:\path\to\parts-builder
   git pull
   cd services\geometry
   ```

2. Check who you are and which organization you will use. The name shown (for example `personal`) is your organization's slug:

   ```powershell
   fly auth whoami
   fly orgs list
   ```

3. Create the app. If the name is taken, pick another and change `app = "..."` in `fly.toml` to match. If Fly asks which organization, choose the one from step 2, or add `--org <slug>`:

   ```powershell
   fly apps create parts-builder-geometry
   ```

   Do not use `fly launch`: it rewrites `fly.toml` and asks questions we have already answered.

4. Deploy. The first build takes several minutes because it downloads the 3D engine. Fly builds the image on its own servers, so you do not need Docker:

   ```powershell
   fly deploy
   ```

5. Set the shared secret, so only our web app can build parts. In PowerShell, generate a random value, store it on Fly, and keep it in the clipboard for Vercel (never paste it in chat or commit it):

   ```powershell
   $b = New-Object byte[] 32
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
   $token = ([BitConverter]::ToString($b) -replace "-","").ToLower()
   fly secrets set GEOMETRY_SERVICE_TOKEN=$token
   $token | Set-Clipboard
   ```

   In Vercel add `GEOMETRY_SERVICE_TOKEN` with the clipboard value for Production and Preview (server-side only). The service refuses `/build` with 503 until the secret exists and 401 on a wrong one; `/health` stays open for Fly's check.

6. Check it. This should print `status` `ok`:

   ```powershell
   Invoke-RestMethod https://parts-builder-geometry.fly.dev/health
   ```

   If the address does not load but `fly status` shows the machine as started, run `fly ips list`. If there are no addresses, run `fly ips allocate-v4 --shared` (free) and `fly ips allocate-v6`.

7. Copy the address (`https://parts-builder-geometry.fly.dev`, no slash at the end). In Vercel open the project, **Settings**, **Environment Variables**, and add `GEOMETRY_SERVICE_URL` with that address for Production and Preview. Then **Deployments**, the three dots on the latest one, **Redeploy** (do this after adding the token too).

8. Open the live site, then **Viewer**. The plate should now draw.

## Day to day

| Task | Command |
| --- | --- |
| See if it is running | `fly status` |
| Read the logs | `fly logs` |
| Deploy a new version | `fly deploy` (from `services\geometry`) |
| Stop it completely | `fly scale count 0` |
| Delete it | `fly apps destroy parts-builder-geometry` |

## If something goes wrong

| What you see | What it means |
| --- | --- |
| "Could not find App" on deploy | The `app` name in `fly.toml` does not match the one you created. |
| Deploy needs a payment method | The trial or the free allowance ran out. Add a card and a spending alert in Fly's billing page. |
| `/health` is slow the first time | The machine was stopped and is starting. Try again after 20 seconds. |
| Build fails | Copy the last 30 lines of red text to Claude. Do not copy anything that looks like a key. |
| Viewer still says "Could not load the plate" | `GEOMETRY_SERVICE_URL` was added but Vercel was not redeployed, or it has a slash at the end. |

## Notes for builders

- The image is `python:3.12-slim` plus `libgl1` and `libstdc++6`, which the 3D engine needs. Dependencies install from `uv.lock` before the code is copied, so code-only changes rebuild fast.
- The service listens on port 8080 (`internal_port` in `fly.toml`) and Fly checks `GET /health` every 30 seconds while it runs.
- Secrets, when needed, are set with `fly secrets set NAME=value` and are never committed (rule 4).
