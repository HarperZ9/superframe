// Which story the harness plays: LW_STORY=quota for The Quota's slice (tools/quota/story.mjs), anything
// else (or nothing) for Low Water's acts (tools/story.mjs). Every tool imports the story through here.
//   STORY { end, watch, report, acts (act root files, or null for content/actN), nonFighters }
//   LEDGER, GUARDS, BENCH (see tools/story.mjs)
const name = (typeof process !== "undefined" && process.env.LW_STORY) || "gullet";
const m = name === "gullet" ? await import("./story.mjs") : await import(`./${name}/story.mjs`);
export const STORY_NAME = name;
export const { STORY, LEDGER, GUARDS, BENCH } = m;
