# 🛡️ Zyntrixly 2.0 — Production Self-Hosting & Deployment Guide

This guide details how to self-host Zyntrixly 2.0 with zero external platform dependencies beyond your database.

---

## 🚀 Option 1: Docker Self-Hosting (Recommended)

Run Zyntrixly with Docker and Caddy web server with automatic HTTPS and hardened security headers:

```bash
# 1. Clone repository
git clone https://github.com/zyntrix-kernel/Zyntrixly.git
cd Zyntrixly

# 2. Verify setup & configuration
npm run setup:check

# 3. Build & start container
docker-compose up -d --build
```

Access Zyntrixly locally at `http://localhost:8080`.

---

## ⚡ Option 2: Static Cloud Hosting (Vercel / Firebase Hosting / Netlify)

1. Deploy the repository to your provider.
2. In your deployment dashboard, configure environment variables:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
3. Publish production Firestore rules:
   - Copy rules from `firestore.rules` and paste into Firebase Console.

---

## 🔒 Security Hardening Checklist

Before exposing to production:

- [ ] **Publish `firestore.rules`:** Enforce DM immutability, call signaling authorization, and private data isolation.
- [ ] **Restrict Firebase API Key:** Under Google Cloud Console Credentials, restrict your API key to your specific domain (e.g. `https://chat.yourdomain.com/*`).
- [ ] **Enable CSP Headers:** The bundled `Caddyfile` sets strict Content Security Policy, X-Frame-Options, and HSTS headers.
- [ ] **Run Validator:** Execute `npm run setup:check` to verify configuration integrity before publishing.
