# Custom Car Parts Platform — Master Plan

Oct 22, 2026 · Owner: @Dandavkman

> This file is the repo copy of the living plan at https://claude.ai/artifact/NXJt6oedxhYFxrPxx2j5ZN. When the plan changes, update both.

## How to use this plan

This plan runs two tracks at once: the Owner does the real-world work and the Builder writes the software, and each phase ends at a gate both must pass before the next phase starts.

| Role | Who | Owns |
| --- | --- | --- |
| Owner | You | Company, money, legal, scans, print partners, test car, customers, every decision marked **Owner decides** |
| Builder | A lower-cost Claude model in Claude Code sessions | All code, tests, infrastructure-as-code and technical docs in the repo |
| Architect | A stronger model, used only at gates | Reviews the Builder's work at each gate, updates this plan, resolves design questions the Builder escalates |

**Task IDs.** Builder tasks are `B<phase>.<n>` (B1.6 = Phase 1, task 6). Owner tasks are `O<phase>.<n>`. Gates are `G<phase>`. Dependencies are written as "needs O0.5".

**How work flows.**

1. The Owner opens a Claude Code session on the repo and gives the Builder one task ID using the prompt template in *Builder handoff protocol*.
2. The Builder works on a branch, opens a pull request, and reports what it finished, what it skipped and anything that needs an Owner decision.
3. The Owner merges, or sends it back with comments.
4. Physical results (printed parts, fit tests, partner quotes) come back from the Owner as GitHub issues, which become Builder tasks.
5. At each gate the Owner runs the Architect review before starting the next phase.

**Durations are estimates** for one Owner working part-time and one Builder session most days. Adjust them once Phase 0 shows the real pace.

| Phase | Owner (real world) | Builder (software) | Gate to pass |
| --- | --- | --- | --- |
| 0 · Foundations (about 2 weeks) | Name, company, accounts; first scans, partner quotes | Repo, CI, local dev; plate demo in 3D viewer | G0: repo runs; real scan and 5 benchmark parts in hand |
| 1 · Prototype (about 8 weeks) | Print and test-fit benchmarks; lawyer, alpha testers | Upload, anchors, Part Spec; design agent, fit check | G1: 4 of 5 benchmark parts fit the real car |
| 2 · Launch (about 10 weeks) | Partner, legal, insurance; pricing, beta, public launch | Plans, safety guard, quotes; checkout, admin console | G2: 25 paid orders; fit failures under target |
| 3 · Scan library (about 3 months) | Scan 10 car platforms; add a CNC partner | Library, licenses, anchors; ducts, surface shells, CNC | G3: 10 platforms; 30% of designs start from the library |
| 4 · Storefronts (about 4 months) | Seller terms, DMCA agent; recruit 10 launch sellers | Stores, listings, payouts; review queue, takedowns | G4: 20 stores live and selling |
| 5 · Own production (when it pays) | Space, operator, machines; partners kept for overflow | Routing, build planning; quality records, labels | G5: in-house cost per part below partner cost |

The Owner and Builder work side by side in every phase; neither starts the next phase until the gate between them is passed.

## Business model in brief

Car owners design parts that fit their exact car by chatting with an AI over a 3D scan, then pay us to have them made. Printed parts are the core revenue, and every other feature exists to produce more orders.

**Customers.**

- **DIY enthusiasts** who want a part nobody sells for their car: mounts, gauge pods, ducts, trim.
- **Tuning and restoration shops** that need one-off or discontinued parts without a CAD designer on staff.
- **Designers and small brands** (Phase 4) who sell their designs through a branded store and let us print every order.

**Revenue streams.**

| Stream | Starts | How it's charged | What the Builder must support |
| --- | --- | --- | --- |
| Print margin | Phase 2 | Markup on the partner's price for every order | Quote engine with editable rate cards and markup |
| Pro plan | Phase 2 | Monthly subscription | Plan limits (AI turns, saved designs, STEP export) |
| Scan library | Phase 3 | Per scan or included in Pro | Licenses that let a user design against a scan without downloading it |
| Store commission | Phase 4 | Platform fee on each store sale, plus the print margin | Stripe Connect payouts and a price floor per listing |

**Rules every Builder task must respect.**

1. **The user owns their design.** Never lock users out of their own design files; Pro gates the STEP export, not ownership.
2. **Library scans are never downloadable.** Users design against them in the browser only. This protects the scan library's value.
3. **Safety categories are enforced in code**, not just in the terms of service (see *Product scope and ground rules*).
4. **Every order must be traceable** to an exact frozen design version, material, check results and the user who accepted the safety terms.
5. **Margins must stay visible.** Every quote stores its partner cost, our markup and fees, so the Owner can see profit per order.

## Product scope and ground rules

We launch with non-structural parts on one vehicle platform, and the software refuses safety-critical parts outright.

**Part categories.**

| Category | Examples | Status |
| --- | --- | --- |
| Mounts and brackets | Oil cooler bracket, phone mount, sensor mount, catch can bracket | Allowed from Phase 1 |
| Interior | Gauge pods, switch panels, trim pieces, cup holders, shifter surrounds | Allowed from Phase 1 |
| Covers and trim | Engine covers, blanking plates, badges, grommets | Allowed from Phase 1 |
| Air ducts | Intake ducts, brake cooling ducts, cabin vents | Allowed from Phase 3, once sweeps exist |
| Underhood near heat | Anything within reach of exhaust or turbo | Needs review: material must be rated for the temperature |
| Emissions-related | Intake or exhaust parts that change engine airflow | Needs review: may be illegal on road cars in some states (California CARB rules) |
| Safety-critical | Brakes, suspension, steering, wheels and hubs, seat and seatbelt mounts, airbag areas, fuel system, tow points | **Blocked** |

**Materials and processes.** The Owner fills in the real numbers from partner rate cards in O0.6. The Builder stores them in a table the admin console can edit, never hard-coded.

| Process | Materials | Good for | Notes |
| --- | --- | --- | --- |
| SLS or MJF nylon | PA12, PA11 | Most brackets, pods, trim | Default choice: cheap, strong, no support marks |
| SLS carbon-filled nylon | PA12-CF | Stiff brackets, engine bay | Higher heat tolerance than plain nylon |
| CNC machining | 6061 aluminum | Flat or simple brackets that carry load | Limits shapes; added in Phase 3 |
| Metal printing (DMLS) | 316L stainless, AlSi10Mg aluminum | Complex metal parts | Expensive; offered for specific parts, not as a default |
| Resin (SLA) | Tough or heat-resistant resins | Interior show pieces | Optional |

**What the software must refuse or flag.**

- A classifier reads every design request and labels its category. Blocked categories stop the design session with a plain explanation.
- "Needs review" designs can be designed but not ordered until an admin approves them.
- At checkout the user confirms the part is not safety-critical and accepts the fit-and-use terms. The confirmation is stored with the order.

**Out of scope until the Owner says otherwise:** mobile apps, phone-based scanning, a general-purpose CAD editor, and non-automotive parts.

## System architecture and tech stack

The system has three parts: a web app that owns users, data and money; a stateless Python geometry service that does all 3D work; and a design agent that turns chat into a structured part description the geometry service can build.

```
                Claude API  <--  Web app server  <-->  Browser
           (writes Part Specs)   (Next.js, Vercel)     (chat, 3D viewer, stores, admin)
                                       |   <-->  Stripe (payments, plans, payouts)
        +---------------+--------------+--------------+----------------+
        v               v              v              v
     Postgres       Job queue      File storage    Print partners
  (only written      (Redis)          (R2)         (manual first,
   by web app)          |               ^            API later)
                        v               |
                 Geometry workers (Python, Fly.io) <--+
                 scan cleanup, anchor fitting,
                 Part Spec -> STEP/STL/GLB, fit and printability checks
```

The browser only talks to the web app server. Heavy 3D work goes through the job queue to the geometry workers, which read and write files in R2.

**The key design decision: the AI writes a Part Spec, not code or meshes.** The design agent outputs a JSON document (the *Part Spec*) built from a fixed list of features: plates, holes, hole patterns, standoffs, slots, ribs, bends, fillets, and surface-following shells. Each feature is positioned against *anchors*, which are reference points, planes and holes the user picked on the scan. Our own tested Python code turns the spec into exact CAD geometry.

Why this way:

- **Safe.** No AI-written code ever runs on our servers.
- **Accurate.** Geometry comes from a real CAD kernel, so a 6.5 mm hole is exactly 6.5 mm.
- **Editable.** Every number in the spec becomes a slider, so users can fine-tune without asking the AI again.
- **Checkable.** Fit and printability checks read the spec and the geometry directly.
- **Buildable by a cheaper model.** Each feature is a small, separately tested function.

The trade-off is that users can only make shapes the feature list supports. That is acceptable for the launch categories, and the list grows each phase.

**Stack.** Each choice is a default the Builder uses unless the Owner or Architect changes it.

| Layer | Choice | Why |
| --- | --- | --- |
| Repo | Monorepo: pnpm workspaces for TypeScript, uv for Python | One place for everything; one CI |
| Web app and API | Next.js (App Router), TypeScript, Tailwind, shadcn/ui | Widely known; strong AI-coding support |
| 3D viewer | three.js with React Three Fiber, drei, three-mesh-bvh | Fast picking on million-triangle scans |
| Database | Postgres with Drizzle ORM and migrations | The web app is the only service that touches the database |
| Auth | Clerk | Login, organizations and user management with little code |
| File storage | Cloudflare R2 (S3-compatible), presigned multipart uploads | Large scan files; no fees for downloading them |
| Job queue | Redis with BullMQ on the web side; Python workers pull jobs | Scan processing and CAD builds take seconds to minutes |
| Geometry service | Python 3.12, FastAPI, CadQuery (OpenCascade kernel), trimesh, Open3D, manifold3d | Exact CAD (STEP) plus fast mesh work on scans |
| Design agent | Claude API with tool use, called from the web app's server | Plans and edits the Part Spec through tools |
| Payments | Stripe Checkout, Billing, Tax; Stripe Connect Express in Phase 4 | Orders, subscriptions and designer payouts |
| Hosting | Vercel for the web app; Fly.io machines for geometry workers | Workers need 4–8 GB of memory and can scale to zero |
| Email, errors, analytics | Resend, Sentry, PostHog | Standard and inexpensive to start |

**Design agent tools.** The agent works through these tools and never sees raw files:

- `list_anchors`: the reference points, planes and holes the user picked, with positions in millimeters.
- `measure`: the distance between two anchors, or the clearance from an anchor to the nearest scan surface.
- `propose_spec`: submit a full Part Spec. Returns the build result, check results and any errors.
- `ask_user`: ask a clarifying question, such as what material or how thick.

The agent stops after 6 build attempts per user message and shows its best result with the remaining issues listed.

## Repository layout and data model

One repository holds every service. Every table and file below is the Builder's starting point; a schema change needs a migration and a line in `docs/decisions.md`.

**Repository layout.**

```
/apps/web               Next.js app: pages, API routes, design agent, admin console
/services/geometry      Python FastAPI service and queue workers
    /spec               Part Spec schema (JSON Schema, versioned) and feature builders
    /scan               Scan import, repair, decimation, anchor fitting
    /checks             Fit, printability and clearance checks
    /tests              Unit tests plus golden-file tests per feature
/packages/part-spec     TypeScript types generated from the same JSON Schema
/packages/ui            Shared React components
/fixtures               Test scans and benchmark parts (large files in R2, small ones in git)
/benchmarks             The benchmark prompts and the script that scores them
/docs                   This plan as Markdown, decisions log, runbooks
/infra                  docker-compose for local dev, Fly.io and Vercel config
CLAUDE.md               Rules for the Builder (copied from the handoff protocol)
```

**Units and coordinates.** Everything is stored in millimeters, in the scan's coordinate frame after calibration. A Part Spec never contains absolute positions without an anchor reference.

**Core tables.**

| Table | Key fields | Phase |
| --- | --- | --- |
| users | Clerk id, email, plan, safety terms accepted at | 1 |
| vehicles | make, model, generation, year range | 1 |
| scans | owner, vehicle, area ("engine bay, driver side"), source (upload or library), status, original file, preview file, scale factor, triangle count, accuracy note | 1 |
| anchors | scan, name, type (point, plane, hole, axis, region), parameters, fit error in mm | 1 |
| designs | owner, scan, title, category, safety status (allowed, needs review, blocked), current version | 1 |
| design\_versions | design, version number, Part Spec JSON, spec schema version, STEP/STL/GLB files, check results, created by (user, agent or slider) | 1 |
| chat\_messages | design, role, content, tool calls, tokens used | 1 |
| materials | process, name, minimum wall, minimum hole, maximum build size, price parameters, allowed categories, active | 2 |
| print\_partners | name, adapter type (manual or API), contact, materials offered, lead times | 2 |
| quotes | design version, material, quantity, partner cost, markup, fees, shipping, total, expiry | 2 |
| orders | user, quote, Stripe ids, status, shipping address, partner order reference, tracking, safety confirmation | 2 |
| safety\_reviews | design version, classifier result, reviewer, decision, notes | 2 |
| subscriptions | user, Stripe subscription, plan, usage counters | 2 |
| scan\_licenses | user, library scan, purchased at, expiry | 3 |
| stores | owner, slug, custom domain, branding, Stripe Connect account | 4 |
| listings | store, frozen design version, retail price, price floor, compatible vehicles, review status | 4 |
| payouts | store, order, platform fee, designer amount, Stripe transfer | 4 |
| takedown\_requests | listing, claimant, reason, status | 4 |

**Order statuses.** `quote` → `paid` → `in_review` (only if needs review) → `sent_to_partner` → `in_production` → `shipped` → `delivered`, plus `cancelled`, `refunded` and `reprint`.

## Phase 0: Foundations (about 2 weeks)

Phase 0 sets up the accounts, the repo and the first real scan, and the Owner picks the launch car and part type. Nothing user-facing ships yet.

**Builder tasks.**

| ID | Task | Done when | Needs |
| --- | --- | --- | --- |
| B0.1 | Scaffold the monorepo using the layout above. Add GitHub Actions for lint, type checks and tests on every pull request. Add `CLAUDE.md` from the handoff protocol. | A fresh clone passes CI | O0.3 |
| B0.2 | Local dev setup: `docker compose up` starts Postgres and Redis; development files go to a dev bucket on Cloudflare R2 (MinIO is no longer distributed). One command seeds the database. | A new machine runs the app locally in under 10 minutes by following the README | B0.1 |
| B0.3 | Geometry service skeleton: FastAPI `/health` and a `/build` endpoint that builds a hard-coded 50 × 30 × 4 mm plate with two 6.5 mm holes and returns STEP, STL and GLB. | Test checks the hole diameter in the STEP file within 0.01 mm | B0.1 |
| B0.4 | Web skeleton: Next.js with Clerk sign-in, an empty dashboard, and a 3D viewer page that loads the plate from B0.3. | Signed-in user sees and orbits the plate | B0.3, O0.3 |
| B0.5 | Test fixtures: a synthetic "scan" made in code (a box with known holes and known noise added) so anchor fitting has an exact right answer. Store the Owner's real scans in R2 with a fixtures manifest. | Fixture loader test passes | O0.5 for real scans |
| B0.6 | Write the Part Spec v0.1 JSON Schema draft with three features (plate, hole, hole pattern) and generate TypeScript types from it. | Schema, types and one valid example spec are committed | B0.1 |

**Owner tasks.**

- [ ] **O0.1** Pick a working name. Search the USPTO trademark database, check domain availability, and buy the domain.
- [ ] **O0.2** Form the company (an LLC is common) with an accountant or attorney. Open a business bank account.
- [ ] **O0.3** Create accounts and save each key in a password manager: GitHub (private repo), Anthropic Console (API key with a monthly spend limit), Vercel, Fly.io, Cloudflare (R2), Clerk, Stripe (test mode), Sentry, PostHog, Resend. Add the keys to the Claude Code environment's secrets so the Builder can use them.
- [ ] **O0.4** **Owner decides** the launch platform and first part type. Choose a car that has a large enthusiast community, many model years sharing the same layout, and one you can access every week.
- [ ] **O0.5** Get scanning: buy, rent or hire a structured-light scanner (accuracy 0.05–0.1 mm). Scan 2–3 areas of the launch car where your benchmark parts will mount. Measure 3 known distances per area with calipers and write them down with photos.
- [ ] **O0.6** Contact 3–5 print services, such as Xometry, Protolabs Network, Craftcloud, JLC3DP or a local SLS shop. For each, get the rate card or sample quotes, material specs (minimum wall, tolerance, build size), lead times, whether they have an ordering API, and whether they allow reselling.
- [ ] **O0.7** Talk to 10–15 owners of the launch car (forums, Discord, Reddit, local car meets). Collect at least 30 part ideas and pick **5 benchmark parts** that span the launch categories. Write each as one sentence a user would type, plus the critical measurements.

**Gate G0.** The web app is deployed on Vercel and the Owner can sign in to it. The plate from B0.3 renders in the viewer, checked with the real services (the live site shows it once B0.7 hosts the geometry service). The Owner has delivered at least one real scan with caliper measurements, the 5 benchmark parts, and partner data from at least 2 print services.

**Plan change (2026-10-24): Vercel first.** The web app deploys to Vercel from the start instead of being run locally first. See `docs/deploy-vercel.md` and `docs/decisions.md`. Local running is optional, so B0.2 is no longer on the critical path. New Phase 0 tasks:

- **B0.7** (Builder) Deploy the geometry service to Fly.io: a Dockerfile, `fly.toml` and a health check. Done when the viewer on the live site shows the plate. Needs B0.3 and O0.10. **Deferred to Phase 1** (it is needed before scan processing, B1.2), so no card is needed before there is revenue.
- **O0.8** (Owner) Deploy the web app to Vercel and test the sign-in on the live site. Needs O0.3. Done when you can sign up and reach the dashboard.
- **O0.10** (Owner) Create the Fly.io account and add a card. Needed before B0.7. **Deferred to Phase 1** with B0.7. Fly.io needs a card or prepaid credits; see `docs/decisions.md`. (O0.9 was the one-off "merge PR #7", tracked only in the progress tracker.)

## Phase 1: Prototype (about 8 weeks)

Phase 1 proves the core loop: upload a scan, pick anchors, describe a part in chat, and download a file that physically fits the car. Its gate is a printed part on the real car, not a demo.

**Builder tasks, in order.**

| ID | Task | Done when | Needs |
| --- | --- | --- | --- |
| B1.1 | **Scan upload.** Presigned multipart upload to R2 for STL, OBJ and PLY (and zipped versions), up to 1 GB. Validate the format and triangle count before accepting. | A 500 MB PLY uploads and resumes after a dropped connection | B0.4 |
| B1.2 | **Scan processing job.** Load the scan, remove small floating fragments, fill small holes, record its size and triangle count, and make a decimated preview (about 500,000 triangles, Draco-compressed GLB). Keep the full-resolution file for checks. | Owner's real scan processes in under 3 minutes; preview loads in under 5 seconds | B1.1, O0.5 |
| B1.3 | **Units and scale.** Guess units from the scan's size, ask the user to confirm, then let them calibrate: pick two points and type the real distance. | Calibrated scan matches the Owner's caliper measurements within 0.3 mm | B1.2 |
| B1.4 | **Viewer tools.** Orbit, a section-cut plane, point-to-point measuring, and a brush that selects a patch of the scan surface. | Owner can measure their 3 caliper distances in the viewer | B1.2 |
| B1.5 | **Anchor fitting.** From a selection, fit a plane, a hole (circle on the rim: center, axis, diameter), a point or an axis. Show the fit error. Users name and edit anchors. | On the synthetic fixture, fitted holes are within 0.05 mm of truth; on real scans, within 0.3 mm of caliper values | B1.4, B0.5 |
| B1.6 | **Part Spec v1.** Extend the schema to: plate (rectangle or outline), hole, hole pattern, counterbore, countersink, slot, standoff, rib or gusset, L-bend between two plates, edge fillet and chamfer, cutout around a clearance zone, embossed text. Every position references an anchor. | Schema documented in `docs/part-spec.md` with one example per feature | B0.6 |
| B1.7 | **Spec builder.** Python code that turns a Part Spec into CadQuery geometry, then STEP, STL and GLB. One function and one golden-file test per feature. Clear error messages, such as "hole 2 is outside plate 1". | All feature tests pass; the same spec always produces the same file | B1.6 |
| B1.8 | **Design agent.** Claude tool-use loop with the 4 tools from the architecture section. The system prompt holds the spec docs, the anchors, the safety rules and material limits. Stream replies to the browser. Save every spec version and every message with token counts. | 3 of the 5 benchmark prompts produce a valid spec without human help | B1.5, B1.7 |
| B1.9 | **Design workspace.** Three panels: chat, viewer (scan plus part, with a see-through toggle), and auto-generated sliders for every number in the spec. Version history with undo. A slider change makes a new version without calling the AI. | Owner designs a benchmark part start to finish without leaving the page | B1.8 |
| B1.10 | **Fit check v1.** Find where the part overlaps the scan (and by how much), the smallest gap between them, and how far each part hole sits from its anchor. Show the overlap as a red heat map on the part. | A part shifted 1 mm into the scan is flagged with the right overlap depth | B1.7 |
| B1.11 | **Downloads.** STL and STEP download for any version. | Downloaded STEP opens in a free CAD viewer with correct dimensions | B1.7 |
| B1.12 | **Benchmark runner.** A script runs the 5 benchmark prompts through the agent and scores each one: valid spec, fit check passes, hole positions within 0.5 mm, number of attempts and tokens used. Run on demand, not on every commit, because it costs API tokens. | Report table is written to `benchmarks/results/` | B1.8, B1.10, O0.7 |

**Owner tasks.**

- [ ] **O1.1** After B1.9, design each benchmark part yourself in the workspace. Print each one cheaply (a home FDM printer or a local service) and test-fit it on the car. File a GitHub issue per part with photos and the measured error.
- [ ] **O1.2** Scan 2 more areas of the launch car. Write a one-page scanning guide for users (scanner, settings, how to measure reference distances).
- [ ] **O1.3** First lawyer meeting: terms of service, who owns a design, liability limits, the blocked and needs-review lists, and the fit-failure policy. Ask an insurance broker for product liability quotes.
- [ ] **O1.4** Recruit 10–20 alpha testers who own the launch car. Collect their emails and, if they have them, their scans.
- [ ] **O1.5** Turn the partner data from O0.6 into the material table: process, material, minimum wall, minimum hole, maximum size, price per unit volume, setup fee, lead time.

**Gate G1.** At least 4 of the 5 benchmark parts were designed through chat in under 15 minutes each, printed, and fit the car with no more than light sanding. The benchmark report shows it. The Owner signs off, then runs the Architect review before Phase 2.

## Phase 2: Launch (about 10 weeks)

Phase 2 turns the prototype into a business that takes money: accounts and plans, safety enforcement, quotes, checkout, and a back office where the Owner fulfills orders by hand through a print partner.

**Builder tasks.**

| ID | Task | Done when | Needs |
| --- | --- | --- | --- |
| B2.1 | **Plans and limits.** Free and Pro plans through Stripe Billing. Enforce limits on AI messages per month, saved designs and STEP export. Show usage in the account page. | A free user hitting the limit sees an upgrade prompt; Pro removes it | O2.3 |
| B2.2 | **Dashboard.** Lists of my scans, my designs and my orders, with search and status. | All three lists load in under 1 second with 100 items | B1.9 |
| B2.3 | **Printability checks.** Per material, from the material table: minimum wall thickness (with thin spots highlighted), minimum hole size, fits the build size, closed solid with no gaps. Show pass or fail per material. | Each rule has a test part that fails it and one that passes | O1.5 |
| B2.4 | **Safety guard.** A fast Claude model labels each design request and finished spec with a category. Blocked stops the session. Needs review allows designing but holds ordering until an admin approves. Log every decision. | All examples in the category table are labeled correctly; an admin can approve or reject from the queue | B2.7 |
| B2.5 | **Quote engine.** Price = partner cost estimate (from volume, size and the material's rate card) + setup fee + our markup + payment fees + shipping. Store every component. Quotes expire after 14 days. | Quotes for the 5 benchmark parts are within 15% of real partner quotes the Owner collects | O1.5, O2.3 |
| B2.6 | **Checkout.** Stripe Checkout with Stripe Tax and a shipping address. The user confirms the part is not safety-critical and accepts the fit terms before paying. A Stripe webhook creates the order. | A test-mode purchase creates an order with the confirmation stored | B2.5, O2.2 |
| B2.7 | **Admin console.** Order queue by status, production file download (STEP, 3MF and a one-page job sheet with material, quantity and critical dimensions), status changes, tracking numbers, refunds, the safety review queue, material and rate-card editing, and user lookup. Admin-only access. | Owner processes a test order from paid to shipped without touching the database | B2.6 |
| B2.8 | **Print partner adapters.** A `PrintPartner` interface with a manual adapter first (Owner places the order on the partner's website and pastes the reference). Add an API adapter only for the partner chosen in O2.1, if it has an API. | Manual adapter works end to end; API adapter passes against the partner's sandbox if there is one | O2.1 |
| B2.9 | **Emails.** Order confirmed, sent to production, shipped with tracking, delivered, and review approved or rejected. | Each email is sent once per event in a test run | B2.6 |
| B2.10 | **Public site.** Landing page, how it works, pricing, FAQ, a gallery of real parts on cars, legal pages and a waitlist. | Pages pass a Lighthouse score of 90+ on mobile | O2.6 for photos, O2.2 for legal text |
| B2.11 | **Running it safely.** Error tracking, rate limits on AI and uploads, daily database backups, and a dashboard of AI cost per design and per user. | Owner can see yesterday's AI spend and the most expensive designs | B1.8 |
| B2.12 | **Security pass.** Check that users can only see their own scans, designs and orders. Validate every uploaded file. Keep secrets out of the browser. Add tests for each. | Access-control tests cover every API route | All above |

**Owner tasks.**

- [ ] **O2.1** **Owner decides** the launch print partner (one primary, one backup). Open business accounts and confirm in writing that reselling is allowed.
- [ ] **O2.2** Final legal documents with the lawyer: terms of service, privacy policy, design ownership terms, the blocked and needs-review lists, use disclaimer, and the fit-failure policy. Bind product liability insurance **before the first paid order**.
- [ ] **O2.3** **Owner decides** pricing: markup per material, the Pro plan price and limits, shipping charges, and what happens when a part doesn't fit (reprint, refund or store credit).
- [ ] **O2.4** Activate Stripe live mode. Ask the accountant which states you must collect sales tax in and set up Stripe Tax to match.
- [ ] **O2.5** Run a closed beta with the alpha testers. Place the first 10 orders yourself through the admin console. Inspect each part when it arrives from the partner before forwarding it, until quality is proven.
- [ ] **O2.6** Photograph and film real parts installed on cars for the site and social posts.
- [ ] **O2.7** Launch publicly on the launch car's forums, Discord servers, Reddit and Instagram. Answer every comment personally for the first month.

**Gate G2.** 25 paid orders shipped. The fit-failure rate is under the target the Owner sets (10% is a reasonable start). Every order's stored margin is positive after partner cost, fees and shipping. The Architect reviews before Phase 3.

## Phase 3: Scan library and more part types (about 3 months)

Phase 3 removes the biggest barrier to signing up, which is owning a scanner, by selling access to ready-made scans of popular cars. It also adds the features that ducts and machined brackets need.

**Builder tasks.**

| ID | Task | Done when | Needs |
| --- | --- | --- | --- |
| B3.1 | **Vehicle catalog.** Make, model, generation and year range, with which library scans cover which areas of each car. | Search finds a car by any of those fields | — |
| B3.2 | **Library pages.** A page per car showing the available scan areas, a low-detail preview, and the price or "included in Pro". | Pages are public and indexable by search engines | B3.1 |
| B3.3 | **Scan licenses.** Buying or unlocking a library scan creates a license. Licensed scans open in the workspace but are **never downloadable**. The full-resolution file never reaches the browser; checks run on the server. | A licensed user cannot get the scan file through any API route (tested) | B3.2 |
| B3.4 | **Pre-placed anchors.** Admins add standard anchors to library scans (factory bolt holes, mounting faces) so users start with them. | A new user designs a benchmark part on a library scan without placing any anchors | B3.3 |
| B3.5 | **Community scan submissions.** Users submit their scans to the library. An admin approves them, and the submitter earns a revenue share set by the Owner. | Submission, review and payout record work end to end | O3.4 |
| B3.6 | **Compatibility tags.** A design made on one library scan is tagged with every vehicle that scan covers. | Tags show on the design and are searchable | B3.1 |
| B3.7 | **Part Spec v2.** Add sweeps and lofts (a duct between two shapes), a shell that follows a selected scan surface at a set distance and thickness, and sheet-metal-style bends. | Each new feature has golden-file tests; a benchmark duct prompt passes | B1.7 |
| B3.8 | **CNC aluminum.** Checks for machinable shapes (no undercuts, minimum inside corner radius) and a quote path for a CNC partner. | A flat bracket quotes for CNC; a shape with an undercut is rejected with a reason | O3.3 |
| B3.9 | **Agent quality loop.** Add the 10 most common failed requests from Phase 2 logs to the benchmark set. Improve the prompt and tools until the success rate goes up. | Benchmark success rate is higher than at G2, with numbers in the report | B1.12 |

**Owner tasks.**

- [ ] **O3.1** **Owner decides** the next 10 car platforms, using Phase 2 waitlist and forum demand.
- [ ] **O3.2** Run a scanning program: borrow cars from club members or shops, pay per car, and get a signed release from each car owner. Write a scan quality standard (coverage, accuracy, reference measurements) and check every scan against it.
- [ ] **O3.3** Add a CNC partner for aluminum brackets and add their data to the material table.
- [ ] **O3.4** **Owner decides** library pricing and the revenue share for community-submitted scans. Have the lawyer add scan-submission terms.
- [ ] **O3.5** Approach 3–5 shops on the new platforms about using the platform for customer work.

**Gate G3.** 10 car platforms are in the library. At least 30% of new designs start from a library scan. The benchmark success rate has improved since G2.

## Phase 4: Storefronts and marketplace (about 4 months)

Phase 4 lets designers and shops sell their designs under their own brand while we print and ship every order. That multiplies orders without us designing anything.

**Builder tasks.**

| ID | Task | Done when | Needs |
| --- | --- | --- | --- |
| B4.1 | **Seller onboarding.** Stripe Connect Express onboarding for designers. Their store stays unpublished until Stripe verifies them. | A test seller completes onboarding and receives a test payout | O4.1 |
| B4.2 | **Store builder.** Store on `<name>.<ourdomain>` or the seller's own domain (through the Vercel domains API). Logo, colors, about page, and contact details. | A custom domain connects and gets HTTPS automatically | B4.1 |
| B4.3 | **Listings.** A listing points to a frozen design version that has passed all checks. Sellers set the retail price per material; it can't go below the floor (our cost + platform fee). Compatible vehicles come from the design's tags. | Listing a design version that fails a check is blocked with the reason | B4.2, B3.6 |
| B4.4 | **Listing review.** Every new listing goes through the safety classifier plus an admin check for copied factory parts and trademarks before it goes live. | Review queue shows listings with a side-by-side preview | B2.4 |
| B4.5 | **Store checkout and payouts.** Buyers pay on the seller's store. One Stripe payment splits into our print cost and platform fee, and the seller's share. The order flows into the normal fulfillment queue. | A store order produces one order record, one partner job and one correct payout | B4.3 |
| B4.6 | **White-label shipping.** Packing slip and email branded with the seller's store, not ours. | Buyer never sees our brand in a test order unless the seller turns it on | B4.5 |
| B4.7 | **Seller dashboard.** Sales, payouts, buyer reviews and per-listing performance. | Numbers match Stripe for a month of test data | B4.5 |
| B4.8 | **Takedowns.** A public form for intellectual property claims, a review queue, temporary removal, seller notice and a counter-notice flow. | A test claim removes a listing and notifies the seller | O4.3 |
| B4.9 | **Buy button.** A snippet sellers can embed on their own website or social links. | The button works on a plain HTML page | B4.5 |

**Owner tasks.**

- [ ] **O4.1** Lawyer: seller agreement, marketplace terms, buyer terms, and who is responsible when a store part fails. Update the insurance to cover marketplace sales.
- [ ] **O4.2** **Owner decides** the platform fee and the seller payout schedule.
- [ ] **O4.3** Register a DMCA agent with the US Copyright Office and write the takedown process.
- [ ] **O4.4** Confirm with the accountant how seller earnings are reported for tax (Stripe Connect can file the 1099-K forms).
- [ ] **O4.5** Recruit 10 launch sellers: shops and designers already active on the launch platforms.
- [ ] **O4.6** Set up support for store buyers: who answers them, how fast, and how reprints and refunds work.

**Gate G4.** 20 stores are live and selling. Store sales reach a share of total revenue that the Owner sets. The takedown process has been tested end to end.

## Phase 5: Own production (when the numbers say so)

Bring printing in-house only when monthly partner spend on one process has exceeded the full monthly cost of doing it ourselves for 3 months in a row. Start with nylon (SLS or MJF), not metal.

**The trigger, in numbers the admin console already tracks.** Full monthly cost = machine lease or loan payment + operator wages + space + powder and consumables + post-processing (bead blasting, dyeing) + maintenance contract. Compare it with the partner cost stored on every quote (B2.5).

**Builder tasks.**

| ID | Task | Done when |
| --- | --- | --- |
| B5.1 | **Routing.** For each order, choose in-house or a partner by material, capacity, lead time and cost. Admins can override. | Routing decisions are logged with the reason |
| B5.2 | **Build planning.** Pack several orders into one machine build (nesting) and schedule builds. | A test batch of 20 parts nests with a utilization report |
| B5.3 | **Shop-floor tracking.** A job traveler per part, quality checks on critical dimensions, and a record of the result. | Every shipped in-house part has a stored quality record |
| B5.4 | **Materials inventory.** Powder and consumable stock, with low-stock alerts. | Alert fires in a test |
| B5.5 | **Shipping labels.** Buy and print labels through Shippo or EasyPost. | A label prints from the admin console |

**Owner tasks.**

- [ ] **O5.1** Build the full cost model with machine vendors' quotes and confirm the trigger has been met for 3 months.
- [ ] **O5.2** Find space with the right power, ventilation and fire safety for powder handling. Check local permits.
- [ ] **O5.3** Hire and train an operator. Write quality procedures.
- [ ] **O5.4** Keep partners as overflow and for materials you don't run in-house.
- [ ] **O5.5** Consider ISO 9001 certification only if shop and business customers ask for it.

**Gate G5.** In-house cost per part is below partner cost, with the quality failure rate no worse than the partner's.

## Weekly rhythm

The Owner's tasks are listed in each phase above. This is the routine that keeps the two tracks in step, about 3–5 hours a week of Owner time on top of the real-world tasks.

| When | Owner does | Builder does |
| --- | --- | --- |
| Start of each session | Opens Claude Code on the repo and pastes the task prompt for one task ID | Reads `CLAUDE.md`, `docs/plan.md` and the task, then confirms its approach in 3–5 lines before coding |
| End of each session | Reviews the pull request summary, tries the change on the preview site, merges or comments | Opens a pull request with what changed, how it was tested, what was skipped, and any decisions needed |
| Weekly | Updates the task checklist in this doc, files GitHub issues for anything learned from printed parts or users, picks next week's tasks | Runs the benchmark if the design agent or Part Spec changed, and posts the report |
| After every printed part | Test-fits it, photographs it, records measured error in an issue labeled `fit` | Turns each `fit` issue into a fix or a new benchmark case |
| Monthly | Reviews AI and hosting spend, margin per order and the fit-failure rate in the admin console | Keeps dependencies updated and fixes anything flagged by error tracking |
| At each gate | Checks the gate criteria, then runs the Architect review | Prepares a gate report: what was built, test coverage, open issues, known risks |

**Architect review prompt** (paste into a session running a stronger model at each gate):

```
You are the Architect for this project. Read docs/plan.md, docs/decisions.md and the
gate report in docs/gates/G<N>.md. Review the code changed since the last gate.
Report: (1) gate criteria met or not, with evidence; (2) design problems that will get
more expensive later; (3) changes to the next phase's tasks; (4) any decision the Owner
must make. Update docs/plan.md with the changes you recommend in a separate PR.
```

## Builder handoff protocol

The Builder works one task at a time, follows the rules below, and stops to ask instead of guessing on anything in the escalation list. Copy this section into `CLAUDE.md` in B0.1 and export this whole doc to `docs/plan.md`.

**Rules for the Builder.**

1. One task ID per branch and per pull request. Branch name: `task/B1.6-part-spec-v1`.
2. Read `docs/plan.md` and `docs/decisions.md` before starting. Business rules in *Business model in brief* and *Product scope* are requirements, not suggestions.
3. Meet the task's "Done when" with an automated test wherever possible. If a check can only be done by a person, write the exact steps in the pull request.
4. Never commit secrets, API keys, scan files over 10 MB, or customer data. Large files go to R2.
5. Never run AI-generated code on the server. The design agent only produces Part Specs.
6. Any change to the Part Spec schema bumps its version and keeps older specs buildable.
7. Use millimeters everywhere. Name units in variable names where it helps (`thickness_mm`).
8. Add or update docs in the same pull request as the code.
9. Keep pull requests under about 600 changed lines. Split larger tasks and say so.

**Stop and ask the Owner before you:**

- Add a paid service or anything with a monthly cost.
- Change pricing, fees, quote math or payout math.
- Change the blocked or needs-review categories, or the safety classifier's behavior.
- Change the database in a way that deletes or rewrites existing data.
- Change the tech stack or the architecture.
- Find that a task's "Done when" can't be met as written.

**Task prompt template** (the Owner pastes this at the start of a session):

```
Task: B<phase>.<n> from docs/plan.md.
Context: <anything new since the plan was written, e.g. partner chosen, issue links>.
First, reply with your approach in 3-5 lines and any question for me.
Then implement it on branch task/B<phase>.<n>-<short-name>, meet the "Done when"
criteria with tests, update docs, and open a pull request.
In the PR description list: what changed, how it was tested, what you skipped,
and any decision you need from me.
```

**Definition of done for every task.**

- [ ] The "Done when" criteria are met and shown in the pull request.
- [ ] CI passes: lint, type checks, unit tests.
- [ ] New behavior has tests; geometry features have golden-file tests.
- [ ] Docs updated, and any design choice recorded in `docs/decisions.md`.
- [ ] No secrets, no large files, no customer data in the diff.
- [ ] The pull request description lists skipped items and open questions.

**When the Builder gets stuck** after two failed attempts at the same problem, it stops, writes up what it tried and what failed in the pull request or an issue, and the Owner brings it to an Architect session.

## Cost drivers and budget worksheet

The biggest early costs are legal, insurance, scanning and test prints, not software hosting. Fill in the estimate column from real quotes as you collect them; this plan deliberately contains no guessed prices.

| Cost | Starts | How it's billed | What makes it grow | Owner's estimate |
| --- | --- | --- | --- | --- |
| Company formation and accountant | Phase 0 | One-time, then yearly | Number of states you sell in |  |
| Lawyer | Phases 1, 2, 4 | Per document or hourly | Marketplace terms in Phase 4 |  |
| Product liability insurance | Phase 2 | Yearly premium | Sales volume and part categories |  |
| Scanner (buy, rent or hire) | Phase 0 | One-time or per day | Number of cars in the library |  |
| Test prints | Phases 1–3 | Per part | Number of benchmark rounds |  |
| Claude API (design agent and Builder sessions) | Phase 0 | Per token used | Messages per design; set a monthly cap in the Anthropic Console |  |
| Hosting: Vercel, Fly.io, R2, Postgres, Redis | Phase 0 | Monthly, usage-based | Scan storage and geometry job minutes |  |
| Clerk, Sentry, PostHog, Resend | Phase 0 | Free tiers first, then monthly | Number of users and events |  |
| Stripe fees | Phase 2 | Per payment and per payout | Order volume (already counted in each quote) |  |
| Library scanning program | Phase 3 | Per car | Number of platforms |  |
| Marketing and content | Phase 2 | Varies | Launch campaigns, event booths |  |
| Production equipment and space | Phase 5 | Lease or loan, monthly | Only after the Phase 5 trigger |  |

**What to watch every month:** AI cost per completed design, partner cost as a share of order price, and the fit-failure rate. The admin console shows all three from Phase 2.

## Risks and open decisions

The two risks most likely to sink the business are parts that don't fit and a part failure that causes harm. The plan's gates are built to catch both early.

| Risk | Early warning | What we do |
| --- | --- | --- |
| Parts don't fit the real car | Benchmark hole error above 0.5 mm; fit-failure rate above target | Calibrated scans, anchor fit errors shown to users, fit check before checkout, physical test of every benchmark part |
| A part fails and causes harm | Any needs-review or blocked request getting through | Blocked categories in code, admin review, user confirmation at checkout, insurance before the first order |
| The AI can't design what users ask for | Benchmark success rate flat; many abandoned designs | Grow the Part Spec features from real failed requests; sliders as a fallback |
| Print costs leave no margin | Stored margin per order trending down | Default to nylon, compare partners, raise markup, push Pro plan |
| Copied factory parts and trademarks in stores | Takedown requests | Listing review, takedown process, seller agreement |
| Library scans leak | A library scan shows up elsewhere | Never send full-resolution library scans to the browser; watermark previews |
| Scans from users are too rough | Calibration errors above 0.3 mm | Scanning guide, accuracy warning in the workspace, push users to the library |
| Builder model drifts from the plan | Pull requests that skip tests or change architecture | Handoff rules, small tasks, Architect review at every gate |
| A print partner fails or changes terms | Late shipments, price changes | A backup partner from O2.1; partner adapter interface |

**Decisions only the Owner can make.** Each one blocks the task listed next to it.

- [ ] Working name and domain (O0.1) — blocks B2.10
- [ ] Launch car platform and first part type (O0.4) — blocks B1.12 benchmarks
- [ ] Launch print partner and backup (O2.1) — blocks B2.8
- [ ] Markup, Pro plan price and limits, fit-failure policy (O2.3) — blocks B2.1, B2.5
- [ ] Fit-failure rate target for G2 (G2) — blocks starting Phase 3
- [ ] Next 10 platforms (O3.1) — blocks the scanning program
- [ ] Library pricing and scan submission revenue share (O3.4) — blocks B3.5
- [ ] Platform fee and payout schedule (O4.2) — blocks B4.5
- [ ] Whether to start Phase 5 (O5.1)
