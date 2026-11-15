const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function section(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return app.slice(start, end);
}

test('QOL-01: DM encryption fails closed when the recipient key is unavailable', () => {
  const source = section('async function sendDMMsg(', 'async function sendGrpMsg(');
  assert.match(source, /Recipient encryption key is unavailable/);
  assert.doesNotMatch(source, /Crypto\.generateKeyPair\(\)/);
  assert.match(source, /if\(!recipient\?\.publicKey\)/);
});

test('QOL-02: Failed message sends restore a draft and never claim local delivery', () => {
  const source = section('async function sendMsg(', 'async function sendDMMsg(');
  assert.match(source, /Message not sent\. Your draft was restored/);
  assert.match(source, /saveDraftText\(sendContext\.type,sendContext\.id,restoredText\)/);
  assert.doesNotMatch(source, /Message sent locally/);
  assert.doesNotMatch(source, /Just now \(Local\)/);
});

test('QOL-03: Spaces composer does not pretend a local-only row was delivered', () => {
  const source = section('async function sendMsg(', 'async function sendDMMsg(');
  const start = source.indexOf('if(activeChannel)');
  assert.notEqual(start, -1);
  const channelBranch = source.slice(start, source.indexOf('// 2. Direct Message or Group', start));
  assert.match(channelBranch, /Channel messaging is not available yet/);
  assert.doesNotMatch(channelBranch, /Message sent to #/);
  assert.doesNotMatch(channelBranch, /appendChild\(row\)/);
});

test('QOL-04: User discovery never returns fabricated demo accounts', () => {
  const source = section('async function searchDM(', 'async function searchGrp(');
  assert.doesNotMatch(source, /demo_(alice|bob|charlie)/);
  assert.match(source, /Could not search users/);
  assert.match(source, /No users found/);
});

test('QOL-05: Catch-up AI never manufactures messages for an empty conversation', () => {
  const source = section('async function triggerCatchUpAI(', 'function closeAiSummary(');
  assert.match(source, /There are no messages to summarize/);
  assert.doesNotMatch(source, /sender:\s*['"]Tanay['"]/);
  assert.doesNotMatch(source, /Zyntrixly 3\.0 Apex is live/);
});
