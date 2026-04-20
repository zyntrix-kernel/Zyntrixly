// ════════════════════════════════════════════════
//  ZYNIX — api/config.js
//  Firebase config is now hardcoded in index.html.
//  This endpoint kept for backwards compat but returns
//  the same values so any existing fetch('/api/config')
//  calls continue to work.
// ════════════════════════════════════════════════

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    apiKey:            "AIzaSyADe7-8VV6flXLwRc3pQtVpallWScxbY90",
    authDomain:        "zyntrixly.firebaseapp.com",
    projectId:         "zyntrixly",
    storageBucket:     "zyntrixly.firebasestorage.app",
    messagingSenderId: "663603557838",
    appId:             "1:663603557838:web:634138b6999cf849d5e79f"
  });
}
