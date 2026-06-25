export type SectionId =
  | "diary" | "todo" | "address" | "notepad"
  | "planner" | "anniversary" | "web" | "calls";

export const moduleAccent: Record<SectionId, string> = {
  diary: "#2f6f4f",        // vert sapin
  todo: "#a8431f",         // brique
  address: "#1f4e79",      // bleu encre
  notepad: "#b8860b",      // ocre
  planner: "#5b3a8c",      // prune
  anniversary: "#9c2b4e",  // grenat
  web: "#0f6e6e",          // sarcelle
  calls: "#6b6b1f",        // olive
};

export const tokens = {
  color: {
    paper: "#f4f1e8",
    ink: "#2b2b2b",
    line: "#cfc8b8",
    surface: "#fbfaf5",
    muted: "#7a766a",
  },
  font: {
    body: "'Segoe UI', system-ui, sans-serif",
    mono: "'Cascadia Code', ui-monospace, monospace",
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { sm: 2, md: 4 },
} as const;
