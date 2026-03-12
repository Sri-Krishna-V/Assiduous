import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
  const segments = url.pathname.split("/").filter(Boolean);
  const goalId = segments.length >= 3 ? segments[2] : null;

  try {
    // GET /goals - list all goals with subject info
    if (req.method === "GET" && !goalId) {
      const { data, error } = await supabase
        .from("goals")
        .select("*, subjects(name, icon, color)")
        .order("created_at", { ascending: true });

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ goals: data });
    }

    // GET /goals/:id
    if (req.method === "GET" && goalId) {
      const { data, error } = await supabase
        .from("goals")
        .select("*, subjects(name, icon, color)")
        .eq("id", goalId)
        .single();

      if (error) return errorResponse("Goal not found", 404);
      return jsonResponse({ goal: data });
    }

    // POST /goals - create or upsert a goal
    if (req.method === "POST") {
      const body = await req.json();
      if (!body.subject_id) return errorResponse("subject_id is required");
      if (!body.target_minutes_per_week || body.target_minutes_per_week < 1) {
        return errorResponse("target_minutes_per_week must be a positive number");
      }

      const { data, error } = await supabase
        .from("goals")
        .upsert(
          {
            subject_id: body.subject_id,
            target_minutes_per_week: body.target_minutes_per_week,
          },
          { onConflict: "subject_id" }
        )
        .select("*, subjects(name, icon, color)")
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ goal: data }, 201);
    }

    // PUT /goals/:id - update target
    if (req.method === "PUT" && goalId) {
      const body = await req.json();
      const updates: Record<string, number> = {};
      if (body.target_minutes_per_week) {
        updates.target_minutes_per_week = body.target_minutes_per_week;
      }

      const { data, error } = await supabase
        .from("goals")
        .update(updates)
        .eq("id", goalId)
        .select("*, subjects(name, icon, color)")
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ goal: data });
    }

    // DELETE /goals/:id
    if (req.method === "DELETE" && goalId) {
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", goalId);

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ deleted: true });
    }

    return errorResponse("Method not allowed", 405);
  } catch (err) {
    return errorResponse(`Internal error: ${err.message}`, 500);
  }
});
