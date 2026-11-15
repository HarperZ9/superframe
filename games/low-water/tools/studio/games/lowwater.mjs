// Low Water, as the Studio's game config: the Gullet's speaking cast through the portrait roster
// (characters/proto/heads_roster.mjs), the same rig and materials, no eras and no peoples' palettes.
import quota from "./quota.mjs";

export default {
  ...quota, name: "lowwater", title: "Low Water",
  async members() { const { roster } = await import("../../../characters/proto/heads_roster.mjs"); return roster("lowwater"); },
  export: { root: "characters/portraits-painted-lowwater", defaultEra: 1 },
  peoples: { share: 0 },
};
