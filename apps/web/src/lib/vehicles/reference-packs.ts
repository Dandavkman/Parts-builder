/**
 * Reference packs: facts about a car's parts or a bought-in component (a turbo, a head), each with where it
 * came from and how far to trust it. The design agent reads them through `reference_lookup` instead of
 * remembering numbers, and the fit check may only claim what a pack supports (turbo manifold support, phase 3).
 *
 * Confidence: `published` is a number a maker, seller or standard prints; `estimated` is a reasoned value that
 * still needs a measurement; `unverified` means sources disagree or leave the unit out, so the value is not
 * used; `missing` facts live in `needed`, with what to ask the user for.
 * Nothing here is invented. If a number is not in a source, it belongs in `needed`.
 */
export type Confidence = "published" | "estimated" | "unverified";

export interface ReferenceFact {
  key: string;
  label: string;
  /** One value in millimeters (or a count/ratio when `unit` says so). Absent for unverified facts. */
  value?: number;
  unit: "mm" | "count" | "ratio" | "text";
  text?: string;
  confidence: Confidence;
  source: string;
  note?: string;
}

export interface NeededFact {
  key: string;
  label: string;
  /** Why a design needs it, and how the user can get it. */
  ask: string;
}

export interface ReferencePack {
  id: string;
  title: string;
  /** Words that find this pack in a lookup. */
  keywords: string[];
  facts: ReferenceFact[];
  needed: NeededFact[];
}

const STAINLESS_FLANGE = "https://www.stainlessheaders.com/i-30498669-mazda-miata-1-8l-bp-stainless-header-flange.html";
const COMETIC_GASKET = "https://www.cometic.com/products/C14033-060";

export const REFERENCE_PACKS: ReferencePack[] = [
  {
    id: "mazda-bp-exhaust-port",
    title: "Mazda BP 1.8 L (Miata NA 1994-1997, NB 1998-2005) exhaust port face",
    keywords: ["bp", "bp-zt", "bp-z3", "bp05", "miata", "mx-5", "mx5", "na", "nb", "head", "exhaust port", "flange", "stud"],
    facts: [
      {
        key: "flange_thickness_mm",
        label: "Thickness of an aftermarket BP header flange",
        value: 9.525,
        unit: "mm",
        confidence: "published",
        source: STAINLESS_FLANGE,
        note: "3/8 in. This is a replacement flange, not the head casting; use it only as a sensible thickness for a new flange.",
      },
      {
        key: "port_shape",
        label: "Exhaust port shape",
        unit: "text",
        text: "oval",
        confidence: "published",
        source: STAINLESS_FLANGE,
      },
      {
        key: "port_opening_mm",
        label: "Port opening (long side)",
        unit: "text",
        text: "unresolved: 44.5 mm (1 3/4 in) and 47.6 mm (1 7/8 in) are both printed on one listing; a gasket listing gives 1.933 x 1.181 with no unit",
        confidence: "unverified",
        source: `${STAINLESS_FLANGE} ; ${COMETIC_GASKET}`,
        note: "Sources disagree, so no value is used. Measure the head or the gasket.",
      },
      {
        key: "port_count",
        label: "Exhaust ports on the head",
        value: 4,
        unit: "count",
        confidence: "estimated",
        source: "inline four, one exhaust port per cylinder (reasoned, not read from a drawing)",
        note: "Confirm against the head.",
      },
    ],
    needed: [
      { key: "stud_pattern", label: "Stud positions on the exhaust face", ask: "Stud count, thread (for example M8 x 1.25) and each stud's position from the first port's center. Measure the head, or send a drawing or the dimensions of a flange that fits." },
      { key: "port_spacing", label: "Port center-to-center spacing", ask: "Distance from port 1 to port 2, 2 to 3 and 3 to 4, measured on the head face." },
      { key: "port_size", label: "Port opening size", ask: "Length and width of one port (the sources disagree). Trace a gasket or measure the head." },
      { key: "deck_to_face", label: "Exhaust face position relative to the block", ask: "Height of the exhaust face above the crankshaft centerline, and how far it stands off the block." },
    ],
  },
  {
    id: "miata-engine-bay",
    title: "Miata (NA/NB) engine bay clearances around the exhaust side",
    keywords: ["engine bay", "clearance", "firewall", "steering rack", "frame rail", "brake booster", "miata", "fit", "engine-bay"],
    facts: [],
    needed: [
      { key: "firewall", label: "Firewall position relative to the exhaust face", ask: "Distance from the exhaust face to the firewall, at port height and at the top of the bay. Scan the engine bay area or measure it." },
      { key: "steering_rack", label: "Steering rack and shaft position", ask: "Rack and column outline below the exhaust, relative to the exhaust face." },
      { key: "frame_rail", label: "Front crossmember and frame rail position", ask: "Rail position and height under the manifold." },
      { key: "brake_booster", label: "Brake booster and master cylinder position", ask: "Outline of the booster relative to the exhaust face." },
      { key: "cooling", label: "Coolant hoses, heater lines and the radiator", ask: "Positions of anything within 50 mm of a hot part." },
    ],
  },
  {
    id: "maxpeedingrods-gt2871",
    title: "Maxpeedingrods GT2871 turbocharger (seller listing)",
    keywords: ["gt2871", "gt28", "maxpeedingrods", "turbo", "turbine", "volute", "t25", "chra", "wastegate"],
    facts: [
      { key: "turbine_ar", label: "Turbine A/R", value: 0.64, unit: "ratio", confidence: "published", source: "Maxpeedingrods seller listing (found by the design agent, 2026-11-02)", note: "Area in cm2 over centroid radius in cm, as the volute feature takes it." },
      { key: "turbine_inducer_mm", label: "Turbine wheel inducer diameter", value: 53.8, unit: "mm", confidence: "published", source: "Maxpeedingrods seller listing (found by the design agent, 2026-11-02)" },
      { key: "turbine_exducer_mm", label: "Turbine wheel exducer diameter", value: 47, unit: "mm", confidence: "published", source: "Maxpeedingrods seller listing (found by the design agent, 2026-11-02)" },
      { key: "inlet_flange", label: "Turbine inlet flange", unit: "text", text: "T25", confidence: "published", source: "Maxpeedingrods seller listing (found by the design agent, 2026-11-02)", note: "Type only; no hole pattern was printed." },
      { key: "outlet_flange", label: "Turbine outlet flange", unit: "text", text: "5-bolt", confidence: "published", source: "Maxpeedingrods seller listing (found by the design agent, 2026-11-02)", note: "Bolt count only; no pattern or diameter." },
      { key: "housing_material", label: "Turbine housing material", unit: "text", text: "unresolved: one listing says stainless steel rated above 900 C, another says ductile iron rated to 700 C", confidence: "unverified", source: "Maxpeedingrods seller listings (found by the design agent, 2026-11-02)", note: "Ask the seller. It decides the design temperature." },
    ],
    needed: [
      { key: "housing_drawing", label: "Turbine housing outer dimensions", ask: "The seller's dimension drawing (one seller says it is available on request) or a scan of the housing." },
      { key: "inlet_pattern", label: "Inlet flange hole pattern", ask: "Bolt hole positions and diameter, and the flange thickness." },
      { key: "outlet_pattern", label: "Outlet flange hole pattern", ask: "Bolt circle, hole diameter and the bore diameter." },
      { key: "chra_interface", label: "Bearing housing (CHRA) interface", ask: "Pilot diameter, bolt pattern and the wheel position relative to the volute." },
      { key: "wastegate_port", label: "Wastegate port position and size", ask: "Port diameter, position and angle on the housing." },
    ],
  },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Packs that match the words of a request, best match first. */
export function findPacks(query: string, packs: ReferencePack[] = REFERENCE_PACKS): ReferencePack[] {
  const words = norm(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  const scored = packs
    .map((p) => {
      const hay = norm(`${p.id} ${p.title} ${p.keywords.join(" ")}`);
      const tokens = new Set(hay.split(" "));
      return { p, score: words.filter((w) => tokens.has(w) || (w.length > 3 && hay.includes(w))).length };
    })
    .filter((x) => x.score > 0);
  return scored.sort((a, b) => b.score - a.score).map((x) => x.p);
}

function describeFact(f: ReferenceFact): string {
  const value = f.value !== undefined ? `${f.value}${f.unit === "mm" ? " mm" : ""}` : (f.text ?? "no value");
  const note = f.note ? ` ${f.note}` : "";
  return `- ${f.label}: ${value} [${f.confidence}; source: ${f.source}]${note}`;
}

/** Plain text for the agent: what is known, how far to trust it, and what the user still has to supply. */
export function describePack(p: ReferencePack): string {
  const lines = [`${p.title}`];
  if (p.facts.length) lines.push("Known:", ...p.facts.map(describeFact));
  if (p.needed.length) {
    lines.push("NOT AVAILABLE (do not guess these; ask the user for them or mark the design as using assumed dimensions):");
    lines.push(...p.needed.map((n) => `- ${n.label}: ${n.ask}`));
  }
  return lines.join("\n");
}

export const REFERENCE_RULE =
  "Rule: a fit or clearance claim may only use facts marked published, or stated by the user. Never use estimated or unverified facts, or invent any NOT AVAILABLE one, to say a part fits; say what is unchecked instead.";

/** The agent's `reference_lookup` tool. */
export function lookupReference(topic: unknown, packs: ReferencePack[] = REFERENCE_PACKS): string {
  if (typeof topic !== "string" || !topic.trim()) return "topic must be text such as 'miata bp exhaust port' or 'gt2871 turbo'.";
  const found = findPacks(topic, packs);
  if (!found.length) {
    return `No reference data for "${topic}". Known packs: ${packs.map((p) => p.id).join(", ")}. Ask the user for the dimensions instead, or research a published source and record it as researched.`;
  }
  return [...found.slice(0, 3).map(describePack), REFERENCE_RULE].join("\n\n");
}

/**
 * Which of the needed facts a fit claim is still missing. Returns the keys from the packs that have no
 * published value and no user-stated dimension (`stated` lists the pack keys the user has supplied).
 */
export function unverifiedFor(packIds: string[], stated: string[] = [], packs: ReferencePack[] = REFERENCE_PACKS): string[] {
  const out: string[] = [];
  for (const p of packs.filter((x) => packIds.includes(x.id))) {
    for (const n of p.needed) if (!stated.includes(n.key)) out.push(`${p.id}:${n.key}`);
    for (const f of p.facts) if (f.confidence !== "published" && !stated.includes(f.key)) out.push(`${p.id}:${f.key}`);
  }
  return out;
}
