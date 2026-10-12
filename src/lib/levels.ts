import { z } from "zod";

/** CEFR level: 1 = A1, 2 = A2, 3 = B1, 4 = B2. */
export type Level = 1 | 2 | 3 | 4;

export const LEVELS: readonly Level[] = [1, 2, 3, 4];

export const LEVEL_NAMES: Record<Level, string> = { 1: "A1", 2: "A2", 3: "B1", 4: "B2" };

export const LevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export function isLevel(value: unknown): value is Level {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** The levels in use: A1–A2, plus B1–B2 when the learner has switched them on. */
export function activeLevels(includeB1B2: boolean): Level[] {
  return includeB1B2 ? [1, 2, 3, 4] : [1, 2];
}
