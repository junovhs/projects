// projects/api/assets/discover.js

// This file contains temporary, minimal code for the sole purpose of
// diagnosing and fixing the CORS preflight issue.

export default async function handler(req, res) {
  // --- The Definitive CORS Fix ---
  // These headers are the ONLY thing required to pass the browser's preflight check.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // When the browser sends the OPTIONS preflight request,
  // we respond immediately with a 204 No Content status.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // --- Original Logic (only runs for POST requests) ---
  if (req.method === 'POST') {
    // For this diagnostic, we will return a simple success message
    // instead of running the full discoverAssets logic. This proves
    // the CORS barrier has been passed.
    return res.status(200).json({
      ok: true,
      message: "CORS OK: The request was received successfully.",
      assets: [],
      counts: {}
    });
  }

  // For any other method, return Method Not Allowed.
  res.setHeader('Allow', ['POST', 'OPTIONS']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}