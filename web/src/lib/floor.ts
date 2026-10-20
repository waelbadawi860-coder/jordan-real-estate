import type { Database } from "@/lib/database.types";

/** Floor choices, lowest first. Labels live in messages/*.json → floors. */
export const FLOOR_LEVELS = [
  "basement",
  "ground",
  "first",
  "second",
  "third",
  "fourth",
  "fifth_plus",
  "last",
] as const satisfies readonly Database["public"]["Enums"]["floor_level"][];

export type FloorLevel = (typeof FLOOR_LEVELS)[number];
