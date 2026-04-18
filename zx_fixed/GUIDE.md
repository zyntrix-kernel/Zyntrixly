# 🛡️ Zyntrixly — Complete Setup Guide
### Written so simply, anyone can follow it. No experience needed.

---

## 👋 What is this app?

Zyntrixly is a **private messaging app** that runs in your browser. Think of it like WhatsApp, but:

- ✅ No phone number needed — just pick a username
- ✅ No one can read your messages — not even the server
- ✅ Calls are direct device-to-device (no middleman)
- ✅ Files are encrypted before they leave your phone/computer
- ✅ You can host it yourself for free

---

## 🗂️ What's in this folder?

Here's every file and what it does in plain English:

| File | What it does |
|------|-------------|
| `index.html` | The entire app — all the buttons, screens, and layout |
| `app.js` | The brain — handles login, messages, groups, file sharing |
| `crypto.js` | The lock — handles all the encryption math |
| `webrtc.js` | The phone — handles voice and video calls |
| `security.js` | The guard — stops secrets from leaking into browser logs |
| `style.css` | The looks — all the colors, animations, and dark theme |
| `sw.js` | The offline helper — makes the app work without internet |
| `manifest.webmanifest` | Lets the app be installed like a real app on phones |
| `api/config.js` | A tiny server function — safely gives the app your Firebase keys |
| `firebase-config.example.js` | A blank template — you fill this in with your own keys |
| `firebase-config.js` | ⚠️ YOUR real keys go here — **never upload this to GitHub** |
| `firestore.rules` | Database security rules — controls who can read/write data |
| `.gitignore` | Tells GitHub what files to ignore (keeps secrets safe) |
| `GUIDE.md` | This file! |
| `README.md` | The public description shown on your GitHub page |

---

# 🚀 HOW TO SET IT UP — STEP BY STEP

---

## PART 1 — Create your Firebase project (the database)

Firebase is Google's free database service. This is where your messages get stored (encrypted).

### Step 1 — Make a Google account
If you don't have one, go to [accounts.google.com](https://accounts.google.com) and sign up. It's free.

### Step 2 — Go to Firebase
1. Open [console.firebase.google.com](https://console.firebase.google.com)
2. Click the big **"Create a project"** button
3. Type a project name — example: `my-zyntrixly`
4. It asks about Google Analytics — click **"Not right now"** then **Continue**
5. Wait ~30 seconds while it creates your project
6. Click **"Continue"** when it's done

### Step 3 — Turn on the Database (Firestore)
1. In the left menu, click **"Build"** → then **"Firestore Database"**
2. Click **"Create database"**
3. It asks about security rules — click **"Start in production mode"**
4. Pick any location (e.g. `us-central`) — click **"Enable"**
5. Wait ~10 seconds. Done!

### Step 4 — Turn on Login (Authentication)
1. In the left menu click **"Build"** → **"Authentication"**
2. Click **"Get started"**
3. Click **"Email/Password"**
4. Toggle the first switch to **ON**
5. Click **"Save"**

### Step 5 — Get your secret config values
1. Click the ⚙️ gear icon (top left, next to "Project Overview")
2. Click **"Project settings"**
3. Scroll down to **"Your apps"**
4. If you see **"No apps"**, click the **`</>`** (web) icon
5. Type any app nickname — click **"Register app"**
6. You'll see a block of code that looks like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "yourproject.firebaseapp.com",
  projectId: "yourproject",
  storageBucket: "yourproject.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

7. **Copy all of this down somewhere safe** — you'll need it in Part 3

---

## PART 2 — Put the code on GitHub

GitHub is where your code lives. Vercel watches GitHub and automatically deploys your app whenever you make changes.

### Step 1 — Make a GitHub account
Go to [github.com](https://github.com) and sign up (free).

### Step 2 — Create a new repository
1. Click the **"+"** icon (top right) → **"New repository"**
2. Name it `zyntrixly` (or anything you like)
3. Set it to **Public**
4. Do NOT tick "Add a README" — leave everything unchecked
5. Click **"Create repository"**

### Step 3 — Upload your files
#### Upload via browser (easiest, no coding needed)
1. On your new empty repository page, click **"uploading an existing file"**
2. Drag ALL the files from your Zyntrixly folder into the upload box
3. **⚠️ IMPORTANT: Do NOT drag in `firebase-config.js`** — this has your real keys
4. Write a commit message like `"initial upload"`
5. Click **"Commit changes"**

### ✅ Check — your repo should now have all the files EXCEPT `firebase-config.js`

---

## PART 3 — Deploy on Vercel (make it live on the internet)

Vercel hosts your app for free and gives it a real URL like `https://zyntrixly.vercel.app`

### Step 1 — Make a Vercel account
1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** → choose **"Continue with GitHub"**
3. Authorize Vercel to access your GitHub — click **"Authorize"**

### Step 2 — Import your project
1. On the Vercel dashboard, click **"Add New..."** → **"Project"**
2. You'll see your GitHub repositories listed
3. Find `zyntrixly` and click **"Import"**
4. Leave all settings as default
5. **DO NOT click Deploy yet** — you need to add your secrets first

### Step 3 — Add your Firebase keys as Environment Variables
This is the most important step. This is how your app gets your Firebase keys WITHOUT them being in the code.

1. On the import page, scroll down to **"Environment Variables"**
2. Add each one of these, one by one:

| Name (copy exactly) | Value (paste from your Firebase config) |
|---------------------|----------------------------------------|
| `FIREBASE_API_KEY` | The `apiKey` value e.g. `AIzaSyADe7...` |
| `FIREBASE_AUTH_DOMAIN` | The `authDomain` value e.g. `myapp.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | The `projectId` value e.g. `myapp` |
| `FIREBASE_STORAGE_BUCKET` | The `storageBucket` value e.g. `myapp.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | The `messagingSenderId` value e.g. `663603557838` |
| `FIREBASE_APP_ID` | The `appId` value e.g. `1:663603...:web:abc123` |

To add each one:
- Type the **Name** in the left box
- Paste your **Value** in the right box
- Click **"Add"**
- Repeat for all 6

### Step 4 — Deploy!
1. Click the big **"Deploy"** button
2. Wait ~1 minute while Vercel builds your app
3. You'll see confetti 🎉 and a URL like `https://zyntrixly-abc123.vercel.app`
4. Click **"Visit"** — your app is live!

---

## PART 4 — Lock down your Firebase (security)

Your app is live but we need to make sure only your website can use your Firebase keys.

### Step 1 — Restrict your API key
1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Make sure you're in the right project (check the dropdown at the top)
3. Click on your API key (called "Browser key" or "Web API key")
4. Under **"Application restrictions"** → select **"Websites"**
5. Under **"Website restrictions"** → click **"Add an item"**
6. Add your Vercel URL: `https://your-app-name.vercel.app/*`
7. Also add: `http://localhost:*` (for local testing)
8. Click **"Save"**

Now your Firebase key only works on YOUR website. Even if someone sees the key, they can't use it.

### Step 2 — Set Firestore Security Rules
1. Go back to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Firestore Database"** → **"Rules"** tab
3. Delete all the existing text and paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    match /dms/{docId} {
      allow read, write: if request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
    }
    match /dms/{docId}/{sub=**} {
      allow read, write: if request.auth != null;
    }
    match /groups/{docId} {
      allow read, write: if request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
    }
    match /groups/{docId}/{sub=**} {
      allow read, write: if request.auth != null;
    }
    match /calls/{docId} {
      allow read, write: if request.auth != null;
    }
    match /calls/{docId}/{sub=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Click **"Publish"**

---

## PART 5 — Testing it works

1. Open your Vercel URL in a browser
2. You should see the Zyntrixly loading screen
3. Click **"Create Account"** — pick a username and password
4. You're in! Try sending a message or creating a group

### Installing on your phone
1. Open the URL on your phone's browser
2. You should see a banner saying **"Add to Home Screen"**
3. Tap it — the app installs like a real app with its own icon!

---

## 🔄 Making changes after deployment

Since you connected GitHub → Vercel, updates are automatic:

1. Edit any file in your GitHub repository
2. Commit the change
3. Vercel detects it and redeploys in ~1 minute
4. Your live URL updates automatically — no extra steps needed

---

## 🧪 Running locally (on your own computer)

1. Copy `firebase-config.example.js` and rename the copy to `firebase-config.js`
2. Open `firebase-config.js` and replace all the placeholder values with your real Firebase values
3. Open `index.html` directly in Chrome or Firefox
4. The app will load using your local `firebase-config.js` file

> ⚠️ Voice/video calls require HTTPS to work, so use your Vercel URL to test calls.

---

## ❓ Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank white screen | Press F12 → Console tab — look for red error messages |
| "Firebase not configured" | Double-check all 6 env vars are set in Vercel dashboard |
| Can't log in | Make sure Email/Password auth is enabled in Firebase console |
| Messages not sending | Make sure Firestore rules are published (Part 4 Step 2) |
| Calls not connecting | Calls need HTTPS — test on your Vercel URL, not localhost |
| App not updating | Go to Vercel dashboard → find your project → click "Redeploy" |

---

## 🔐 Golden rules — never break these

1. **NEVER upload `firebase-config.js` to GitHub** — it has your real keys inside
2. **ALWAYS set keys as Vercel environment variables** — the app reads them safely from there
3. **NEVER share your Firebase console login** with anyone
4. **ALWAYS keep Firestore rules published** — never leave the database open
5. **The `.gitignore` file protects you** — do not delete it

---

## 📋 All the links you need

| What | Link |
|------|------|
| Firebase Console | [console.firebase.google.com](https://console.firebase.google.com) |
| Google API Keys | [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) |
| GitHub | [github.com](https://github.com) |
| Vercel | [vercel.com](https://vercel.com) |

---

*Follow all 5 parts and your app will be live, secure, and auto-deploying. 🎉*
