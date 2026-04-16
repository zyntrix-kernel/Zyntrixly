# Zyntrixly
An Private and open source messaging app.

## APK / Offline Packaging

Startup-critical third-party assets are vendored locally so the app can be wrapped more reliably in an APK:

- Firebase compat scripts live in `vendor/firebase/`
- App fonts live in `vendor/fonts/`
- PWA manifest lives in `manifest.webmanifest`
- Offline service worker lives in `sw.js`
- Firestore rules to paste into Firebase live in `firestore.rules`

This removes the previous dependency on Google CDN files during app startup.
