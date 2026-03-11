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
  // Path: /subjects or /subjects/:id
  const subjectId = segments.length >= 3 ? segments[2] : null;

  try {
    // GET /subjects - list all
    if (req.method === "GET" && !subjectId) {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ subjects: data });
    }

    // GET /subjects/:id
    if (req.method === "GET" && subjectId) {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("id", subjectId)
        .single();

      if (error) return errorResponse("Subject not found", 404);
      return jsonResponse({ subject: data });
    }

    // POST /subjects - create
    if (req.method === "POST") {
      const body = await req.json();
      if (!body.name) return errorResponse("name is required");

      const { data, error } = await supabase
        .from("subjects")
        .insert({
          name: body.name,
          color: body.color || "#6366f1",
          icon: body.icon || "📘",
        })
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ subject: data }, 201);
    }

    // PUT /subjects/:id - update
    if (req.method === "PUT" && subjectId) {
      const body = await req.json();
      const updates: Record<string, string> = {};
      if (body.name) updates.name = body.name;
      if (body.color) updates.color = body.color;
      if (body.icon) updates.icon = body.icon;

      const { data, error } = await supabase
        .from("subjects")
        .update(updates)
        .eq("id", subjectId)
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ subject: data });
    }

    // DELETE /subjects/:id
    if (req.method === "DELETE" && subjectId) {
      const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", subjectId);

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ deleted: true });
    }

    return errorResponse("Method not allowed", 405);
  } catch (err) {
    return errorResponse(`Internal error: ${err.message}`, 500);
  }
});
