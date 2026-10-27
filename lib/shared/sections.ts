export const SECTIONS = ["atlas", "monsoon", "groundwater", "crops", "field", "impact", "methods"] as const;
export type SectionKey = (typeof SECTIONS)[number];
export const SECTION_COLOR: Record<SectionKey, string> = {
  atlas: "var(--laterite)",
  monsoon: "var(--monsoon-slate)",
  groundwater: "var(--neer-teal)",
  crops: "var(--leaf-olive)",
  field: "var(--dawn-saffron)",
  impact: "var(--soil-ochre)",
  methods: "var(--ink)",
};
