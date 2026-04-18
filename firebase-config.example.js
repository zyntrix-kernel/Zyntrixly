// ════════════════════════════════════════════════
//  ZYNTRIXLY — firebase-config.example.js
//  SAFE TEMPLATE — copy to firebase-config.js
//  and fill in your real values for local dev.
//  firebase-config.js is in .gitignore — NEVER commit it.
//  On Vercel, use Environment Variables instead (see GUIDE.md).
// ════════════════════════════════════════════════
window.firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
// The boot loader in index.html reads window.firebaseConfig
// and calls firebase.initializeApp() — do NOT call it here.
