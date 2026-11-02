/** Waitlist helpers: one place that normalizes and checks addresses, and writes the export. Pure, so they are easy to test. */

/** A trimmed, lower-cased address, or null when it does not look like one. */
export function normalizeEmail(value: unknown): string | null {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export interface WaitlistRow {
  email: string;
  createdAt: Date;
}

/** CSV text for the export. Starts a cell with ' when it would be read as a spreadsheet formula. */
export function waitlistCsv(rows: WaitlistRow[]): string {
  const cell = (text: string) => {
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return ["email,joined_at", ...rows.map((r) => `${cell(r.email)},${r.createdAt.toISOString()}`)].join("\n") + "\n";
}
