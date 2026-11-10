"use client";

import { Center, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Box3, MeshStandardMaterial, Vector3 } from "three";
import type { Group, Mesh, PerspectiveCamera } from "three";
import { frameCamera, gridFor, type Vec3 } from "../../lib/viewer/frame";

// Files often arrive fully metallic (the glTF default), which renders black without an
// environment map. The viewer picks its own matte material so every model reads clearly.
const MATERIAL = new MeshStandardMaterial({ color: "#c4c9d0", metalness: 0.1, roughness: 0.6 });

interface Framing {
  size: Vec3;
  center: Vec3;
}

function Model({ url, onMeasured, fitKey }: { url: string; onMeasured: (f: Framing) => void; fitKey: number }) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const scene = useMemo(() => {
    const copy = gltf.scene.clone(true);
    copy.traverse((object) => {
      if ((object as Mesh).isMesh) (object as Mesh).material = MATERIAL;
    });
    return copy;
  }, [gltf.scene]);
  // CAD models are Z-up; the viewer is Y-up. Rotate so the part lies flat, then centre it
  // over the origin with its lowest point on the floor (y = 0), where the grid is drawn.
  // Measure after <Center> has moved the part (its layout effect runs before this effect), so the box is where the part really is.
  useEffect(() => {
    if (!group.current) return;
    group.current.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(group.current);
    if (box.isEmpty()) return;
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    onMeasured({ size: [size.x, size.y, size.z], center: [center.x, center.y, center.z] });
  }, [scene, fitKey, onMeasured]);
  return (
    <Center bottom>
      <group ref={group} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={scene} />
      </group>
    </Center>
  );
}

/** Points the camera and the orbit target at the part, and sets the clipping range to match its size. */
function Frame({ framing, fitKey }: { framing: Framing | null; fitKey: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as { target: Vector3; update: () => void } | null;
  useEffect(() => {
    if (!framing || !controls) return;
    const f = frameCamera(framing.size, framing.center, camera.fov, size.width / Math.max(size.height, 1));
    camera.position.set(...f.position);
    camera.near = f.near;
    camera.far = f.far;
    camera.updateProjectionMatrix();
    controls.target.set(...framing.center);
    controls.update();
    // Re-frames when a new part is measured or Reframe is pressed, not when the panel is resized.
  }, [framing, fitKey, controls]);
  return null;
}

class LoadError extends Component<{ children: ReactNode; message: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
        <p>{this.props.message}</p>
      </div>
    );
  }
}

const PLATE_ERROR =
  "Could not load the plate. Check that you are signed in and that the geometry service is running (cd services/geometry && uv run uvicorn geometry.api:app). If it was idle, it may need up to 40 seconds to wake; reload then.";

/** Shows a GLB from `url`. Change the URL to show a new model (the loader caches by URL). */
export function ModelViewer({ url, errorMessage }: { url: string; errorMessage: string }) {
  return (
    <LoadError key={url} message={errorMessage}>
      <Scene url={url} />
    </LoadError>
  );
}

function Scene({ url }: { url: string }) {
  const [framing, setFraming] = useState<Framing | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const grid = gridFor(framing ? Math.max(...framing.size) : 100);
  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [60, 50, 60], fov: 40, near: 0.1, far: 100000 }} data-testid="plate-canvas">
        <hemisphereLight args={["#ffffff", "#8a8f98", 1.4]} />
        <directionalLight position={[400, 800, 300]} intensity={2} />
        <directionalLight position={[-400, 200, -300]} intensity={0.8} />
        <Suspense fallback={null}>
          <Model url={url} fitKey={fitKey} onMeasured={setFraming} />
        </Suspense>
        <Grid
          position={[0, -0.01, 0]}
          args={[200, 200]}
          cellSize={grid.cell_mm}
          sectionSize={grid.section_mm}
          cellColor="#2f6f73"
          sectionColor="#4fb3b8"
          fadeDistance={grid.fade_mm}
          infiniteGrid
        />
        <OrbitControls makeDefault />
        <Frame framing={framing} fitKey={fitKey} />
      </Canvas>
      <button
        type="button"
        onClick={() => setFitKey((k) => k + 1)}
        className="absolute right-3 top-3 rounded border border-line-strong bg-page/80 px-2 py-1 text-xs text-ink backdrop-blur hover:border-contrast hover:text-contrast"
      >
        Reframe
      </button>
    </div>
  );
}

export function PlateViewer() {
  return <ModelViewer url="/api/demo-plate" errorMessage={PLATE_ERROR} />;
}
