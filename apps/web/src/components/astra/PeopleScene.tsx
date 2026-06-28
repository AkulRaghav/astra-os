import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

type Mood = "idle" | "typing" | "denied";

const PALETTES = [
  { skin: "#f1c79a", shirt: "#7C3AED", hair: "#2b1b3d" },
  { skin: "#c98a63", shirt: "#3B82F6", hair: "#1a1a1a" },
  { skin: "#e8b58a", shirt: "#06B6D4", hair: "#3a2a1a" },
  { skin: "#a06a45", shirt: "#A855F7", hair: "#0d0d0d" },
  { skin: "#f3d1a8", shirt: "#22D3EE", hair: "#4a2f1a" },
];

function Person({
  index,
  total,
  mood,
  radius = 2.0,
}: {
  index: number;
  total: number;
  mood: Mood;
  radius?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftLid = useRef<THREE.Mesh>(null);
  const rightLid = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const leftBrow = useRef<THREE.Mesh>(null);
  const rightBrow = useRef<THREE.Mesh>(null);

  const palette = PALETTES[index % PALETTES.length];
  // arrange in a gentle arc facing the camera
  const t = total === 1 ? 0.5 : index / (total - 1);
  const angle = THREE.MathUtils.lerp(-Math.PI * 0.32, Math.PI * 0.32, t);
  const x = Math.sin(angle) * radius;
  const z = -Math.cos(angle) * radius * 0.55;
  const y = Math.sin(index * 1.7) * 0.05;

  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const talkSpeed = useMemo(() => 6 + Math.random() * 3, []);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (group.current) {
      group.current.position.y = y + Math.sin(time * 1.2 + phase) * 0.04;
    }
    if (head.current) {
      // gentle look-around when idle; lock forward when denied
      const lookTarget = mood === "denied" ? 0 : Math.sin(time * 0.6 + phase) * 0.25;
      head.current.rotation.y += (lookTarget - head.current.rotation.y) * 0.08;
      const tilt = mood === "denied" ? -0.05 : Math.sin(time * 0.9 + phase) * 0.08;
      head.current.rotation.z += (tilt - head.current.rotation.z) * 0.08;
    }
    // Eyelids
    const closed = mood === "typing" ? 1 : mood === "denied" ? 0.15 : 0;
    if (leftLid.current && rightLid.current) {
      const targetScaleY = closed > 0.5 ? 1 : 0.05 + closed * 0.9;
      leftLid.current.scale.y += (targetScaleY - leftLid.current.scale.y) * 0.25;
      rightLid.current.scale.y = leftLid.current.scale.y;
    }
    // Mouth — talking (idle), pursed (typing), frown (denied)
    if (mouth.current) {
      if (mood === "idle") {
        const open = 0.45 + Math.abs(Math.sin(time * talkSpeed + phase)) * 0.55;
        mouth.current.scale.set(1, open, 1);
        mouth.current.position.y = -0.22;
        mouth.current.rotation.z = 0;
        (mouth.current.material as THREE.MeshStandardMaterial).color.set("#1a0a0f");
      } else if (mood === "typing") {
        mouth.current.scale.set(0.45, 0.15, 1);
        mouth.current.position.y = -0.22;
        mouth.current.rotation.z = 0;
        (mouth.current.material as THREE.MeshStandardMaterial).color.set("#1a0a0f");
      } else {
        // denied — frown
        mouth.current.scale.set(0.9, 0.25, 1);
        mouth.current.position.y = -0.18;
        mouth.current.rotation.z = Math.PI;
        (mouth.current.material as THREE.MeshStandardMaterial).color.set("#7a0e1a");
      }
    }
    // Brows
    if (leftBrow.current && rightBrow.current) {
      const browY = mood === "denied" ? -0.02 : 0.05;
      const browAngle = mood === "denied" ? 0.35 : 0;
      leftBrow.current.position.y += (0.18 + browY - leftBrow.current.position.y) * 0.2;
      rightBrow.current.position.y = leftBrow.current.position.y;
      leftBrow.current.rotation.z += (browAngle - leftBrow.current.rotation.z) * 0.2;
      rightBrow.current.rotation.z += (-browAngle - rightBrow.current.rotation.z) * 0.2;
    }
  });

  const skinColor = mood === "denied" ? "#d96a6a" : palette.skin;

  return (
    <group ref={group} position={[x, y, z]}>
      {/* body */}
      <mesh position={[0, -1.05, 0]} castShadow>
        <capsuleGeometry args={[0.45, 0.55, 6, 16]} />
        <meshStandardMaterial color={palette.shirt} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* neck */}
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 0.2, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} />
      </mesh>
      {/* head */}
      <group ref={head} position={[0, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.42, 32, 32]} />
          <meshStandardMaterial color={skinColor} roughness={0.65} />
        </mesh>
        {/* hair cap */}
        <mesh position={[0, 0.18, -0.03]} rotation={[-0.2, 0, 0]}>
          <sphereGeometry args={[0.44, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
          <meshStandardMaterial color={palette.hair} roughness={0.9} />
        </mesh>
        {/* eyes (whites) */}
        <mesh position={[-0.13, 0.04, 0.36]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
        <mesh position={[0.13, 0.04, 0.36]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
        {/* pupils */}
        <mesh position={[-0.13, 0.04, 0.43]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#0a0118" />
        </mesh>
        <mesh position={[0.13, 0.04, 0.43]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#0a0118" />
        </mesh>
        {/* eyelids (scale.y collapses to closed) */}
        <mesh ref={leftLid} position={[-0.13, 0.04, 0.42]} scale={[1, 0.05, 1]}>
          <sphereGeometry args={[0.085, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        <mesh ref={rightLid} position={[0.13, 0.04, 0.42]} scale={[1, 0.05, 1]}>
          <sphereGeometry args={[0.085, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* brows */}
        <mesh ref={leftBrow} position={[-0.13, 0.18, 0.4]}>
          <boxGeometry args={[0.12, 0.025, 0.02]} />
          <meshStandardMaterial color={palette.hair} />
        </mesh>
        <mesh ref={rightBrow} position={[0.13, 0.18, 0.4]}>
          <boxGeometry args={[0.12, 0.025, 0.02]} />
          <meshStandardMaterial color={palette.hair} />
        </mesh>
        {/* mouth */}
        <mesh ref={mouth} position={[0, -0.22, 0.38]}>
          <capsuleGeometry args={[0.05, 0.12, 4, 12]} />
          <meshStandardMaterial color="#1a0a0f" />
        </mesh>
      </group>
    </group>
  );
}

function Crowd({ mood }: { mood: Mood }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ mouse }) => {
    if (!group.current) return;
    group.current.rotation.y += (mouse.x * 0.25 - group.current.rotation.y) * 0.05;
    group.current.rotation.x += (-mouse.y * 0.1 - group.current.rotation.x) * 0.05;
  });
  return (
    <group ref={group} position={[0, -0.2, 0]}>
      <Float speed={0.6} rotationIntensity={0} floatIntensity={0.3}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Person key={i} index={i} total={5} mood={mood} />
        ))}
      </Float>
      {/* floor disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.7, -1.2]} receiveShadow>
        <circleGeometry args={[4.2, 64]} />
        <meshStandardMaterial color="#150b2b" roughness={1} metalness={0} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function SpeechBubble({ show }: { show: boolean }) {
  return (
    <Html position={[0, 1.55, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "scale(1) translateY(0)" : "scale(.7) translateY(10px)",
          transition: "opacity 220ms ease, transform 260ms cubic-bezier(.2,1.3,.4,1)",
          background: "linear-gradient(135deg, #ff3b5c, #b91c4a)",
          color: "white",
          padding: "12px 18px",
          borderRadius: "16px",
          fontFamily: "'Space Grotesk', Inter, sans-serif",
          fontWeight: 700,
          letterSpacing: "0.02em",
          fontSize: 15,
          whiteSpace: "nowrap",
          boxShadow: "0 14px 40px -10px rgba(255,59,92,0.55), 0 0 0 1px rgba(255,255,255,0.18) inset",
          position: "relative",
        }}
      >
        Who are you, imposter?
        <span style={{
          position: "absolute", left: "50%", bottom: -7, transform: "translateX(-50%) rotate(45deg)",
          width: 14, height: 14, background: "#b91c4a",
        }} />
      </div>
    </Html>
  );
}

export function PeopleScene({ mood, className = "" }: { mood: Mood; className?: string }) {
  return (
    <div className={className}>
      <Canvas shadows camera={{ position: [0, 0.6, 6.4], fov: 55 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <color attach="background" args={["#0a0118"]} />
          <fog attach="fog" args={["#0a0118", 7, 15]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 5, 4]} intensity={1.1} color="#cbb6ff" castShadow />
          <pointLight position={[-4, 2, 3]} intensity={0.9} color="#06B6D4" />
          <pointLight position={[4, -1, 2]} intensity={0.7} color={mood === "denied" ? "#ff3b5c" : "#7C3AED"} />
          <Crowd mood={mood} />
          <SpeechBubble show={mood === "denied"} />
        </Suspense>
      </Canvas>
    </div>
  );
}
