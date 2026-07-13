import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load the single root .env regardless of the cwd a script/tool runs from.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });
