// Runs inside lwhost.exe (--run): writes a save through the real filestore and bridge until the process is killed.
import { createFileStore } from "../../game/engine/save/filestore.mjs";
const s = createFileStore(globalThis.__lwFileBridge), KEY = "lowwater.save.v1.auto";
console.log("ready");
for (let i = 0; ; i++) s.set(KEY, JSON.stringify({ v: 5, pad: "x".repeat(2000 + (i % 7) * 30000) }));
