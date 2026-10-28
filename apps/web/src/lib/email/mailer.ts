type Env = Record<string, string | undefined>;

export interface Message {
  to: string;
  subject: string;
  text: string;
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
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
      });
      if (!response.ok) throw new Error(`The email service returned ${response.status}.`);
    },
  };
}

export const validEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
