type Env = Record<string, string | undefined>;

export interface Message {
  to: string;
  subject: string;
  text: string;
  /** Display name for the sender (a seller's store name). The address stays ours. */
  fromName?: string;
}

export interface Mailer {
  name: string;
  send(message: Message): Promise<void>;
}

/** Writes the email to the server log instead of sending it. Used until an email provider is set up. */
export const logMailer: Mailer = {
  name: "log",
  async send(message) {
    console.log(`[email not sent: no provider] to=${message.to} subject=${message.subject}`);
  },
};

/** "Name <address>" from the configured sender, with a different display name. Strips characters that could break the header. */
export function senderWithName(from: string, name: string | undefined): string {
  if (!name) return from;
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const clean = name.replace(/[\r\n"<>\\]/g, "").trim().slice(0, 60);
  return clean ? `${clean} <${address}>` : from;
}

/**
 * Sends through Resend's REST API when RESEND_API_KEY and EMAIL_FROM are set (the Owner opens that account;
 * it has a free tier). Otherwise emails are only logged.
 */
export function getMailer(env: Env = process.env, doFetch: typeof fetch = fetch): Mailer {
  const key = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  if (!key || !from) return logMailer;
  return {
    name: "resend",
    async send(message) {
      const response = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: senderWithName(from, message.fromName), to: [message.to], subject: message.subject, text: message.text }),
      });
      if (!response.ok) throw new Error(`The email service returned ${response.status}.`);
    },
  };
}

export const validEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
