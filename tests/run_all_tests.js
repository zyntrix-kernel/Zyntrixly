const { spawn } = require('child_process');
const path = require('path');

const testSuites = [
  { name: 'Cryptographic Engine (RSA-OAEP, AES-GCM, PBKDF2)', file: 'tests/crypto.test.js' },
  { name: 'Security & Sanitization (Logger, KeyStore, SessionGuard)', file: 'tests/security.test.js' },
  { name: 'DOM Integrity & Architecture (146 Baseline Element IDs)', file: 'tests/dom_integrity.test.js' },
  { name: 'WebRTC Calling & Media State Machine', file: 'tests/webrtc.test.js' },
  { name: 'Calling Authentication & Timeout Lifecycles', file: 'tests/calling_auth.test.js' },
  { name: 'Full E2E Browser Features (Puppeteer Headless Chrome)', file: 'tests/e2e_features.test.js' }
];

console.log('===============================================================');
console.log('   🛡️  ZYNTRIXLY COMPREHENSIVE TEST SUITE EXECUTION           ');
console.log('===============================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const results = [];

async function runSuite(suite) {
  return new Promise((resolve) => {
    const start = Date.now();
    const proc = spawn('node', ['--test', suite.file], {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('error', (err) => {
      const duration = Date.now() - start;
      totalFailed += 1;
      results.push({
        name: suite.name,
        passed: 0,
        failed: 1,
        duration: duration + 'ms',
        status: 'FAIL ❌'
      });
      console.error(`[${suite.name}] Failed to spawn process:`, err);
      resolve();
    });

    proc.on('close', (code) => {
      const duration = Date.now() - start;
      const passMatch = stdout.match(/ℹ pass (\d+)/);
      const failMatch = stdout.match(/ℹ fail (\d+)/);
      const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
      const failed = failMatch ? parseInt(failMatch[1], 10) : (code !== 0 ? 1 : 0);

      totalPassed += passed;
      totalFailed += failed;

      results.push({
        name: suite.name,
        passed,
        failed,
        duration: duration + 'ms',
        status: code === 0 && failed === 0 ? 'PASS ✅' : 'FAIL ❌'
      });

      console.log(`[${suite.name}]`);
      console.log(`  Status: ${code === 0 && failed === 0 ? 'PASSED ✅' : 'FAILED ❌'} (${passed} passed, ${failed} failed in ${duration}ms)`);
      if (failed > 0 || code !== 0) {
        console.error('  Errors:\n', stdout, stderr);
      }
      console.log('');
      resolve();
    });
  });
}

(async () => {
  const overallStart = Date.now();
  for (const suite of testSuites) {
    await runSuite(suite);
  }

  const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(2);

  console.log('===============================================================');
  console.log('                      TEST SUMMARY REPORT                      ');
  console.log('===============================================================');
  console.table(results);
  console.log(`Total Passed: ${totalPassed}`);
  console.log(`Total Failed: ${totalFailed}`);
  console.log(`Total Execution Time: ${overallDuration}s`);
  console.log('===============================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL COMPREHENSIVE TESTS PASSED WITH 100% SUCCESS RATE!\n');
    process.exit(0);
  }
})();
