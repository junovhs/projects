export function requireBearerAuth(req, res) {
  const PASSWORD = process.env.AI_API_PASSWORD;
  if (!PASSWORD) {
    console.error('AI_API_PASSWORD is not set');
    res.status(500).json({ error: 'Server misconfigured: AI_API_PASSWORD missing' });
    return false;
  }

  const auth = req.headers.authorization || '';
  const [scheme, token] = auth.split(' ');

  if (scheme !== 'Bearer' || !token || token !== PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="AI API", error="invalid_token"');
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}