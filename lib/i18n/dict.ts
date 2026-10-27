import { en } from "./en";
import { hi } from "./hi";
import { kn } from "./kn";
import type { Locale } from "./config";

export type Dict = typeof en;
export const dictionaries: Record<Locale, Dict> = { en, hi, kn };
