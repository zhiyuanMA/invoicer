import { Client } from "pg";

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  // The tests delete every row, so refuse to run against anything that is not a test database.
  if (!/_test(\?|$)/.test(url)) {
    throw new Error("TEST_DATABASE_URL must point at a database whose name ends in _test");
  }
  return url;
}

/** Empties every table, so each test starts from nothing. */
export async function resetDatabase(): Promise<void> {
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    await client.query("TRUNCATE invoices, customers, sellers");
  } finally {
    await client.end();
  }
}
