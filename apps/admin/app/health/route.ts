export function GET() {
  return Response.json({
    ok: true,
    service: "admin",
    timestamp: new Date().toISOString(),
  });
}
