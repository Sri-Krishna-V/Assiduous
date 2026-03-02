Deno.serve(async (req) => {
  return new Response(
    JSON.stringify({ message: "Hello from Supabase Edge Function!" }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200
    }
  );
});