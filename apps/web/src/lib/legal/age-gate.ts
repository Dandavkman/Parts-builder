/** Version label of the Terms and Privacy Policy a person accepted. Bump when the real documents replace the drafts. */
export const TERMS_VERSION = "draft-2026-11";

export const MINIMUM_AGE_YEARS = 18;

/** What we remember about a sign-up. Stored in the sign-in provider's metadata, so no new table is needed. */
export type TermsAcceptance = { over18: true; termsVersion: string; termsAcceptedAt: string };

/** The acceptance record for a person who ticked the box. Returns null while the box is not ticked, so no account is created without it. */
export function acceptanceRecord(ticked: boolean, now: Date = new Date()): TermsAcceptance | null {
  if (!ticked) return null;
  return { over18: true, termsVersion: TERMS_VERSION, termsAcceptedAt: now.toISOString() };
}

/** Plain message shown to someone who says they are under the minimum age. Nothing is kept. */
export const UNDER_AGE_MESSAGE = `Ktiso is for people aged ${MINIMUM_AGE_YEARS} or older, so we cannot create an account for you.`;
