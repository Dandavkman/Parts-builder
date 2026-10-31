/** The product's name and tagline in one place; change them here only. The name was chosen by the Owner on 2026-10-31. The tagline is still a placeholder. */
export const BRAND = {
  name: "Ktiso",
  tagline: "Describe the part. We design it with you and make it.",
  /** Where legal and contact mail goes. PLACEHOLDER. */
  contactEmail: "hello@example.com",
} as const;

/** Where the name comes from. Shown in the landing page hero. */
export const ETYMOLOGY = {
  greek: "κτίζω",
  meaning: "to create",
  senses: ["of God creating the worlds", "to form, shape"],
} as const;

/** The six steps of the Owner's storyboard, in order. Used by the landing page and the how-it-works section. */
export const STEPS: { title: string; body: string }[] = [
  { title: "Snap a photo and say what you want", body: "Take a picture of the thing, or the place it has to fit, and describe the part in your own words. Give one real measurement so we get the size right." },
  { title: "Revise it in chat", body: "See the 3D part, then ask for changes: a little taller, a bigger hole, a different pattern. Every change is saved, and you can go back." },
  { title: "Get a material recommendation", body: "We suggest a material and process for what the part has to do, and tell you why." },
  { title: "Compare quotes", body: "We ask several manufacturers and show you each price, so you choose." },
  { title: "It arrives", body: "The manufacturer makes it and ships it to you. We email you at each step." },
  { title: "Sell your design", body: "List the design in our store. When someone buys it, you earn a royalty without doing anything more." },
];

export const FAQ: { q: string; a: string }[] = [
  { q: "Do I need to know CAD?", a: "No. You describe the part and the AI writes the design. You can adjust the numbers with sliders." },
  { q: "How accurate is the size?", a: "As accurate as the measurement you give us. A photo with one known measurement is good to a few millimetres; tell us what has to fit and we check the result against it." },
  { q: "What can I not order?", a: "We do not make safety-critical parts such as brakes, steering, seat belts, child seats, medical devices, weapons or climbing gear. Some parts, like drinking cups or mains-powered enclosures, are reviewed by a person first." },
  { q: "Who makes the part?", a: "Independent manufacturers. You see each one's price and lead time before you pay." },
  { q: "What if it does not fit?", a: "Our fit and refund policy is still being written. It will be here before we take paid orders." },
  { q: "Do I own my design?", a: "You can always download your own designs. The full terms are being finalised." },
];
