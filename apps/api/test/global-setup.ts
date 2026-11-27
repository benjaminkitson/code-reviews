import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default function setup() {
  const testDatabasePath = join(tmpdir(), "code-reviews-test.db");
  rmSync(testDatabasePath, { force: true });
  process.env.DATABASE_URL = `file:${testDatabasePath}`;
  execSync("npx prisma migrate deploy", { stdio: "ignore" });
}
