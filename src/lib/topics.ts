export const TOPICS = [
  "Function words",
  "Numbers & measures",
  "People & family",
  "Places & directions",
  "Time",
  "Food & drink",
  "Daily life & transport",
  "School & work",
  "Body & health",
  "Weather & colors",
  "Actions",
  "Descriptions",
] as const;

export type Topic = (typeof TOPICS)[number];

export function isTopic(value: unknown): value is Topic {
  return typeof value === "string" && (TOPICS as readonly string[]).includes(value);
}
