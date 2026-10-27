import { z } from "zod";
import { CROPS, METHODS, SOILS } from "@/lib/agro/reference";
import { LOCALES } from "@/lib/i18n/config";

const lonLat = z.tuple([z.number().min(60).max(100), z.number().min(0).max(40)]);
export const PolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z
    .array(z.array(lonLat).min(4).max(500))
    .length(1)
    .refine((r) => {
      const ring = r[0];
      const a = ring[0];
      const b = ring[ring.length - 1];
      return a[0] === b[0] && a[1] === b[1];
    }, "ring must be closed"),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd");

export const NewFieldSchema = z.object({
  name: z.string().trim().max(60).optional().nullable(),
  geometry: PolygonSchema,
  crop: z.enum(CROPS),
  sowingDate: isoDate,
  soil: z.enum(SOILS),
  method: z.enum(METHODS),
  lastIrrigationDate: isoDate.optional().nullable(),
  language: z.enum(LOCALES).default("en"),
});
export type NewFieldInput = z.infer<typeof NewFieldSchema>;

export const PatchFieldSchema = z.object({
  name: z.string().trim().max(60).optional().nullable(),
  subscribed: z.boolean().optional(),
  language: z.enum(LOCALES).optional(),
});

export const IrrigationSchema = z.object({ date: isoDate.optional(), depthMm: z.number().min(1).max(300).nullable().optional() });
