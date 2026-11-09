#!/usr/bin/env node
// ════════════════════════════════════════════════
//  ZYNTRIXLY 2.0 — scripts/validate_setup.js
//  Automated Pre-Flight Self-Hosting Setup Validator
// ════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

console.log('\n===============================================================');
console.log('   🛡️  ZYNTRIXLY 2.0 SELF-HOSTING PRE-FLIGHT VALIDATOR        ');
console.log('===============================================================\n');

let issues = 0;
let warnings = 0;

function check(label, fn) {
  try {
    const res = fn();
    if (res === true || res === undefined) {
      console.log(`  ✅ [PASS] ${label}`);
    } else if (res.warning) {
      warnings++;
      console.log(`  ⚠️  [WARN] ${label}: ${res.warning}`);
    } else if (res.error) {
      issues++;
      console.log(`  ❌ [FAIL] ${label}: ${res.error}`);
    }
  } catch (err) {
    issues++;
    console.log(`  ❌ [FAIL] ${label}: ${err.message}`);
  }
}

// 1. Files & Directory Structure
console.log('1. Repository Structure & Core Modules:');
const requiredFiles = [
  'index.html', 'app.js', 'crypto.js', 'webrtc.js', 'security.js',
  'style.css', 'firestore.rules', 'manifest.webmanifest', 'sw.js'
];
for (const file of requiredFiles) {
  check(`Core file: ${file}`, () => {
    if (!fs.existsSync(file)) return { error: `Missing required file: ${file}` };
  });
}

// 2. Firestore Security Rules
console.log('\n2. Security & Cryptographic Foundation:');
check('Hardened Firestore Security Rules', () => {
  const content = fs.readFileSync('firestore.rules', 'utf8');
  if (content.includes('{sub=**}')) {
    return { error: 'Found insecure wildcard rule {sub=**} in firestore.rules' };
  }
  if (!content.includes('match /calls/{callId}')) {
    return { error: 'Missing /calls/{callId} signaling rules' };
  }
  if (!content.includes('match /keyBackups/{backupId}')) {
    return { error: 'Missing private keyBackups isolation rules' };
  }
  if (!content.includes('match /publicProfile/{docId}')) {
    return { error: 'Missing publicProfile separation rules' };
  }
});

check('WebCrypto Environment Verification', () => {
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    return { error: 'WebCrypto subtle is not available in current Node runtime' };
  }
});

// 3. Configuration & Secrets
console.log('\n3. Firebase Configuration & Deployment Readiness:');
check('Firebase Configuration', () => {
  const hasConfigFile = fs.existsSync('firebase-config.js');
  const hasEnvVars = !!(process.env.FIREBASE_API_KEY && process.env.FIREBASE_PROJECT_ID);

  if (!hasConfigFile && !hasEnvVars) {
    return {
      warning: 'Neither firebase-config.js nor environment variables found. Fill in firebase-config.example.js or set env vars before launching.'
    };
  }
});

check('PWA Web Manifest & Application Icons', () => {
  if (!fs.existsSync('manifest.webmanifest')) return { error: 'Missing manifest.webmanifest' };
  if (!fs.existsSync('assets/zyntrixly-logo.svg') && !fs.existsSync('zyntrixly-logo.svg')) {
    return { error: 'Missing primary vector logo SVG' };
  }
});

console.log('\n===============================================================');
if (issues === 0 && warnings === 0) {
  console.log('🎉 ALL PRE-FLIGHT CHECKS PASSED — READY FOR 2.0 DEPLOYMENT! ✅');
  process.exit(0);
} else if (issues === 0) {
  console.log(`⚠️  PASSED WITH ${warnings} NON-BLOCKING WARNING(S).`);
  process.exit(0);
} else {
  console.log(`❌ FAILED WITH ${issues} CRITICAL ISSUE(S). Please resolve before deploying.`);
  process.exit(1);
}
