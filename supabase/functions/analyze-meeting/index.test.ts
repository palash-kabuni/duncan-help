import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("analyze-meeting - rejects unauthenticated requests", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-meeting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
});

Deno.test("analyze-meeting - rejects invalid token", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-meeting`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
});

Deno.test("analyze-meeting - handles CORS preflight", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-meeting`, {
    method: "OPTIONS",
  });
  await res.text();
  assertEquals(res.status, 200);
});
