/** Watercolor sky, paper grain and the SVG filters they use. Pure decoration: sits behind the page and is hidden from assistive tech. Colours come from tokens in globals.css. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-full overflow-hidden">
      <svg width="0" height="0" className="absolute">
        <filter id="bleed">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="90" />
        </filter>
        <filter id="grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" />
          <feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .4  0 0 0 .5 0" />
        </filter>
      </svg>
      <div className="wash-sky">
        <i />
        <i />
        <i />
        <i />
      </div>
      <svg className="paper-grain" width="100%" height="100%">
        <rect width="100%" height="100%" filter="url(#grain-filter)" />
      </svg>
    </div>
  );
}
