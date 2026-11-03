# Fit-failure and refund policy (DRAFT for the Owner)

Status: **draft proposal, not decided.** It answers the "what happens when a part doesn't fit (reprint, refund or store credit)" half of O2.3. Nothing in the code enforces it yet. The numbers marked *(placeholder)* are mine; the Owner sets the real ones, and the lawyer reviews the final wording (O1.3) before it goes into the Terms.

## Why a policy is needed

Every part is made to order, so it can't be resold. Our margin is a percentage of manufacturing cost (decision D6), so a free reprint costs us the full manufacturing cost plus shipping and wipes out the margin on several orders. The policy has to say who pays in each case, and it has to match how sure we are that the part fits: a part designed from a scan is far more certain to fit than one designed from a photo or a looked-up measurement (see the starting-point table in `docs/plan.md`).

## Four kinds of problem

| Case | What it means | Who is at fault |
| --- | --- | --- |
| **A. Made wrong** | The part differs from the design we sold (out of tolerance, broken, wrong material, damaged in shipping) | The manufacturer or carrier |
| **B. Fits the design, not the object** | The part is exactly what the customer approved, but it doesn't fit their real object | The input: a photo, a looked-up measurement, or a mis-typed dimension |
| **C. Blocked or unsafe** | The part was caught in safety review or the design can't be made | Nobody; it never ships |
| **D. Change of mind** | The customer no longer wants it | The customer |

## Proposed remedies

| Case | Remedy |
| --- | --- |
| **A** | Customer chooses a free reprint or a full refund including shipping. We claim the cost back from the manufacturer. |
| **B, scan-based design** | One free redesign session and a reprint at cost with no margin. The scan fit check ran, so we share the risk. |
| **B, photo or looked-up design** | One free redesign session, and the reprint is offered at **our cost with no margin** *(placeholder)*. No refund: the confirmation screen already tells the customer these designs carry less fit certainty, and they accepted the fit terms at checkout. |
| **C** | Full refund (the existing `in_review` → refunded move). |
| **D** | Full refund if the order hasn't reached `sent_to_partner`. After that, no refund, because the part is being made for them. |

Rules that apply to all cases:
- **Claim window:** 14 days after delivery *(placeholder)*, with a photo of the part next to a ruler or caliper for cases A and B.
- **One reprint per order.** A second failure goes to the Owner by hand.
- **Refunds go back to the original payment method** through Stripe. Tax is refunded with the part.
- **Store orders:** a refund subtracts the seller's royalty (the ledger already does this). The designer is not charged for a case A reprint; the cost comes out of our margin.
- **Safety:** a part the customer says broke under load is never a refund case. It is escalated to the Owner and logged, and the part category is reviewed.
- Store credit is not offered at launch (adds accounting and legal work); it can be added later.

## What the code already supports and what is missing

Already there: the `reprint` and `refunded` statuses and their allowed moves, the order's frozen design version and fit-terms acceptance, and the ledger reversing a seller's royalty on refund.

Not built (each a separate task if you approve the policy):
1. A customer "report a problem" form on the order with the photo upload and case choice.
2. A refund button that calls the Stripe Refunds API (today a refund only records the status; you refund in Stripe by hand).
3. A reprint order that copies the original order at cost, and a counter that enforces one reprint.
4. A tracked fit-failure rate for Gate G2 (target 10%, plan.md), counted per starting point.

## Decisions for the Owner

1. Is the split by case (A refund or reprint, B reprint at cost, D no refund after production starts) right, or do you want to be more generous at launch to build trust?
2. For photo and looked-up designs, reprint at cost or a different share *(placeholder: cost, no margin)*?
3. Claim window: 14 days from delivery?
4. Do you want store credit at launch? (Proposed: no.)
5. Approve the follow-up tasks above, in that order.
