# Parts Builder

Design custom car parts that fit your exact car. Upload a 3D scan (or rent one from our library), describe the part in plain English, and order it printed in nylon, carbon fiber or metal. Designers can sell their parts through their own branded store, and we print every order on demand.

## Status

Phase 0: Foundations. No code yet.

## Where things are

- [`docs/plan.md`](docs/plan.md): the master plan. It covers the business model, architecture, data model, and every task by phase.
- [`docs/decisions.md`](docs/decisions.md): log of design decisions.
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
