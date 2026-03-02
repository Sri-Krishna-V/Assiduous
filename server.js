const http = require('http');

const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc3RjcnplaWFhZ2ZzdGpudXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDc2NDMsImV4cCI6MjA4Nzc4MzY0M30.Yee_OgnqfF42CGW4mRRuX2dWFumzhClKY2qs7fXBWb4";

const server = http.createServer(async (req, res) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/hello`, {
      headers: {
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    res.end("Kubernetes + Supabase Connected: " + data.message);

  } catch (error) {
    res.end("Error connecting to Supabase: " + error.message);
  }
});

server.listen(3000);