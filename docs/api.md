# API reference

Every route handler in `apps/web/src/app/api`, with who may call it and what it does. A test (`apps/web/src/app/api/api-docs.test.ts`) fails when a route is missing here, so this stays current. A redesign can rely on these routes; none of them contain presentation. Money is integer US cents, lengths are millimeters.

| Route | Method | Who | What it does |
| --- | --- | --- | --- |
| `/api/account` | GET | signed in | The signed-in user's plan, this month's usage and the plan's limits. |
| `/api/account/portal` | POST | signed in | Returns `{ url }` of the Stripe page where a Pro user changes or cancels their subscription. |
| `/api/account/upgrade` | POST | signed in | Starts the Pro subscription: returns `{ url }` of a Stripe Checkout page. 503 until Stripe Billing is set up. |
| `/api/admin/ai-cost` | GET | admin | AI spend over the last `?days=` days (default 1, up to 90): total, most expensive designs and users. Prices are estimates. |
| `/api/admin/licenses` | POST | admin | Grants a user a scan license by hand. Body: `{ ownerId, vehicleId, area, note? }`. |
| `/api/admin/listings` | GET | admin | Listings waiting for an admin's decision. |
| `/api/admin/listings/[id]` | POST | admin | Approves or rejects a listing. Body: `{ decision: "approve" \| "reject", note?, checks?: { notFactoryCopy, noTrademark } }`. |
| `/api/admin/orders` | GET | admin | All orders for the admin console. `?status=` narrows to one status. |
| `/api/admin/orders/[id]` | POST | admin | Moves an order along its flow. Body: `{ status, trackingNumber?, partnerOrderRef? }`. Refunds here only record the status; the money is returned in Stripe. |
| `/api/admin/orders/[id]/file` | GET | admin | Production file for an order, built from the exact version that was bought (`?format=step\|stl\|glb`, default step). |
| `/api/admin/orders/[id]/job-sheet` | GET | admin | The one-page job sheet for an order, as plain text. |
| `/api/admin/orders/[id]/packing-slip` | GET | admin | The packing slip for an order, as plain text: the seller's store name for a store order. |
| `/api/admin/payouts` | POST | admin | Records a payout to a seller. Body: `{ storeId, amountCents, ref, note? }`. Does not move money. |
| `/api/admin/rates` | GET | admin | The rates quotes are priced from now, and whether they are the saved set or the built-in placeholders. |
| `/api/admin/rates` | PUT | admin | Replaces the rates. Body: `{ markupPercent, placeholder, partners: [{ id, name, shipping_cents, materials: { <materialId>: { per_cm3_cents, setup_fee_cents, min_part_cents, lead_days } } }] }`. Send `placeholder: false` only when these are real, confirmed rates; it lets live payments through. / |
| `/api/admin/safety` | GET | admin | Designs waiting for an admin to approve or reject them. |
| `/api/admin/safety/[designId]` | POST | admin | Approve or reject a design that needs review. Body: `{ decision: "approved" \| "rejected" }`. |
| `/api/admin/takedowns` | GET | admin | New claims and disputed removals waiting for an admin. |
| `/api/admin/takedowns/[id]` | POST | admin | Decides a claim. Body: `{ decision, note }`. For a new claim, decision is "remove" (take the listing down now) or "dismiss". After the seller disputes a removal, it is "restore" or "uphold". / |
| `/api/admin/users/[id]/plan` | POST | admin | Sets a user's plan (until Stripe Billing is connected). Body: `{ plan: "free" \| "pro" }`. |
| `/api/agent` | POST | signed in | Design agent. Takes `{ design_id?, message }`, continues that design's saved conversation (or starts a new design) and streams one JSON event per line. Every message and spec version is saved. Anchors and dimensions come from the design's references; until it has one, a fixture panel stands in for a scan. / |
| `/api/cars/[id]/access` | GET | signed in | Which scanned areas of this car the signed-in user may use in the workspace. Never returns scan data. |
| `/api/demo-plate` | GET | signed in | Proxies the geometry service's demo plate (GLB) to signed-in users. |
| `/api/designs` | GET | signed in | The signed-in user's designs, newest first. `?vehicle=<car id>` keeps only designs tagged for that car. |
| `/api/designs/[id]` | GET | signed in | One design with its versions and its saved conversation, so the page can reopen it. |
| `/api/designs/[id]/current` | POST | signed in | Body `{ version }`: makes that earlier version that built the current one (undo). |
| `/api/designs/[id]/dimensions` | POST | signed in | The user's answer to a value the agent found online: `{ id, action: "confirm", value_mm? }` or `{ id, action: "reject" }`. Only the owner can answer, and only a confirmed value reaches the agent. / |
| `/api/designs/[id]/edit` | POST | signed in | Slider edits. Body `{ base_version, spec }`: `spec` must be the base version's spec with only numbers changed. It is rebuilt without calling the AI and saved as a new version (`created_by` "slider") only if it builds, so a drag through invalid values leaves no failed versions behind. / |
| `/api/designs/[id]/orders` | POST | signed in | Orders one quote. Body: `{ quoteId, shipping, confirmNotSafetyCritical, acceptFitTerms }`. Both confirmations must be true; their time is stored with the order. Answers 503 when payments are not enabled. / |
| `/api/designs/[id]/quotes` | GET | signed in | Unexpired quotes for the design's current version, cheapest first. |
| `/api/designs/[id]/quotes` | POST | signed in | Builds the current version, measures it, and saves one quote per capable partner and material. Body: `{ quantity }`. |
| `/api/designs/[id]/tags` | GET | signed in | The cars this design is tagged for. Owner only. |
| `/api/designs/[id]/tags` | POST | signed in | `{ vehicleId, area }`: tag the design with every car that scan covers. The user must hold the scan. |
| `/api/designs/[id]/versions/[version]/download` | GET | signed in | Builds a saved version of the user's design as STEP, STL or GLB (`?format=`, default step). `version` is a number or `current` (the latest version that built). / |
| `/api/listings/[id]/order` | POST | signed in | Buys one unit of a store listing at its retail price. Body: `{ shipping, email?, confirmNotSafetyCritical, acceptFitTerms }`. The part is re-measured and re-quoted with the cheapest partner so fulfillment has a real partner job. / |
| `/api/orders` | GET | signed in | The signed-in user's orders, newest first. |
| `/api/orders/[id]` | GET | signed in | One of the signed-in user's orders, with the quote it was bought on. |
| `/api/shop/[slug]` | GET | public | Public. A published store and its approved listings, with no owner or review details. |
| `/api/shop/[slug]` | OPTIONS | public | Lets any website read the store (for the buy button). |
| `/api/stores` | GET | signed in | The signed-in user's store and its listings, or `{ store: null }`. |
| `/api/stores` | POST | signed in | Opens a store. Body: `{ name, slug }`. It stays unpublished until the seller is verified (B4.1). |
| `/api/stores/[id]/listings` | POST | signed in | Lists a design version in the user's own store. Body: `{ designId, quoteId, retailCents, title }`. The listing waits for review. |
| `/api/stores/branding` | POST | signed in | `{ showPlatformBrand: boolean }`: whether buyers of this store's items also see our name on emails and packing slips. Off by default. |
| `/api/stores/connect` | POST | signed in | Returns `{ url }` of Stripe's payout-account setup page for the signed-in seller. 503 until Connect is switched on. |
| `/api/stores/embed` | GET | signed in | Paste-ready buy-button snippets for the signed-in seller's approved listings. |
| `/api/stores/ledger` | GET | signed in | The signed-in seller's balance and ledger. Only their own store is ever returned. |
| `/api/stores/publish` | POST | signed in | Puts the seller's store online once Stripe has verified their payout account. |
| `/api/stores/stats` | GET | signed in | The signed-in seller's sales per listing, with totals and what they are owed. Only their own store is returned. |
| `/api/stores/takedowns` | GET | signed in | Claims against the signed-in seller's listings: their notices. |
| `/api/stores/takedowns/[id]/counter` | POST | signed in | The seller disputes a removal. Body: `{ text }`. |
| `/api/stripe/webhook` | POST | public | Stripe calls this when a payment completes. The signature is checked against STRIPE_WEBHOOK_SECRET before anything is read. |
| `/api/takedowns` | POST | public | Public. Files an intellectual-property claim against a listing. Body: `{ listingId, name, email, description, goodFaith: true }`. The claimant gets a receipt by email when email is set up. / |
| `/api/vehicles` | GET | public | Public (the catalog is not private). `GET /api/vehicles?q=miata 1994` returns matching cars. |
| `/api/waitlist` | POST | public | Public. Adds an email to the waitlist. Body: `{ email }`. Answers the same whether or not the address was already there. |
