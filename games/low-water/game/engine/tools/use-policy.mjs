// The builds and routes the harness plays, for the story LW_STORY names (tools/use-story.mjs):
// tools/policy.mjs for Low Water, tools/<story>/policy.mjs otherwise. Same exports either way.
const name = (typeof process !== "undefined" && process.env.LW_STORY) || "gullet";
const m = name === "gullet" ? await import("./policy.mjs") : await import(`./${name}/policy.mjs`);
export const { BUILDS, ROUTES, baseOf, applyMax, score, strainFor, upkeep, endingFlags, intentOf, goalDist } = m;
