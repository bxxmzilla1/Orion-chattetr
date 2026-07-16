// Admin passcode check for owner-only API routes.
export function isAdmin(request) {
  const pass = process.env.ADMIN_PASSCODE;
  if (!pass) return false;
  const header = request.headers.get("x-admin-pass") || "";
  return header === pass;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
