import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const nextCachePath = resolve(projectRoot, ".next");

if (!nextCachePath.startsWith(projectRoot)) {
  throw new Error("Refusing to remove a path outside the project.");
}

await rm(nextCachePath, { recursive: true, force: true });
