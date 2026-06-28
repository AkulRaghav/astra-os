import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { Trash2, Square, Circle, Type, ArrowRight, Undo, Redo, MousePointer2, Pencil, Minus } from "lucide-react";

export const Route = createFileRoute("/app/workspace")({ component: Workspace });

type Tool = "select" | "pen" | "rectangle" | "circle" | "text" | "line" | "connector";
type Element = {
  id: string;
  type: "rect" | "circle" | "text" | "line" | "freehand" | "connector";
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  points?: { x: number; y: number }[];
};

const COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#1e293b", "#ffffff"];

function Workspace() {
  const [tool, setTool] = useState<Tool>("select");
  const [elements, setElements] = useState<Element[]>([]);
  const [color, setColor] = useState("#7C3AED");
  const [history, setHistory] = useState<Element[][]>([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<Element | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<{ x: number; y: number }[]>([]);
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [connectorStart, setConnectorStart] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const commit = useCallback((next: Element[]) => {
    setElements(next);
    const h = history.slice(0, historyIdx + 1);
    h.push(next);
    setHistory(h);
    setHistoryIdx(h.length - 1);
  }, [history, historyIdx]);

  const undo = () => { if (historyIdx > 0) { setHistoryIdx(historyIdx - 1); setElements(history[historyIdx - 1]); } };
  const redo = () => { if (historyIdx < history.length - 1) { setHistoryIdx(historyIdx + 1); setElements(history[historyIdx + 1]); } };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current && tool === "select") return;
    const pos = getPos(e);

    if (tool === "pen") {
      setDrawing(true);
      setFreehandPoints([pos]);
    } else if (tool === "rectangle" || tool === "circle" || tool === "line") {
      setDrawing(true);
      setDragStart(pos);
    } else if (tool === "connector") {
      if (!connectorStart) {
        setConnectorStart(pos);
      } else {
        const el: Element = { id: `el_${Date.now()}`, type: "connector", x: connectorStart.x, y: connectorStart.y, x2: pos.x, y2: pos.y, color };
        commit([...elements, el]);
        setConnectorStart(null);
      }
    } else if (tool === "text") {
      setTextPos(pos);
    } else if (tool === "select") {
      setSelected(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing) {
      // Show connector preview
      if (tool === "connector" && connectorStart) {
        const pos = getPos(e);
        setPreview({ id: "preview", type: "connector", x: connectorStart.x, y: connectorStart.y, x2: pos.x, y2: pos.y, color });
      }
      return;
    }
    const pos = getPos(e);

    if (tool === "pen") {
      setFreehandPoints((pts) => [...pts, pos]);
    } else if (tool === "rectangle" && dragStart) {
      setPreview({ id: "preview", type: "rect", x: Math.min(dragStart.x, pos.x), y: Math.min(dragStart.y, pos.y), width: Math.abs(pos.x - dragStart.x), height: Math.abs(pos.y - dragStart.y), color });
    } else if (tool === "circle" && dragStart) {
      setPreview({ id: "preview", type: "circle", x: Math.min(dragStart.x, pos.x), y: Math.min(dragStart.y, pos.y), width: Math.abs(pos.x - dragStart.x), height: Math.abs(pos.y - dragStart.y), color });
    } else if (tool === "line" && dragStart) {
      setPreview({ id: "preview", type: "line", x: dragStart.x, y: dragStart.y, x2: pos.x, y2: pos.y, color });
    }
  };

  const handleMouseUp = () => {
    if (!drawing) return;
    setDrawing(false);

    if (tool === "pen" && freehandPoints.length > 2) {
      commit([...elements, { id: `el_${Date.now()}`, type: "freehand", x: 0, y: 0, color, points: freehandPoints }]);
      setFreehandPoints([]);
    } else if ((tool === "rectangle" || tool === "circle" || tool === "line") && preview) {
      commit([...elements, { ...preview, id: `el_${Date.now()}` }]);
    }

    setPreview(null);
    setDragStart(null);
  };

  const addText = () => {
    if (!textInput.trim() || !textPos) return;
    commit([...elements, { id: `el_${Date.now()}`, type: "text", x: textPos.x, y: textPos.y, text: textInput, color }]);
    setTextInput(""); setTextPos(null);
  };

  const deleteEl = (id: string) => commit(elements.filter((e) => e.id !== id));

  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "pen", icon: Pencil, label: "Freehand" },
    { id: "rectangle", icon: Square, label: "Rectangle (drag)" },
    { id: "circle", icon: Circle, label: "Ellipse (drag)" },
    { id: "line", icon: Minus, label: "Line (drag)" },
    { id: "connector", icon: ArrowRight, label: "Connector →" },
    { id: "text", icon: Type, label: "Text" },
  ];

  return (
    <div className="flex h-[calc(100vh-110px)] flex-col select-none">
      {/* Toolbar */}
      <div className="glass flex items-center gap-1.5 rounded-xl p-2 mb-2 overflow-x-auto">
        {tools.map((t) => (
          <button key={t.id} onClick={() => { setTool(t.id); setConnectorStart(null); setPreview(null); }} title={t.label} className={`rounded-lg p-2 transition ${tool === t.id ? "bg-gradient-astra text-white" : "text-muted-foreground hover:bg-muted"}`}>
            <t.icon className="size-4" />
          </button>
        ))}
        <div className="w-px h-6 bg-border/60 mx-1" />
        {COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} className={`size-5 rounded-full border-2 transition shrink-0 ${color === c ? "border-foreground scale-125" : "border-transparent hover:scale-110"}`} style={{ background: c }} />
        ))}
        <div className="w-px h-6 bg-border/60 mx-1" />
        <button onClick={undo} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title="Undo"><Undo className="size-4" /></button>
        <button onClick={redo} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title="Redo"><Redo className="size-4" /></button>
        <button onClick={() => commit([])} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title="Clear"><Trash2 className="size-4" /></button>
        <div className="ml-auto text-[10px] text-muted-foreground shrink-0">{elements.length} items</div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 glass rounded-2xl relative overflow-hidden"
        style={{ cursor: tool === "select" ? "default" : "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Render SVG elements */}
          {elements.map((el) => renderSVGElement(el, false, () => {}))}
          {preview && renderSVGElement(preview, true, () => {})}

          {/* Freehand live */}
          {drawing && tool === "pen" && freehandPoints.length > 1 && (
            <path d={toSmoothPath(freehandPoints)} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          )}

          {/* Connector start indicator */}
          {connectorStart && !drawing && (
            <circle cx={connectorStart.x} cy={connectorStart.y} r="5" fill={color} opacity="0.6" />
          )}
        </svg>

        {/* Text elements */}
        {elements.filter((e) => e.type === "text").map((el) => (
          <div key={el.id} className="absolute group" style={{ left: el.x, top: el.y, color: el.color }}>
            <span className="text-sm font-medium whitespace-nowrap">{el.text}</span>
            <button onClick={() => deleteEl(el.id)} className="absolute -top-3 -right-3 size-5 rounded-full bg-red-500 text-white grid place-items-center opacity-0 group-hover:opacity-100 text-[10px] pointer-events-auto">×</button>
          </div>
        ))}

        {elements.length === 0 && !drawing && !connectorStart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground/40">
              <div className="text-base font-medium">Whiteboard</div>
              <div className="text-xs">Drag to draw shapes • Click for connectors • Freehand with pen</div>
            </div>
          </div>
        )}
      </div>

      {/* Text modal */}
      {textPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setTextPos(null)}>
          <div className="glass rounded-xl p-4 w-72" onClick={(e) => e.stopPropagation()}>
            <input value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Type text..." className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none mb-2" autoFocus onKeyDown={(e) => { if (e.key === "Enter") addText(); }} />
            <button onClick={addText} className="bg-gradient-astra rounded-lg px-4 py-1.5 text-sm text-white w-full">Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

function renderSVGElement(el: Element, isPreview: boolean, onDelete: () => void) {
  const opacity = isPreview ? 0.5 : 1;
  const key = el.id;

  if (el.type === "rect") {
    return <rect key={key} x={el.x} y={el.y} width={el.width || 0} height={el.height || 0} rx="8" fill={el.color + "20"} stroke={el.color} strokeWidth="2" opacity={opacity} />;
  }
  if (el.type === "circle") {
    const cx = (el.x || 0) + (el.width || 0) / 2;
    const cy = (el.y || 0) + (el.height || 0) / 2;
    return <ellipse key={key} cx={cx} cy={cy} rx={(el.width || 0) / 2} ry={(el.height || 0) / 2} fill={el.color + "20"} stroke={el.color} strokeWidth="2" opacity={opacity} />;
  }
  if (el.type === "line") {
    return <line key={key} x1={el.x} y1={el.y} x2={el.x2 || el.x} y2={el.y2 || el.y} stroke={el.color} strokeWidth="2.5" strokeLinecap="round" opacity={opacity} />;
  }
  if (el.type === "connector") {
    const x1 = el.x, y1 = el.y, x2 = el.x2 || el.x, y2 = el.y2 || el.y;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 12;
    return (
      <g key={key} opacity={opacity}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={el.color} strokeWidth="2" strokeLinecap="round" />
        <polygon
          points={`${x2},${y2} ${x2 - headLen * Math.cos(angle - 0.4)},${y2 - headLen * Math.sin(angle - 0.4)} ${x2 - headLen * Math.cos(angle + 0.4)},${y2 - headLen * Math.sin(angle + 0.4)}`}
          fill={el.color}
        />
      </g>
    );
  }
  if (el.type === "freehand" && el.points) {
    return <path key={key} d={toSmoothPath(el.points)} stroke={el.color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />;
  }
  return null;
}

function toSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const cp = points[i];
    const next = points[i + 1];
    const mx = (cp.x + next.x) / 2;
    const my = (cp.y + next.y) / 2;
    d += ` Q ${cp.x} ${cp.y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
