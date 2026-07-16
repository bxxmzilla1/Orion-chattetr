import { isAdmin, unauthorized } from "../../../lib/auth.js";
import { getAppSetting, setAppSetting } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    const persona = await getAppSetting("persona", "");
    const girlName = await getAppSetting("girl_name", "Orion");
    return Response.json({ persona, girlName });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.persona === "string") {
      await setAppSetting("persona", body.persona);
    }
    if (typeof body.girlName === "string") {
      await setAppSetting("girl_name", body.girlName.trim() || "Orion");
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
