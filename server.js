const http = require('http');
const fetch = require('node-fetch');

const SUPABASE_URL = "https://ydstcrzeiaagfstjnuqj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc3RjcnplaWFhZ2ZzdGpudXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDc2NDMsImV4cCI6MjA4Nzc4MzY0M30.Yee_OgnqfF42CGW4mRRuX2dWFumzhClKY2qs7fXBWb4";

const server = http.createServer(async (req, res) => {

  try {

    const response = await fetch(`${SUPABASE_URL}/functions/v1/hello`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY
      }
    });

    const text = await response.text();

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("SUPABASE RESPONSE:\n" + text);

  } catch (error) {

    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("FETCH ERROR:\n" + error.message);

  }

});

server.listen(3000);