# Benchmarks

The 5 benchmark prompts (Owner task O0.7) and the script that scores them (B1.12). Results go in `results/`.

## Everyday set (B1.20)

Five requests with stated sizes: a ridged square vase, a box, a pen holder, a knob and a bracket (`apps/web/src/lib/agent/benchmark.ts`). Each case gives the agent its sizes as stated dimensions; a case passes when a spec builds and the built part matches every size (the dimension check, B1.18).

Run it on demand, because it uses API tokens (roughly a few cents per case) and needs the live geometry service:

```
ANTHROPIC_API_KEY=... GEOMETRY_SERVICE_URL=... GEOMETRY_SERVICE_TOKEN=... pnpm bench
```

The report goes to `results/everyday-<date>.md` with valid spec, dimension check, attempts and tokens per case. The scoring and report code is unit-tested without the API (`pnpm test`); the live file is skipped unless `BENCH=1`. Until the agent writes Part Spec 2.0 (B1.17d), the vase, box, holder and knob cases are expected to fail: Part Spec 1.1 has no solid bodies. Only the bracket should pass.
