import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, apikey, Content-Type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    status,
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const params = url.searchParams;
  const segments = url.pathname.split("/").filter(Boolean);
  // /sessions/start, /sessions/stop, /sessions/active, /sessions/:id
  const action = segments.length >= 3 ? segments[2] : null;

  try {
    // POST /sessions/start - start a new study session
    if (req.method === "POST" && action === "start") {
      const body = await req.json();
      if (!body.subject_id) return errorResponse("subject_id is required");

      // Check for already-active session
      const { data: active } = await supabase
        .from("study_sessions")
        .select("id, subject_id")
        .is("ended_at", null)
        .limit(1);

      if (active && active.length > 0) {
        return errorResponse(
          "A session is already active. Stop it before starting a new one.",
          409
        );
      }

      const { data, error } = await supabase
        .from("study_sessions")
        .insert({
          subject_id: body.subject_id,
          notes: body.notes || null,
        })
        .select("*, subjects(name, icon, color)")
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ session: data, message: "Study session started!" }, 201);
    }

    // POST /sessions/stop - stop the active session
    if (req.method === "POST" && action === "stop") {
      const { data: active, error: findErr } = await supabase
        .from("study_sessions")
        .select("*")
        .is("ended_at", null)
        .limit(1)
        .single();

      if (findErr || !active) {
        return errorResponse("No active session to stop", 404);
      }

      const body = await req.json().catch(() => ({}));

      const { data, error } = await supabase
        .from("study_sessions")
        .update({
          ended_at: new Date().toISOString(),
          notes: body.notes || active.notes,
        })
        .eq("id", active.id)
        .select("*, subjects(name, icon, color)")
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ session: data, message: "Study session ended!" });
    }

    // GET /sessions/active - get current active session
    if (req.method === "GET" && action === "active") {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("*, subjects(name, icon, color)")
        .is("ended_at", null)
        .limit(1)
        .maybeSingle();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ active_session: data });
    }

    // GET /sessions - list sessions with optional filters
    if (req.method === "GET" && !action) {
      let query = supabase
        .from("study_sessions")
        .select("*, subjects(name, icon, color)")
        .order("started_at", { ascending: false });

      const subjectId = params.get("subject_id");
      if (subjectId) query = query.eq("subject_id", subjectId);

      const limit = parseInt(params.get("limit") || "20");
      query = query.limit(limit);

      const { data, error } = await query;
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ sessions: data, count: data.length });
    }

    // DELETE /sessions/:id
    if (req.method === "DELETE" && action) {
      const { error } = await supabase
        .from("study_sessions")
        .delete()
        .eq("id", action);

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ deleted: true });
    }

    return errorResponse("Method not allowed", 405);
  } catch (err) {
    return errorResponse(`Internal error: ${err.message}`, 500);
  }
});
