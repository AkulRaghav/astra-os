import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
import { useRef, Suspense } from "react";
import * as THREE from "three";

function Panel({ position, color, rotation = [0, 0, 0] }: { position: [number, number, number]; color: string; rotation?: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = rotation[1] + Math.sin(clock.elapsedTime * 0.3) * 0.15;
  });
  return (
    <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.8}>
      <mesh ref={ref} position={position} rotation={rotation}>
        <boxGeometry args={[1.4, 0.9, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={0.85} metalness={0.4} roughness={0.2} />
      </mesh>
    </Float>
  );
}

function CoreOrb() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock, mouse }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.25;
    ref.current.rotation.x = mouse.y * 0.3;
    ref.current.rotation.z = mouse.x * 0.2;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.1, 1]} />
      <meshStandardMaterial color="#7C3AED" emissive="#7C3AED" emissiveIntensity={1.1} wireframe />
    </mesh>
  );
}

function SceneContent({ compact = false }: { compact?: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ mouse }) => {
    if (!group.current) return;
    group.current.rotation.y += (mouse.x * 0.4 - group.current.rotation.y) * 0.05;
    group.current.rotation.x += (-mouse.y * 0.25 - group.current.rotation.x) * 0.05;
  });
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#7C3AED" />
      <pointLight position={[-5, -3, 4]} intensity={0.8} color="#06B6D4" />
      <Stars radius={40} depth={50} count={1200} factor={3} fade speed={1} />
      <group ref={group}>
        <CoreOrb />
        <Panel position={[2.2, 0.6, 0]} color="#7C3AED" rotation={[0, -0.4, 0]} />
        <Panel position={[-2.2, -0.5, 0.3]} color="#3B82F6" rotation={[0, 0.5, 0.1]} />
        <Panel position={[0.4, 1.8, -0.6]} color="#06B6D4" rotation={[0.2, 0.1, -0.05]} />
        <Panel position={[-0.6, -1.9, 0.4]} color="#A855F7" rotation={[-0.2, -0.1, 0.05]} />
        {!compact && <Panel position={[2.6, -1.6, -0.4]} color="#22D3EE" rotation={[0.1, -0.6, 0.1]} />}
      </group>
    </>
  );
}

export function AstraScene({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <SceneContent compact={compact} />
        </Suspense>
      </Canvas>
    </div>
  );
}
