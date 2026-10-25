# Fit check v1

`geometry.fitcheck` (task B1.10) compares a built part with a scan and says where they collide and how far apart they are. All units are millimeters.

```python
from geometry.builder import build_part, hole_positions
from geometry.fitcheck import HoleAnchor, ScanIndex, check_fit, heatmap_glb

index = ScanIndex(scan_mesh)                       # build once per scan, reuse for every version
part = build_part(spec, anchors)
report = check_fit(part, index, hole_positions(spec, anchors), hole_anchors)
report.to_dict()                                   # JSON for the web app
heatmap_glb(report)                                # the part as a GLB, red where it sinks into the scan
```

## What the report says

| Field | Meaning |
| --- | --- |
| `overlaps` | True when the part sinks into the scan by more than `tolerance_mm` (default 0.1). Smaller overlaps count as touching, because scans are noisy. |
| `max_overlap_depth_mm` | The deepest point of the part below the scan surface. |
| `overlap_volume_mm3` | An estimate: contact area times depth, over the part faces that push into the scan. Good for ranking, not for exact volumes. |
| `min_gap_mm` | The smallest distance from the part to the scan when they do not overlap, and 0 when they do. |
| `holes` | For each part hole, the nearest scan hole within 10 mm: total offset, offset across the scan hole's axis (`lateral`), offset along it (`axial`), axis angle, and diameter difference. A hole with no scan hole in range has `anchor: null`. |
| `vertex_depths_mm` | Overlap depth at each vertex of the part's check mesh, for the red heat map. `heatmap_glb` goes from grey (0 mm) to red (1 mm or more). |

## How it measures

- The scan's surface is sampled densely (seeded, so results repeat). Each sample gets a normal from a plane fit to its neighbours, with the side chosen by a vote of nearby triangle normals, because noisy scans have sliver triangles whose own normals are unreliable.
- Close to the scan (under 2 mm) the signed distance is to the local plane, which is exact on flat areas. Further away it is the distance to the nearest sample.
- The scan's triangles must wind so that normals point out of the car, toward where parts sit. Scan processing (B1.2) is where that gets fixed for real scans. The synthetic fixture already does.
- **Accuracy:** on a clean synthetic scan, depth and gap are within 0.02 mm. With 0.05 mm of scan noise they are within about 0.15 mm, and the deepest-point depth reads slightly high because it is a maximum over many noisy points. Near sharp scan edges, errors can reach about the sample spacing (0.5 mm), and for very large scans the spacing grows so there are at most 1,000,000 samples.
- Holes on a plate that is bent on are not reported yet (`hole_positions` leaves them out).

## Pairing part holes with scan holes

The Part Spec does not say which scan hole a part hole is meant to line up with, so v1 pairs each part hole with the nearest scan hole (`HoleAnchor`) within 10 mm. Anchor fitting (B1.5) will supply the scan holes. If a spec ever names the intended anchor for a hole, pairing should use that instead.
