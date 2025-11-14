// projects/api/_lib/auth.js

/**
 * Enforces bearer token authentication for a Vercel serverless function request.
 * Reads the required password from the AI_API_PASSWORD environment variable.
 * Sends a 401 Unauthorized or 500 Server Misconfigured response if auth fails.
 *
 * @param {import('@vercel/node').VercelRequest} req - The request object.
 * @param {import('@vercel/node').VercelResponse} res - The response object.
 * @returns {boolean} `true` if authentication is successful, `false` otherwise.
 */
export function requireBearerAuth(req, res) {
  const PASSWORD = process.env.AI_API_PASSWORD;
  if (!PASSWORD) {
    console.error('CRITICAL: AI_API_PASSWORD environment variable is not set.');
    res.status(500).json({ error: 'Server misconfigured: Auth secret is missing.' });
    return false;
  }

  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token || token !== PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Protected API", error="invalid_token"');
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}