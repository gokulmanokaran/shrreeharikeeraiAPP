import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const key = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
const url = envFile.match(/SUPABASE_URL=(.*)/)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";

async function testEndpoints() {
  const endpoints = [
    "/rest/v1/rpc/exec_sql",
    "/rest/v1/rpc/exec",
    "/rest/v1/rpc/run_sql",
    "/pg/query",
    "/sql",
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${url}${ep}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key!,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ query: "SELECT 1;" }),
      });
      console.log(`Endpoint ${ep} -> Status: ${res.status}`);
      const text = await res.text();
      console.log(`Response: ${text.slice(0, 100)}`);
    } catch (e: any) {
      console.log(`Endpoint ${ep} -> Error: ${e.message}`);
    }
  }
}

testEndpoints();
