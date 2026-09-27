"use client";

import { Environment, Sky } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "./Robot";

/* ------------------------------------------------------------------ */
/* Procedural ground: tiled detail texture × large-scale vertex tint  */
/* ------------------------------------------------------------------ */

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oct = 5) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}

export type GroundKind = "grass" | "desert";

const PALETTES: Record<GroundKind, [string, string, string]> = {
  grass: ["#6f5d42", "#8e8452", "#a39063"],
  desert: ["#8d7457", "#b39a7a", "#c7b193"],
};

function makeDetailTexture(kind: GroundKind) {
  const N = 512;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  const [a, b, cc] = PALETTES[kind].map((h) => new THREE.Color(h));
  const tmp = new THREE.Color();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // periodic noise so the tile repeats seamlessly
      const px = (x / N) * 8;
      const py = (y / N) * 8;
      const n1 =
        (fbm(px, py) * (1 - x / N) + fbm(px - 8, py) * (x / N)) * (1 - y / N) +
        (fbm(px, py - 8) * (1 - x / N) + fbm(px - 8, py - 8) * (x / N)) * (y / N);
      const speck = hash(x * 3.1, y * 7.7);
      tmp.copy(a).lerp(b, THREE.MathUtils.smoothstep(n1, 0.3, 0.6));
      if (speck > 0.93) tmp.lerp(cc, 0.6);
      if (speck < 0.05) tmp.multiplyScalar(0.7);
      const i = (y * N + x) * 4;
      img.data[i] = tmp.r * 255;
      img.data[i + 1] = tmp.g * 255;
      img.data[i + 2] = tmp.b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function Ground({
  size = 600,
  kind = "grass",
  repeat = 90,
}: {
  size?: number;
  kind?: GroundKind;
  repeat?: number;
}) {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, 160, 160);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const n = fbm(x / 60 + 11, z / 60 + 3, 4);
      const v = 0.72 + 0.5 * n;
      colors[i * 3] = v * 1.02;
      colors[i * 3 + 1] = v;
      colors[i * 3 + 2] = v * 0.94;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const tex = makeDetailTexture(kind);
    tex.repeat.set(repeat, repeat);
    const m = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.95, metalness: 0 });
    return { geometry: g, material: m };
  }, [size, kind, repeat]);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}

/* ------------------------------------------------------------------ */
/* Dry-grass tufts (instanced blades) for close-up realism             */
/* ------------------------------------------------------------------ */
export function GrassField({
  count = 24000,
  radius = 14,
  center = [0, 0],
  seed = 1,
}: {
  count?: number;
  radius?: number;
  center?: [number, number];
  seed?: number;
}) {
  const mesh = useMemo(() => {
    const blade = new THREE.BufferGeometry();
    // tapered blade: 2 triangles, bends slightly
    blade.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-0.004, 0, 0, 0.004, 0, 0, -0.002, 0.5, 0.015, 0.002, 0.5, 0.015, 0, 1, 0.05], 3),
    );
    blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    blade.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 });
    const im = new THREE.InstancedMesh(blade, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    const dark = new THREE.Color("#4a4526");
    const light = new THREE.Color("#a8955f");
    let r = seed * 9973;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * radius;
      const h = 0.04 + rnd() * rnd() * 0.12;
      e.set((rnd() - 0.5) * 0.7, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.7);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(center[0] + Math.cos(a) * d, 0, center[1] + Math.sin(a) * d),
        q,
        new THREE.Vector3(1, h, 1),
      );
      im.setMatrixAt(i, m);
      im.setColorAt(i, col.copy(dark).lerp(light, rnd()));
    }
    im.receiveShadow = true;
    im.castShadow = false;
    return im;
  }, [count, radius, center, seed]);
  return <primitive object={mesh} />;
}

/* ------------------------------------------------------------------ */
/* Sky, sun light, reflections, fog                                    */
/* ------------------------------------------------------------------ */
export function SunAndSky({
  sun,
  shadowSize = 30,
  shadowTarget = [0, 0, 0],
  envFrames = 1,
  fog = true,
  intensity = 3.2,
}: {
  sun: Vec3;
  shadowSize?: number;
  shadowTarget?: Vec3;
  /** Re-render the reflection cube: 1 = once, Infinity = every frame (moving sun). */
  envFrames?: number;
  fog?: boolean;
  intensity?: number;
}) {
  const scene = useThree((s) => s.scene);
  const target = useMemo(() => new THREE.Object3D(), []);
  const elev = Math.max(0, sun[1]);
  // warm, dim light at low sun; neutral and bright at noon
  const sunColor = useMemo(
    () => new THREE.Color("#ffb070").lerp(new THREE.Color("#fff6ea"), THREE.MathUtils.smoothstep(elev, 0.05, 0.6)),
    [elev],
  );
  const fogColor = useMemo(
    () => new THREE.Color("#d8b894").lerp(new THREE.Color("#b9c6d6"), THREE.MathUtils.smoothstep(elev, 0.05, 0.5)),
    [elev],
  );
  useEffect(() => {
    if (!fog) return;
    scene.fog = new THREE.Fog(fogColor, 60, 520);
    return () => {
      scene.fog = null;
    };
  }, [scene, fog, fogColor]);

  const sunPos: Vec3 = [sun[0] * 100, sun[1] * 100, sun[2] * 100];
  const lightPos: Vec3 = [
    shadowTarget[0] + sun[0] * 60,
    shadowTarget[1] + Math.max(0.05, sun[1]) * 60,
    shadowTarget[2] + sun[2] * 60,
  ];
  const skyProps = { sunPosition: sunPos, turbidity: 6, rayleigh: 1.6, mieCoefficient: 0.006, mieDirectionalG: 0.86 };

  return (
    <>
      <Sky distance={4500} {...skyProps} />
      <Environment resolution={128} frames={envFrames}>
        <Sky {...skyProps} />
      </Environment>
      <hemisphereLight args={["#cfd8ff", "#6d5a44", 0.5]} />
      <primitive object={target} position={shadowTarget} />
      <directionalLight
        target={target}
        position={lightPos}
        color={sunColor}
        intensity={intensity * THREE.MathUtils.smoothstep(sun[1], -0.02, 0.15)}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-shadowSize}
        shadow-camera-right={shadowSize}
        shadow-camera-top={shadowSize}
        shadow-camera-bottom={-shadowSize}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
    </>
  );
}
