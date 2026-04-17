// ════════════════════════════════════════════════
//  ZYNTRIXLY — firebase-config.example.js
//  ⚠️  SAFE TEMPLATE — DO NOT put real keys here.
//  Copy this to firebase-config.js and fill in your
//  own values. firebase-config.js is in .gitignore.
// ════════════════════════════════════════════════
//
//  How to get these values:
//  1. Go to https://console.firebase.google.com
//  2. Select your project → Project Settings → General
//  3. Under "Your apps" → Web app → SDK setup and config
//
const firebaseConfig = {
  apiKey:            "YOUR_FIREBASE_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

db.enablePersistence({synchronizeTabs:true}).catch(err=>{
  console.warn('Firestore persistence unavailable:',err?.code||err);
});
