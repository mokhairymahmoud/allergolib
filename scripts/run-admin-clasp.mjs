import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const adminDir = join(rootDir, "admin", "apps-script");
const configPath = join(adminDir, ".clasp.json");
const args = process.argv.slice(2);

if (!args.length) {
  console.error("Usage: node ./scripts/run-admin-clasp.mjs <clasp args>");
  process.exit(1);
}

const allowsMissingConfig = new Set(["login", "logout"]);

if (!existsSync(configPath) && !allowsMissingConfig.has(args[0])) {
  console.error(
    [
      `Missing ${configPath}.`,
      "Run `npm run admin:clasp:link -- <SCRIPT_ID>` first.",
    ].join(" ")
  );
  process.exit(1);
}

const child = spawn("npx", ["clasp", ...args], {
  cwd: adminDir,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
