"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { CameraRig, Stage, type View } from "@/components/three/stage";

/** The only retained 3D model. Never hand-edit the GLB. */
const BOWL_MODEL = "/models/props.glb";

const PLATE_VIEW: View = { dir: [0, 0.78, 1], box: [[-0.165, 0, -0.165], [0.165, 0.11, 0.165]], margin: 1.28 };

function Bowl({ fill }: { fill: number }) {
  const { scene } = useGLTF(BOWL_MODEL);
  const root = useMemo(() => {
    const s = scene.clone(true);
    s.getObjectByName("mat")!.visible = false;
    return s;
  }, [scene]);
  const foods = useMemo(() => {
    const list: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (o.name.startsWith("food_")) list.push(o);
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    for (const f of list) f.scale.setScalar(0.0001);
    return list;
  }, [root]);
  const spin = useRef<THREE.Group | null>(null);
  const settled = useRef(false);
  const shown = Math.round(Math.min(1, Math.max(0, fill)) * foods.length);

  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.12;
    foods.forEach((f, i) => {
      const goal = i < shown ? 1 : 0.0001;
      // First frame shows today's bowl as it is; later changes ease in or out.
      const k = settled.current ? 1 - Math.exp(-dt * (goal > f.scale.x ? 5 : 8)) : 1;
      f.scale.setScalar(f.scale.x + (goal - f.scale.x) * k);
    });
    settled.current = true;
  });
  return (
    <group ref={spin}>
      <primitive object={root} />
    </group>
  );
}

export function PlateScene({ fill, active = true, className }: { fill: number; active?: boolean; className?: string }) {
  return (
    <Stage className={className} rotatable active={active} label={`A bowl, ${Math.round(fill * 100)}% full for today.`}>
      <CameraRig view={PLATE_VIEW} />
      <Bowl fill={fill} />
    </Stage>
  );
}
