import { execSync } from "node:child_process";

/** Applies the migrations to the test database before the integration tests run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  // The tests delete every row, so refuse to run against anything that is not a test database.
  if (!/_test(\?|$)/.test(url)) {
    throw new Error("TEST_DATABASE_URL must point at a database whose name ends in _test");
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
