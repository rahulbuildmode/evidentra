import { useId } from "react";

const RUNES = "TRACE ✦ VERIFY ✦ DECIDE ✦ CDSCO ✦ MDR 2017 ✦ EVIDENCE ✦ ";

/** Polygon points on a circle, starting at the top. */
function poly(n: number, r: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((i / n) * 360 + offset - 90) * (Math.PI / 180);
    return `${300 + r * Math.cos(a)},${300 + r * Math.sin(a)}`;
  }).join(" ");
}

/**
 * The spell circle: concentric rings, rune text and star polygons, each layer turning at its own pace.
 * Every stroke has pathLength=1 so the intro can draw it with stroke-dashoffset.
 */
export function Sigil({ className = "", runes = RUNES }: { className?: string; runes?: string }) {
  const id = useId().replace(/:/g, "");
  const ticks = Array.from({ length: 120 }, (_, i) => i);
  const dots = Array.from({ length: 12 }, (_, i) => i);
  return (
    <svg viewBox="0 0 600 600" className={`sigil ${className}`} aria-hidden fill="none" stroke="currentColor">
      <defs>
        <path id={`rune-${id}`} d="M300,300 m-252,0 a252,252 0 1,1 504,0 a252,252 0 1,1 -504,0" />
      </defs>

      <g className="sigil-layer" style={{ "--spd": "120s" } as React.CSSProperties}>
        <circle cx="300" cy="300" r="292" strokeWidth="1" pathLength={1} className="sigil-stroke" />
        {ticks.map((i) => (
          <line
            key={i}
            x1="300"
            y1={i % 10 === 0 ? 8 : 14}
            x2="300"
            y2="22"
            strokeWidth={i % 10 === 0 ? 2 : 0.8}
            transform={`rotate(${i * 3} 300 300)`}
            className="sigil-tick"
          />
        ))}
        <circle cx="300" cy="300" r="276" strokeWidth="0.8" pathLength={1} className="sigil-stroke" />
      </g>

      <g className="sigil-layer sigil-rev" style={{ "--spd": "80s" } as React.CSSProperties}>
        <text className="sigil-runes" fill="currentColor" stroke="none">
          <textPath href={`#rune-${id}`} textLength="1560">
            {runes}
            {runes}
          </textPath>
        </text>
        <circle cx="300" cy="300" r="232" strokeWidth="1.4" pathLength={1} className="sigil-stroke" />
        <circle cx="300" cy="300" r="226" strokeWidth="0.6" strokeDasharray="2 6" />
      </g>

      <g className="sigil-layer" style={{ "--spd": "60s" } as React.CSSProperties}>
        <polygon points={poly(4, 226)} strokeWidth="1.2" pathLength={1} className="sigil-stroke" />
        <polygon points={poly(4, 226, 45)} strokeWidth="1.2" pathLength={1} className="sigil-stroke" />
        {dots.map((i) => (
          <circle
            key={i}
            cx="300"
            cy="140"
            r={i % 3 === 0 ? 9 : 5}
            strokeWidth="1"
            transform={`rotate(${i * 30} 300 300)`}
            pathLength={1}
            className="sigil-stroke"
          />
        ))}
      </g>

      <g className="sigil-layer sigil-rev" style={{ "--spd": "45s" } as React.CSSProperties}>
        <polygon points={poly(3, 168)} strokeWidth="1.4" pathLength={1} className="sigil-stroke" />
        <polygon points={poly(3, 168, 60)} strokeWidth="1.4" pathLength={1} className="sigil-stroke" />
        <circle cx="300" cy="300" r="168" strokeWidth="0.8" pathLength={1} className="sigil-stroke" />
      </g>

      <g className="sigil-layer" style={{ "--spd": "30s" } as React.CSSProperties}>
        <circle cx="300" cy="300" r="96" strokeWidth="1" strokeDasharray="10 4 2 4" />
        <polygon points={poly(8, 84)} strokeWidth="0.8" pathLength={1} className="sigil-stroke" />
        <circle cx="300" cy="300" r="62" strokeWidth="1.6" pathLength={1} className="sigil-stroke" />
      </g>

      <g className="sigil-core">
        <polygon points={poly(4, 26)} fill="currentColor" stroke="none" />
        <circle cx="300" cy="300" r="40" strokeWidth="0.8" pathLength={1} className="sigil-stroke" />
      </g>
    </svg>
  );
}
