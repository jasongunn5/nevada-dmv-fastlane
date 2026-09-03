import { getD1 } from "@/db/d1";
import { hasOperationsAccess, operationsDenied } from "@/app/operations-auth";

type VisitInput = {
  service?: string;
  subtype?: string;
  location?: string;
  documentsConfirmed?: number;
  transactionConfirmed?: boolean;
  code?: string;
  action?: string;
  counter?: string;
};

const allowedTransactions: Record<string, string[]> = {
  license: ["First Nevada license", "Renew a license or ID", "Replace a lost card", "Upgrade to Real ID"],
  registration: ["New Nevada resident", "Private-party purchase", "Dealer purchase", "Renew registration"],
  title: ["Private-party transfer", "Family member or gift", "Out-of-state title", "Duplicate Nevada title"],
  test: ["Online written test", "In-office written test", "Adult road test", "Teen road test"],
  appointment: ["Schedule a new appointment", "Prepare for an existing appointment", "Lobby check-in", "Find an online service"],
};

const clean = (value: unknown, max = 100) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function makeCode(service: string) {
  const prefix = service.replace(/[^a-z]/gi, "").slice(0, 6).toUpperCase() || "VISIT";
  const suffix = crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(-6).padStart(6, "0");
  return `NV-${prefix}-${suffix}`;
}

export async function GET(request: Request) {
  const db = getD1();
  const url = new URL(request.url);
  const code = clean(url.searchParams.get("code"), 30).toUpperCase();
  if (code) {
    const visit = await db.prepare("SELECT code, service, subtype, location, documents_confirmed AS documentsConfirmed, status, queue_number AS queueNumber, service_counter AS serviceCounter, created_at AS createdAt FROM visits WHERE code = ? LIMIT 1").bind(code).first();
    if (!visit) return Response.json({ error: "Pass not found" }, { status: 404 });
    return Response.json({ visit });
  }
  if (!hasOperationsAccess(request)) return operationsDenied();
  if (url.searchParams.get("analytics") === "1") {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const [summary, locationRows, serviceRows, feedbackSummary, issueRows] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) AS waiting, SUM(CASE WHEN status = 'called' THEN 1 ELSE 0 END) AS serving, AVG(CASE WHEN status = 'complete' THEN updated_at - created_at END) AS averageDuration FROM visits WHERE created_at >= ?").bind(since).first(),
      db.prepare("SELECT location, COUNT(*) AS total, SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS completed FROM visits WHERE created_at >= ? GROUP BY location ORDER BY total DESC").bind(since).all(),
      db.prepare("SELECT service, COUNT(*) AS total FROM visits WHERE created_at >= ? GROUP BY service ORDER BY total DESC").bind(since).all(),
      db.prepare("SELECT COUNT(*) AS responses, AVG(rating) AS averageRating, SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) AS positive FROM feedback WHERE created_at >= ?").bind(since).first(),
      db.prepare("SELECT issue, COUNT(*) AS total FROM feedback WHERE created_at >= ? AND issue != 'none' GROUP BY issue ORDER BY total DESC").bind(since).all(),
    ]);
    return Response.json({
      window: "Last 24 hours",
      summary: {
        total: Number(summary?.total || 0),
        completed: Number(summary?.completed || 0),
        waiting: Number(summary?.waiting || 0),
        serving: Number(summary?.serving || 0),
        averageMinutes: Math.round(Number(summary?.averageDuration || 0) / 60000),
      },
      locations: locationRows.results,
      services: serviceRows.results,
      feedback: { responses: Number(feedbackSummary?.responses || 0), averageRating: Number(Number(feedbackSummary?.averageRating || 0).toFixed(1)), positive: Number(feedbackSummary?.positive || 0), issues: issueRows.results },
    });
  }
  const result = await db.prepare("SELECT code, service, subtype, location, documents_confirmed AS documentsConfirmed, status, queue_number AS queueNumber, service_counter AS serviceCounter, created_at AS createdAt FROM visits ORDER BY created_at DESC LIMIT 50").all();
  return Response.json({ visits: result.results });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "JSON request required" }, { status: 415 });
  const payload = await request.json() as VisitInput;
  const service = clean(payload.service, 30);
  const subtype = clean(payload.subtype);
  const location = clean(payload.location);
  const documents = Math.max(0, Math.min(20, Number(payload.documentsConfirmed) || 0));
  if (!service || !subtype || !location) return Response.json({ error: "Missing visit details" }, { status: 400 });
  if (!allowedTransactions[service]?.includes(subtype)) return Response.json({ error: "Transaction does not match the selected service" }, { status: 400 });
  if (documents < 4 || payload.transactionConfirmed !== true) return Response.json({ error: "Complete all document and transaction checks before creating a pass" }, { status: 422 });
  const id = crypto.randomUUID();
  const code = makeCode(service);
  const now = Date.now();
  await getD1().prepare("INSERT INTO visits (id, code, service, subtype, location, documents_confirmed, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ready', ?, ?)").bind(id, code, service, subtype, location, documents, now, now).run();
  return Response.json({ visit: { code, service, subtype, location, documentsConfirmed: documents, status: "ready" } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const payload = await request.json() as VisitInput;
  const code = clean(payload.code, 30).toUpperCase();
  const action = clean(payload.action, 20) || "checkin";
  const counter = clean(payload.counter, 20);
  if (!code) return Response.json({ error: "Code required" }, { status: 400 });
  if (["call", "complete"].includes(action) && !hasOperationsAccess(request)) return operationsDenied();
  const db = getD1();
  const existing = await db.prepare("SELECT code, status, queue_number AS queueNumber FROM visits WHERE code = ? LIMIT 1").bind(code).first<{code:string,status:string,queueNumber:string|null}>();
  if (!existing) return Response.json({ error: "Pass not found" }, { status: 404 });
  if (action === "call") {
    if (!counter || existing.status !== "checked_in") return Response.json({ error: "Customer must be checked in and a counter is required" }, { status: 400 });
    await db.prepare("UPDATE visits SET status = 'called', service_counter = ?, updated_at = ? WHERE code = ?").bind(counter, Date.now(), code).run();
    return Response.json({ visit: { code, status: "called", queueNumber: existing.queueNumber, serviceCounter: counter } });
  }
  if (action === "complete") {
    if (existing.status !== "called") return Response.json({ error: "Customer must be called before completion" }, { status: 409 });
    await db.prepare("UPDATE visits SET status = 'complete', updated_at = ? WHERE code = ?").bind(Date.now(), code).run();
    return Response.json({ visit: { code, status: "complete", queueNumber: existing.queueNumber } });
  }
  if (action !== "checkin") return Response.json({ error: "Invalid action" }, { status: 400 });
  if (!["ready", "checked_in"].includes(existing.status)) return Response.json({ error: "This pass cannot be checked in again" }, { status: 409 });
  const queueNumber = existing.status === "ready" ? `A-${String((Date.now() % 900) + 100)}` : null;
  if (!queueNumber) {
    const visit = await db.prepare("SELECT code, status, queue_number AS queueNumber, service_counter AS serviceCounter FROM visits WHERE code = ?").bind(code).first();
    return Response.json({ visit });
  }
  await db.prepare("UPDATE visits SET status = 'checked_in', queue_number = ?, updated_at = ? WHERE code = ?").bind(queueNumber, Date.now(), code).run();
  return Response.json({ visit: { code, status: "checked_in", queueNumber } });
}
