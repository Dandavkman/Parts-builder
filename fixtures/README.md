# Fixtures

Test scans and benchmark parts. Small files go in git. Anything over 10 MB goes to R2, with an entry in `manifest.json` saying where it is and what it is. Never commit customer data.

## manifest.json

Each fixture has a `name`, a `kind` and a `description`.

- `synthetic`: generated in code by `geometry.fixtures`, with exact ground truth. No file needed.
- `real`: a scan of a real car area. Add these fields:
  - `r2_key`: object key in the `parts-builder-dev` bucket.
  - `sha256` and `size_bytes`: of the file.
  - `units`: `mm`, `cm` or `in` as exported by the scanner.
  - `caliper_measurements`: a list of `{ "from": "...", "to": "...", "mm": 123.4 }` taken with calipers, used to check scale and anchor fitting.

Real fixtures are downloaded to `fixtures/cache/` (git-ignored) on first use. Downloading arrives with the R2 setup in B1.1; until then, put the file in `fixtures/cache/` by hand.
