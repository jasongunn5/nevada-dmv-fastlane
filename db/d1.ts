import { env } from "cloudflare:workers";

export function getD1() {
  if (!env.DB) throw new Error("Database unavailable");
  return env.DB;
}
