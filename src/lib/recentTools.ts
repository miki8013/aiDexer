/** Data behind the weekly "new AI tools" digest. Newest week first. */
export interface DigestWeek {
  weekOf: string;
  tools: string[]; // tool names, must exist in aiDatabase
}

export const digestWeeks: DigestWeek[] = [
  {
    weekOf: "Week of Aug 24, 2026",
    tools: ["PandasAI", "Row Zero", "OpenRefine"],
  },
  {
    weekOf: "Week of Aug 17, 2026",
    tools: ["Calendly AI", "Zoom AI Companion", "Julius AI"],
  },
  {
    weekOf: "Week of Aug 10, 2026",
    tools: ["CapCut", "Suno", "Play.ht"],
  },
  {
    weekOf: "Week of Aug 3, 2026",
    tools: ["Beautiful.ai", "SlidesAI", "Pitch"],
  },
  {
    weekOf: "Week of Jul 27, 2026",
    tools: ["Murf", "Descript", "Tableau"],
  },
];
