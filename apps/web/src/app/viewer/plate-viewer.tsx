"use client";

import { Bounds, Center, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { MeshStandardMaterial } from "three";
import type { Mesh } from "three";

const PLATE_URL = "/api/demo-plate";

// Files often arrive fully metallic (the glTF default), which renders black without an
// environment map. The viewer picks its own matte material so every model reads clearly.
const MATERIAL = new MeshStandardMaterial({ color: "#c4c9d0", metalness: 0.1, roughness: 0.6 });

function Plate() {
  const gltf = useGLTF(PLATE_URL);
  const scene = useMemo(() => {
    const copy = gltf.scene.clone(true);
    copy.traverse((object) => {
      if ((object as Mesh).isMesh) (object as Mesh).material = MATERIAL;
    });
    return copy;
  }, [gltf.scene]);
  // CAD models are Z-up; the viewer is Y-up. Rotate so the plate lies flat.
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

class LoadError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
        <p>
          Could not load the plate. Check that you are signed in and that the geometry service is
          running (<code>cd services/geometry &amp;&amp; uv run uvicorn geometry.api:app</code>).
        </p>
      </div>
    );
  }
}

export function PlateViewer() {
  return (
    <LoadError>
      <Canvas camera={{ position: [60, 50, 60], fov: 40 }} data-testid="plate-canvas">
        <hemisphereLight args={["#ffffff", "#8a8f98", 1.4]} />
        <directionalLight position={[40, 80, 30]} intensity={2} />
        <directionalLight position={[-40, 20, -30]} intensity={0.8} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.6}>
            <Plate />
          </Bounds>
        </Suspense>
        <Grid
          position={[0, -3, 0]}
          args={[200, 200]}
          cellSize={5}
          sectionSize={25}
          fadeDistance={220}
          infiniteGrid
        />
        <OrbitControls makeDefault />
      </Canvas>
    </LoadError>
  );
}
