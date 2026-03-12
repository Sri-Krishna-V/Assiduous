const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 405
      }
    );
  }

  return new Response(
    JSON.stringify({ message: "I am an Assiduous Edge Function!" }),
    {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200
    }
  );
});