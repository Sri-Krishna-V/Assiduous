require('dotenv').config();
const http = require('http');
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PORT = process.env.PORT || 3000;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

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

    console.error('Fetch error:', error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("FETCH ERROR:\n" + error.message);

  }

});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});