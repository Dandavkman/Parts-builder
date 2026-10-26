"use client";

import { Bounds, Center, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { MeshStandardMaterial } from "three";
import type { Mesh } from "three";

// Files often arrive fully metallic (the glTF default), which renders black without an
// environment map. The viewer picks its own matte material so every model reads clearly.
const MATERIAL = new MeshStandardMaterial({ color: "#c4c9d0", metalness: 0.1, roughness: 0.6 });

function Model({ url }: { url: string }) {
  const gltf = useGLTF(url);
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

class LoadError extends Component<{ children: ReactNode; message: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
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
      <Canvas camera={{ position: [60, 50, 60], fov: 40 }} data-testid="plate-canvas">
        <hemisphereLight args={["#ffffff", "#8a8f98", 1.4]} />
        <directionalLight position={[40, 80, 30]} intensity={2} />
        <directionalLight position={[-40, 20, -30]} intensity={0.8} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.6}>
            <Model url={url} />
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

export function PlateViewer() {
  return <ModelViewer url="/api/demo-plate" errorMessage={PLATE_ERROR} />;
}
