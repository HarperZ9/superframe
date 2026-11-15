// The page's first import (play.html), so it runs before any game module reads storage. When the native shell
// left a file bridge (globalThis.__lwFileBridge, save/filestore.mjs), the saves, the world record and every
// setting go to files on disk; in a plain browser, browser storage stays. Crash reports are written either way
// (ui/crash.mjs). The plain screen shows in the shell, or in a browser with ?crash=1; a dev or harness page
// reports to its own console and keeps running.
//   globalThis.__lwCrash.watchGame(G)   adds the last 200 game events to each report; game.mjs createGame calls it
import { installFileStorage } from "./filestore.mjs";
import { browserStorage } from "./save.mjs";
import { installCrashReporter } from "../ui/crash.mjs";

const fileStore = installFileStorage();
let ask = false; try { ask = new URLSearchParams(globalThis.location ? globalThis.location.search : "").has("crash"); } catch { ask = false; }
globalThis.__lwCrash = installCrashReporter({ storage: fileStore || browserStorage(), fileStore, screen: !!fileStore || ask });
