import { execSync } from "node:child_process";
import { resetDatabase, testDatabaseUrl } from "./db";

/** Applies the migrations to the test database and empties it before the run. */
export default async function globalSetup() {
  const url = testDatabaseUrl();
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
  await resetDatabase();
}
