import { hasOperationsAccess } from "@/app/operations-auth";

export async function GET(request: Request) {
  return Response.json(
    { allowed: hasOperationsAccess(request) },
    { headers: { "cache-control": "no-store" } },
  );
}
