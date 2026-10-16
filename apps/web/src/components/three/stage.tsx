"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { advance, Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

type Vec3 = [number, number, number];

/** Camera direction and the complete box it keeps in frame (Y up). */
export interface View {
  dir: Vec3;
  box: [Vec3, Vec3];
  margin?: number;
}

/* ------------------------------------------------------------------ dev: render in hidden tabs */

// `?forcerender` (dev only) drives frames from a timer so automated checks can see the scene
// even when the browser tab is hidden and requestAnimationFrame is paused.
let forced: boolean | null = null;
function forceRender() {
  if (forced === null) {
    forced = process.env.NODE_ENV !== "production" && typeof window !== "undefined" && window.location.search.includes("forcerender");
    if (forced) setInterval(() => advance(performance.now()), 50);
  }
  return forced;
}

/* ------------------------------------------------------------------ webgl support */

let webglOk: boolean | null = null;
function supportsWebGL() {
  if (webglOk !== null) return webglOk;
  try {
    const c = document.createElement("canvas");
    webglOk = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglOk = false;
  }
  return webglOk;
}

/* ------------------------------------------------------------------ camera framing */

/** Keeps `view.box` fully in frame for any canvas aspect, easing between views. */
export function CameraRig({ view }: { view: View }) {
  const { camera, size } = useThree();
  const fov = (camera as THREE.PerspectiveCamera).fov;
  const target = useRef(new THREE.Vector3());
  const first = useRef(true);

  // The goal only changes with the view or the canvas shape, so solve it once per change.
  const goal = useMemo(() => {
    const [lo, hi] = view.box;
    const min = new THREE.Vector3(...lo);
    const max = new THREE.Vector3(...hi);
    const center = min.clone().add(max).multiplyScalar(0.5);
    const d = new THREE.Vector3(...view.dir).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(d).normalize();
    const up = d.clone().cross(right).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const tanH = tanV * (size.width / Math.max(1, size.height));
    const p = new THREE.Vector3();
    let dist = 0;
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).sub(center);
      dist = Math.max(dist, Math.max(Math.abs(p.dot(right)) / tanH, Math.abs(p.dot(up)) / tanV) + p.dot(d));
    }
    return { look: center, pos: center.clone().addScaledVector(d, dist * (view.margin ?? 1.08)) };
  }, [view, fov, size.width, size.height]);

  useFrame((_, dt) => {
    const k = first.current ? 1 : 1 - Math.exp(-dt * 3.2);
    first.current = false;
    camera.position.lerp(goal.pos, k);
    target.current.lerp(goal.look, k);
    camera.lookAt(target.current);
  });
  return null;
}

/* ------------------------------------------------------------------ stage */

function Ready({ onReady }: { onReady: () => void }) {
  const fired = useRef(false);
  useFrame(() => {
    if (!fired.current) {
      fired.current = true;
      setTimeout(onReady, 16);
    }
  });
  return null;
}

export interface StageProps {
  className?: string;
  /** Pause rendering (e.g. while a sheet covers it). */
  active?: boolean;
  /** Allow horizontal drag to turn the scene. */
  rotatable?: boolean;
  label: string;
  children: React.ReactNode;
}

export function Stage({ className, active = true, rotatable = false, label, children }: StageProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [gl, setGl] = useState<boolean | null>(null);
  const turn = useRef({ target: 0, current: 0, down: false, startX: 0, startTarget: 0, moved: false });
  const group = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setGl(supportsWebGL()), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    const vis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const handlers = rotatable
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          const t = turn.current;
          t.down = true;
          t.moved = false;
          t.startX = e.clientX;
          t.startTarget = t.target;
        },
        onPointerMove: (e: React.PointerEvent) => {
          const t = turn.current;
          if (!t.down) return;
          const dx = e.clientX - t.startX;
          if (Math.abs(dx) > 6) t.moved = true;
          if (t.moved) t.target = THREE.MathUtils.clamp(t.startTarget + dx * 0.008, -1.1, 1.1);
        },
        onPointerUp: () => {
          turn.current.down = false;
        },
        onPointerLeave: () => {
          turn.current.down = false;
        },
      }
    : {};

  const force = typeof window !== "undefined" && forceRender();
  const running = active && inView && visible && !force;

  return (
    <div
      ref={host}
      role="img"
      aria-label={label}
      className={cn("relative isolate overflow-hidden", rotatable && "cursor-grab touch-pan-y active:cursor-grabbing", className)}
      {...handlers}
    >
      {gl ? (
        <div className={cn("absolute inset-0 transition-opacity duration-700 ease-out", ready ? "opacity-100" : "opacity-0")}>
          <Canvas
            frameloop={running ? "always" : force ? "never" : "demand"}
            dpr={[1, 2]}
            camera={{ fov: 30, near: 0.1, far: 40, position: [0, 1.4, 6] }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            onCreated={({ gl: r }) => {
              r.toneMapping = THREE.NeutralToneMapping;
              r.toneMappingExposure = 1.12;
              r.setClearColor(0x000000, 0);
            }}
          >
            <hemisphereLight args={["#fffaf2", "#e6dfd2", 1.5]} />
            <directionalLight position={[-2.2, 4.2, 4.5]} intensity={2.4} color="#fff4e6" />
            <directionalLight position={[3.2, 2.2, 3.5]} intensity={0.9} color="#f1f5ff" />
            <directionalLight position={[0.5, 3, -4]} intensity={0.8} color="#ffffff" />
            <Environment resolution={128} frames={1} environmentIntensity={0.9}>
              <Lightformer form="rect" intensity={2.2} color="#fff5e8" position={[-3, 3, 4]} scale={[5, 4, 1]} />
              <Lightformer form="rect" intensity={1.2} color="#eef3ee" position={[3.5, 2, 3]} scale={[4, 3, 1]} />
              <Lightformer form="rect" intensity={0.8} color="#f6f1ea" position={[0, -2, 2]} scale={[6, 2, 1]} />
              <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[0, 5, -3]} scale={3} />
            </Environment>
            <Turntable group={group} turn={turn} />
            <group ref={group}>
              <Suspense fallback={null}>
                {children}
                <Ready onReady={() => setReady(true)} />
              </Suspense>
            </group>
            <ContactShadows position={[0, 0.001, 0]} opacity={0.32} scale={7} blur={2.6} far={2.4} resolution={512} color="#4b5a50" />
          </Canvas>
        </div>
      ) : null}
    </div>
  );
}

function Turntable({ group, turn }: { group: React.RefObject<THREE.Group | null>; turn: React.RefObject<{ target: number; current: number }> }) {
  useFrame((_, dt) => {
    const t = turn.current;
    if (!t || !group.current) return;
    t.current += (t.target - t.current) * (1 - Math.exp(-dt * 6));
    group.current.rotation.y = t.current;
  });
  return null;
}
