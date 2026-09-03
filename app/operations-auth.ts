import { env } from "cloudflare:workers";

const USER_ID_HEADER = "oai-authenticated-user-id";

export function hasOperationsAccess(request: Request): boolean {
  const userId = request.headers.get(USER_ID_HEADER)?.trim();
  const configured = (env as unknown as Record<string, unknown>).OPERATIONS_USER_IDS;
  const allowedIds = typeof configured === "string"
    ? configured.split(",").map((value) => value.trim()).filter(Boolean)
    : [];

  return Boolean(userId && allowedIds.includes(userId));
}

export function operationsDenied() {
  return Response.json(
    { error: "Authorized DMV operations access required" },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}
