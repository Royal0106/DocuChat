import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Ensuring pgvector extension is enabled...");
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./db/migrations" });

  console.log("Migrations complete.");
  await pool.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
