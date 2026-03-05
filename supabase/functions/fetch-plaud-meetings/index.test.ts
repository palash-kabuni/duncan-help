import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("fetch-plaud-meetings - rejects unauthenticated requests", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-plaud-meetings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.text();
  assertEquals(res.status, 401);
});

Deno.test("fetch-plaud-meetings - rejects invalid token", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-plaud-meetings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
      "apikey": SUPABASE_ANON_KEY,
    },
  });
  const body = await res.text();
  assertEquals(res.status, 401);
});

Deno.test("fetch-plaud-meetings - handles CORS preflight", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-plaud-meetings`, {
    method: "OPTIONS",
  });
  await res.text();
  assertEquals(res.status, 200);
});
