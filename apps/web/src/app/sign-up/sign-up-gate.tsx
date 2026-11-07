"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";
import { acceptanceRecord, MINIMUM_AGE_YEARS, UNDER_AGE_MESSAGE } from "../../lib/legal/age-gate";

/** Asks for age and agreement to the Terms before Clerk's sign-up form appears. The acceptance goes into the new account's metadata. */
export function SignUpGate() {
  const [ticked, setTicked] = useState(false);
  const [continued, setContinued] = useState(false);
  const [underAge, setUnderAge] = useState(false);
  const record = acceptanceRecord(ticked);

  if (continued && record) return <SignUp unsafeMetadata={record} />;

  return (
    <div className="w-full max-w-md rounded border border-line bg-card p-6">
      <h1 className="font-display text-2xl">Before you sign up</h1>
      {underAge ? (
        <p role="alert" className="mt-4 text-danger">{UNDER_AGE_MESSAGE}</p>
      ) : (
        <>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="mt-1" />
            <span>
              I am {MINIMUM_AGE_YEARS} or older and I agree to the <Link href="/terms" className="underline">Terms</Link> and the <Link href="/privacy" className="underline">Privacy Policy</Link>.
            </span>
          </label>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={!record} onClick={() => setContinued(true)} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary disabled:opacity-50">
              Continue
            </button>
            <button type="button" onClick={() => setUnderAge(true)} className="rounded-full border border-line px-5 py-2 text-sm">
              I am under {MINIMUM_AGE_YEARS}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
