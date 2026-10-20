/**
 * Who the Settings popup's Contributors tab credits.
 *
 * People are copied from the curated rosters in `NOTICE.md` and `LICENSE.mit`,
 * written exactly as there, and are never merged or split here. Agents come from
 * the `Co-Authored-By` trailers in the git history (`pnpm run contributors:agents`
 * lists them). Names are proper nouns and stay untranslated; no contact details
 * belong in this file.
 */

export type ContributorEraId = "libre" | "fork" | "original" | "engine";

export type ContributorEra = {
  id: ContributorEraId;
  people: readonly string[];
};

export type CoauthorAgent = {
  name: string;
  maker?: string;
  variants: readonly string[];
};

export const CONTRIBUTOR_ERAS: readonly ContributorEra[] = [
  {
    id: "libre",
    people: [
      "Krzysztof Zabłocki (Zamkorus, PlohnenSoftware)",
      "Kristjan ESPERANTO",
      "Arezimt (Arezim)",
      "Thomas KT Chan (cktgh)"
    ]
  },
  {
    id: "fork",
    people: ["Asis Pattisahusiwa (asispts)", "Krzysztof Zabłocki (zamkorus)", "Mr.Lee"]
  },
  {
    id: "original",
    people: [
      "Michael Hutchison (mhutchie)",
      "Larry Lu",
      "Shoshin Nikita",
      "Walter Meier",
      "Viktor Fonic"
    ]
  },
  {
    id: "engine",
    people: ["penghongxia", "neophack", "unusuallman"]
  }
];

export const COAUTHOR_AGENTS: readonly CoauthorAgent[] = [
  {
    name: "Claude",
    maker: "Anthropic",
    variants: ["Opus 5", "Opus 5.5", "Sonnet 5", "Sonnet 5.5", "Haiku 5.5"]
  },
  { name: "Codex", maker: "OpenAI", variants: [] },
  { name: "Muse Code", maker: "Meta", variants: ["Muse Spark"] },
  { name: "GitHub Copilot", maker: "GitHub", variants: ["Copilot coding agent"] },
  { name: "ZCode", maker: "Z.ai", variants: [] },
  { name: "Kilo", variants: [] }
];
