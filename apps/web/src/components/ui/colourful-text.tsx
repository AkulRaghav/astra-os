"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const COLORS = [
  "#7C3AED", "#3B82F6", "#06B6D4", "#10B981", "#F59E0B",
  "#EC4899", "#EF4444", "#8B5CF6", "#14B8A6", "#F97316",
];

export default function ColourfulText({ text }: { text: string }) {
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % COLORS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex">
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          animate={{
            color: COLORS[(colorIndex + i) % COLORS.length],
          }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="inline-block"
          style={{ whiteSpace: char === " " ? "pre" : undefined }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}
