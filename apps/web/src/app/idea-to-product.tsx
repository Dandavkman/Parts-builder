/**
 * The home page's picture: a flat 2D sketch (the idea), a prompt in plain words, and the same
 * bracket as a shaded 3D part (the product). Drawn in SVG with colour tokens only.
 */
const ISO = "translate(89.6 30) matrix(.866 .5 -.866 .5 0 0) scale(.75)";
const SLOTS = [26, 108] as const;
const PROMPT = "A flat bracket, 60 mm wide, with two slots for the bolts.";

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 56 24" className={`h-6 w-12 text-accent sm:w-14 ${className}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h46M39 3l11 9-11 9" />
    </svg>
  );
}

function Label({ children, className = "" }: { children: string; className?: string }) {
  return <b className={`self-end font-caps text-base font-medium uppercase tracking-[0.2em] sm:text-2xl sm:tracking-[0.28em] ${className}`}>{children}</b>;
}

function Sketch() {
  return (
    <svg viewBox="0 0 240 170" role="img" aria-label="A flat dashed 2D sketch of a bracket with two slots and a width dimension" className="w-full max-w-60">
      <g fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="4 6" strokeLinecap="round">
        <rect x="30" y="36" width="180" height="84" rx="4" />
        <rect x="56" y="66" width="46" height="24" rx="12" />
        <rect x="138" y="66" width="46" height="24" rx="12" />
      </g>
      <path d="M30 144h180M30 138v12M210 138v12" stroke="var(--accent)" strokeWidth="1.2" fill="none" opacity=".8" />
      <text x="120" y="164" textAnchor="middle" fontSize="12" fill="var(--subtle)">
        60 mm
      </text>
    </svg>
  );
}

function Part() {
  return (
    <svg viewBox="0 0 240 170" role="img" aria-label="A shaded 3D render of the same bracket with two rounded slots" className="w-full max-w-60">
      <defs>
        <linearGradient id="part-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--page)" }} />
          <stop offset=".55" style={{ stopColor: "var(--wash-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--wash-a)" }} />
        </linearGradient>
        <linearGradient id="part-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--wash-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--wash-c)" }} />
        </linearGradient>
        <filter id="part-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        {SLOTS.map((x) => (
          <clipPath key={x} id={`part-slot-${x}`}>
            <rect transform={ISO} x={x} y="30" width="46" height="24" rx="12" />
          </clipPath>
        ))}
      </defs>
      <polygon points="35,81.5 151.9,149 206.5,117.5 89.6,50" transform="translate(0 14)" fill="var(--ink)" opacity=".25" filter="url(#part-shadow)" />
      <g strokeLinejoin="round" strokeWidth="3">
        <polygon points="35,61.5 151.9,129 151.9,149 35,81.5" fill="url(#part-side)" stroke="var(--wash-a)" />
        <polygon points="35,61.5 151.9,129 151.9,149 35,81.5" fill="var(--ink)" opacity=".16" stroke="none" />
        <polygon points="151.9,129 206.5,97.5 206.5,117.5 151.9,149" fill="url(#part-side)" stroke="var(--wash-a)" />
        <polygon points="151.9,129 206.5,97.5 206.5,117.5 151.9,149" fill="var(--ink)" opacity=".32" stroke="none" />
        <polygon points="89.6,30 206.5,97.5 151.9,129 35,61.5" fill="url(#part-top)" stroke="url(#part-top)" />
      </g>
      {SLOTS.map((x) => (
        <g key={x} clipPath={`url(#part-slot-${x})`}>
          <rect width="240" height="170" fill="var(--ink)" opacity=".5" />
          <g transform="translate(0 9)">
            <rect transform={ISO} x={x} y="30" width="46" height="24" rx="12" fill="var(--wash-c)" />
          </g>
        </g>
      ))}
      <g fill="none" strokeLinecap="round" stroke="var(--highlight)">
        <polyline points="35,61.5 89.6,30 206.5,97.5" strokeOpacity=".85" strokeWidth="1.6" />
        <path d="M35 61.5v20M151.9 129v20M206.5 97.5v20" strokeOpacity=".35" strokeWidth="1" />
      </g>
    </svg>
  );
}

export function IdeaToProduct() {
  // Phone: Idea and Product labels, their pictures, then the "natural language" line and the prompt window.
  // From md up: one row of five columns, with the "natural language" line level with the Idea and Product labels.
  return (
    <div className="grid w-full max-w-4xl grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-x-3 gap-y-4 md:grid-cols-[1fr_auto_minmax(190px,250px)_auto_1fr] md:gap-x-4">
      <Label className="col-start-1 row-start-1">Idea</Label>
      <Label className="col-start-3 row-start-1 md:col-start-5">Product</Label>
      <div className="col-start-1 row-start-2 flex justify-center">
        <Sketch />
      </div>
      <Arrow className="col-start-2 row-start-2" />
      <div className="col-start-3 row-start-2 flex justify-center md:col-start-5">
        <Part />
      </div>
      <Arrow className="row-start-2 hidden md:col-start-4 md:block" />
      <p className="col-span-3 col-start-1 row-start-3 m-0 self-end text-center font-display text-xl font-medium leading-tight text-[var(--highlight)] [text-shadow:0_1px_3px_color-mix(in_srgb,var(--ink)_60%,transparent)] sm:text-2xl md:col-span-1 md:col-start-3 md:row-start-1">
        <s className="opacity-80">complex design software</s> natural language
      </p>
      <p className="col-span-3 col-start-1 row-start-4 m-0 rounded-[18px] border border-line bg-card p-4 text-center font-display text-xl leading-snug backdrop-blur-sm md:col-span-1 md:col-start-3 md:row-start-2">“{PROMPT}”</p>
    </div>
  );
}
