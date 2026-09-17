import fs from "fs";
import { Client } from "pg";

const envFile = fs.readFileSync(".env", "utf8");
const dbUrl = envFile.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim() ||
  envFile.match(/^POSTGRES_URL=(.*)$/m)?.[1]?.trim() ||
  envFile.match(/^SUPABASE_DB_URL=(.*)$/m)?.[1]?.trim();

console.log("Database URL found in .env:", Boolean(dbUrl));

if (dbUrl) {
  const client = new Client({ connectionString: dbUrl });
  client.connect().then(async () => {
    console.log("Direct Postgres connected successfully!");
    const res = await client.query("SELECT current_database(), current_user;");
    console.log("DB info:", res.rows);
    await client.end();
  }).catch((err) => {
    console.log("Direct Postgres connection error:", err.message);
  });
}
