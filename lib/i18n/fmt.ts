/** Replace {slot} placeholders. Never machine-translates: slots hold numbers/dates/names only. */
export function fmt(template: string, slots: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in slots ? String(slots[k]) : `{${k}}`));
}
