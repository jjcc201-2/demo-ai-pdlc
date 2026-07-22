import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

/**
 * Load a .env file by walking up from the current working directory. This
 * ensures the API picks up the repo-root .env whether it was started from
 * the repo root, `apps/api/`, or anywhere in between.
 */
function loadEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, ".env");
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to dotenv's default behaviour (cwd/.env) if nothing was found.
  loadDotenv();
}

loadEnv();
