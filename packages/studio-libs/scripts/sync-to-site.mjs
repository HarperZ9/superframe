// sync-to-site.mjs — copies sense-core and render-nd .mjs files into the portfolio site vendor tree.
// Zero external deps: uses only node:fs and node:path.
import { readdirSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

// Usage: node scripts/sync-to-site.mjs <site checkout>   (or set SITE_ROOT)
const LIBS_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SITE_ROOT = process.argv[2] || process.env.SITE_ROOT;
if (!SITE_ROOT) { console.error("give the site checkout as the first argument, or set SITE_ROOT"); process.exit(2); }
const SITE_LIB  = join(SITE_ROOT, "system", "lib");

const sources = [
  { lib: "sense-core", src: join(LIBS_ROOT, "sense-core"), dst: join(SITE_LIB, "sense-core") },
  { lib: "render-nd",  src: join(LIBS_ROOT, "render-nd"),  dst: join(SITE_LIB, "render-nd")  },
];

function syncDir(srcDir, dstDir) {
  let entries;
  try {
    entries = readdirSync(srcDir, { withFileTypes: true });
  } catch {
    console.error(`  [skip] cannot read ${srcDir}`);
    return;
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      // Exclude test/ directories
      if (ent.name === "test") continue;
      syncDir(join(srcDir, ent.name), join(dstDir, ent.name));
    } else if (ent.isFile()) {
      // Only copy .mjs files; skip package.json
      if (extname(ent.name) !== ".mjs") continue;
      mkdirSync(dstDir, { recursive: true });
      const src = join(srcDir, ent.name);
      const dst = join(dstDir, ent.name);
      copyFileSync(src, dst);
      console.log(`  copied ${relative(LIBS_ROOT, src)} → ${relative(LIBS_ROOT, dst).replace(/^\.\.[\\/]/, "site/system/lib/")}`);
    }
  }
}

for (const { lib, src, dst } of sources) {
  console.log(`\n[sync] ${lib}`);
  syncDir(src, dst);
}

console.log("\n[done] vendored libs synced.");
