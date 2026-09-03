import { getD1 } from "@/db/d1";

const clean = (value: unknown, max = 80) => typeof value === "string" ? value.trim().slice(0, max) : "";
const allowedIssues = new Set(["none", "instructions", "documents", "wait", "accessibility", "other"]);

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "JSON request required" }, { status: 415 });
  const body = await request.json() as { code?: string; rating?: number; issue?: string };
  const code = clean(body.code, 30).toUpperCase();
  const rating = Number(body.rating);
  const issue = clean(body.issue, 30) || "none";
  if (!code || ![1, 2, 3, 4, 5].includes(rating) || !allowedIssues.has(issue)) return Response.json({ error: "Invalid feedback" }, { status: 400 });
  const db = getD1();
  const visit = await db.prepare("SELECT status FROM visits WHERE code = ? LIMIT 1").bind(code).first<{status:string}>();
  if (!visit) return Response.json({ error: "Pass not found" }, { status: 404 });
  if (visit.status !== "complete") return Response.json({ error: "Feedback opens after the transaction is complete" }, { status: 409 });
  try {
    await db.prepare("INSERT INTO feedback (id, visit_code, rating, issue, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), code, rating, issue, Date.now()).run();
  } catch {
    return Response.json({ error: "Feedback was already submitted for this visit" }, { status: 409 });
  }
  return Response.json({ submitted: true }, { status: 201 });
}
