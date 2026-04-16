// ════════════════════════════════════════════════
//  ZYNTRIXLY — api/config.js (Vercel Serverless)
//  Serves Firebase config from environment variables.
//  This keeps ALL secrets out of the public repo.
//
//  Set these in Vercel Dashboard → Project Settings → Environment Variables:
//    FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
//    FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID
// ════════════════════════════════════════════════

export default function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic validation — reject if critical vars are missing
  const required = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_APP_ID'
  ];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing env var: ${key}`);
      return res.status(500).json({ error: 'Server configuration error' });
    }
  }

  // Cache for 5 minutes — safe for public config values
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json({
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId:             process.env.FIREBASE_APP_ID
  });
}
