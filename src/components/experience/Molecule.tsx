/**
 * Original decorative molecular network for the opening. Deterministic layout (no randomness at
 * render), gentle drift, no data claims. Hidden from assistive technology.
 */
const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const r = rng(42);
const NODES = Array.from({ length: 26 }, (_, i) => ({
  x: 40 + r() * 920,
  y: 40 + r() * 520,
  s: 1.5 + r() * 3.2,
  c: i % 7 === 0 ? "#ff315a" : i % 5 === 0 ? "#8a5cff" : "#39e7ff",
  t: 7 + r() * 8,
  dx: (r() - 0.5) * 16,
  dy: (r() - 0.5) * 16,
}));
const EDGES: [number, number][] = [];
NODES.forEach((a, i) =>
  NODES.forEach((b, j) => {
    if (j > i && Math.hypot(a.x - b.x, a.y - b.y) < 170) EDGES.push([i, j]);
  }),
);
const hex = (cx: number, cy: number, R: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    return `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`;
  }).join(" ");

export function Molecule() {
  return (
    <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <g stroke="rgba(57,231,255,0.16)" strokeWidth={0.8}>
        {EDGES.map(([a, b], k) => (
          <line key={k} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} />
        ))}
      </g>
      {/* benzene-like rings */}
      <polygon points={hex(780, 170, 46)} fill="none" stroke="rgba(57,231,255,0.35)" strokeWidth={1} className="drift" style={{ ["--t" as string]: "11s" }} />
      <polygon points={hex(860, 216, 46)} fill="none" stroke="rgba(138,92,255,0.3)" strokeWidth={1} className="drift" style={{ ["--t" as string]: "13s", ["--dx" as string]: "-6px" }} />
      <polygon points={hex(180, 430, 34)} fill="none" stroke="rgba(255,49,90,0.3)" strokeWidth={1} className="drift" style={{ ["--t" as string]: "12s" }} />
      {NODES.map((n, i) => (
        <g key={i} className="drift" style={{ ["--t" as string]: `${n.t}s`, ["--dx" as string]: `${n.dx}px`, ["--dy" as string]: `${n.dy}px` }}>
          <circle cx={n.x} cy={n.y} r={n.s * 3} fill={n.c} opacity={0.08} />
          <circle cx={n.x} cy={n.y} r={n.s} fill={n.c} className="blink" style={{ ["--d" as string]: `${i * 170}ms`, ["--t" as string]: `${2 + (i % 5)}s` }} />
        </g>
      ))}
    </svg>
  );
}
