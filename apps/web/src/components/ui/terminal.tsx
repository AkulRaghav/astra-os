"use client";

import { useEffect, useState, useRef } from "react";

interface TerminalProps {
  commands: string[];
  outputs?: Record<number, string[]>;
  typingSpeed?: number;
  delayBetweenCommands?: number;
  className?: string;
  onComplete?: () => void;
}

export function Terminal({
  commands,
  outputs = {},
  typingSpeed = 45,
  delayBetweenCommands = 1000,
  className = "",
  onComplete,
}: TerminalProps) {
  const [lines, setLines] = useState<{ type: "command" | "output"; text: string }[]>([]);
  const [currentCmd, setCurrentCmd] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [showCursor, setShowCursor] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, currentChar]);

  // Typing animation
  useEffect(() => {
    if (currentCmd >= commands.length) {
      setIsTyping(false);
      onComplete?.();
      return;
    }

    const cmd = commands[currentCmd];

    if (currentChar < cmd.length) {
      const timeout = setTimeout(() => {
        setCurrentChar((c) => c + 1);
      }, typingSpeed + Math.random() * 20);
      return () => clearTimeout(timeout);
    }

    // Command fully typed — show it and its output
    const timeout = setTimeout(() => {
      setLines((prev) => [
        ...prev,
        { type: "command", text: cmd },
        ...(outputs[currentCmd] || []).map((o) => ({ type: "output" as const, text: o })),
      ]);
      setCurrentCmd((c) => c + 1);
      setCurrentChar(0);
    }, 300);

    return () => clearTimeout(timeout);
  }, [currentCmd, currentChar, commands, outputs, typingSpeed, delayBetweenCommands, onComplete]);

  // Delay between commands
  useEffect(() => {
    if (currentCmd > 0 && currentCmd < commands.length && currentChar === 0) {
      setIsTyping(false);
      const timeout = setTimeout(() => setIsTyping(true), delayBetweenCommands);
      return () => clearTimeout(timeout);
    }
    setIsTyping(true);
  }, [currentCmd, currentChar, delayBetweenCommands, commands.length]);

  const currentText = currentCmd < commands.length ? commands[currentCmd].slice(0, currentChar) : "";

  return (
    <div className={`glass-strong rounded-2xl overflow-hidden ${className}`}>
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-3 rounded-full bg-red-500" />
          <span className="size-3 rounded-full bg-yellow-500" />
          <span className="size-3 rounded-full bg-green-500" />
        </div>
        <span className="ml-3 font-mono text-xs text-muted-foreground">Terminal</span>
      </div>

      {/* Terminal body */}
      <div
        ref={containerRef}
        className="min-h-[300px] max-h-[500px] overflow-y-auto bg-[#0a0a0f] p-4 font-mono text-sm"
      >
        {/* Previous lines */}
        {lines.map((line, i) => (
          <div key={i} className={line.type === "command" ? "text-white" : "text-green-400/80"}>
            {line.type === "command" ? (
              <span><span className="text-emerald-400">❯</span> {line.text}</span>
            ) : (
              <span className="pl-4">{line.text}</span>
            )}
          </div>
        ))}

        {/* Currently typing line */}
        {currentCmd < commands.length && (
          <div className="text-white">
            <span className="text-emerald-400">❯</span>{" "}
            <span>{currentText}</span>
            <span className={`${showCursor ? "opacity-100" : "opacity-0"} transition-opacity`}>▌</span>
          </div>
        )}

        {/* Done state */}
        {currentCmd >= commands.length && (
          <div className="text-white mt-1">
            <span className="text-emerald-400">❯</span>{" "}
            <span className={`${showCursor ? "opacity-100" : "opacity-0"} transition-opacity`}>▌</span>
          </div>
        )}
      </div>
    </div>
  );
}
