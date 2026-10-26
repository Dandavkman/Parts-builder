/** The four ways to start a design (the general-market plan, B1.19). A scan is one choice among several. */
export type StartChoiceId = "photo" | "lookup" | "scan" | "describe";

export interface StartChoice {
  id: StartChoiceId;
  title: string;
  hint: string;
  /** Text put in the message box when the choice is picked (not for photo and scan). */
  example?: string;
  /** False while the feature behind the choice does not exist yet. */
  available: boolean;
}

export const START_CHOICES: StartChoice[] = [
  {
    id: "photo",
    title: "Start from a photo",
    hint: "Take or choose a picture of something similar, then give one real measurement or put a card or coin next to it.",
    available: true,
  },
  {
    id: "lookup",
    title: "Look up a product",
    hint: "Name a real product and I will find its published measurements, with the source, for you to confirm.",
    example: "Design a case for the (product name). Look up its measurements first.",
    available: true,
  },
  {
    id: "describe",
    title: "Just describe it",
    hint: "Say what you want and type the sizes you know.",
    example: "A square vase for flowers, 80 mm wide and 200 mm tall, with 2 mm walls and ridges down the sides.",
    available: true,
  },
  {
    id: "scan",
    title: "Use a 3D scan",
    hint: "For parts that must fit a car exactly. Scan upload is not open yet; until then car designs use a stand-in panel.",
    available: false,
  },
];
