const test = require('node:test');
const assert = require('node:assert');
const { CanvasEngine } = require('../src/apps/CanvasEngine.js');
const { OnDeviceAI } = require('../src/ai/OnDeviceAI.js');
const { StageController, StageRoles } = require('../src/media/StageController.js');

test('CANVAS-01: Vector Stroke Recording, Undo & State Serialization', () => {
  const canvas = new CanvasEngine();
  
  canvas.startStroke(10, 20, '#007aff', 4);
  canvas.drawPoint(15, 25);
  canvas.drawPoint(20, 30);
  canvas.endStroke();

  assert.strictEqual(canvas.strokes.length, 1);
  assert.strictEqual(canvas.strokes[0].points.length, 3);
  assert.strictEqual(canvas.strokes[0].color, '#007aff');

  // Second stroke
  canvas.startStroke(50, 50, '#ff3b30', 2);
  canvas.drawPoint(60, 60);
  canvas.endStroke();
  assert.strictEqual(canvas.strokes.length, 2);

  // Undo
  canvas.undo();
  assert.strictEqual(canvas.strokes.length, 1);

  // Export / Import
  const exported = canvas.exportData();
  const canvas2 = new CanvasEngine();
  canvas2.importData(exported);
  assert.strictEqual(canvas2.strokes.length, 1);
  assert.strictEqual(canvas2.strokes[0].points[0].x, 10);
});

test('AI-01: On-Device "Catch Me Up" Thread Summarizer & Action Extraction', async () => {
  const ai = new OnDeviceAI();
  const messages = [
    { sender: 'Alice', text: 'Hey team, let us review the V3 launch plan today.' },
    { sender: 'Bob', text: 'I will verify the TreeKEM RFC 9420 test suite this afternoon.' },
    { sender: 'Charlie', text: 'Action: deploy the WebAuthn PRF vault to staging.' },
    { sender: 'Alice', text: 'Great progress everyone! Let us make sure zero IP leaks occur.' }
  ];

  const result = await ai.summarizeThread(messages);

  assert.strictEqual(result.messageCount, 4);
  assert.ok(result.participants.includes('Alice'));
  assert.ok(result.participants.includes('Bob'));
  assert.ok(result.participants.includes('Charlie'));
  assert.ok(result.actionItems.length >= 2, 'Identified action items from Bob and Charlie');
  assert.ok(result.summary.includes('Catch-Up Summary'), 'Summary header included');
});

test('AI-02: Local Semantic Concept Search via Cosine Similarity', () => {
  const ai = new OnDeviceAI();
  const documents = [
    { id: '1', text: 'Hardware passkey master keys with WebAuthn PRF' },
    { id: '2', text: 'WebRTC video calling and STUN reflexive candidates' },
    { id: '3', text: 'IETF TreeKEM group encryption protocol RFC 9420' }
  ];

  const results = ai.searchSemantic('hardware passkey', documents);
  assert.ok(results.length > 0);
  assert.strictEqual(results[0].document.id, '1', 'Document 1 ranked highest for hardware passkey');
});

test('STAGE-01: Voice Stage Roles, Hand Raising & Speaker Ducking', () => {
  const stage = new StageController('stage_townhall', 'user_host');

  // Join audience
  stage.joinStage('user_audience1');
  assert.strictEqual(stage.participants.get('user_audience1').role, StageRoles.AUDIENCE);

  // Raise hand
  stage.raiseHand('user_audience1');
  assert.strictEqual(stage.participants.get('user_audience1').role, StageRoles.HAND_RAISED);

  // Host promotes to speaker at stage position X = -0.5
  stage.promoteToSpeaker('user_audience1', -0.5);
  assert.strictEqual(stage.participants.get('user_audience1').role, StageRoles.SPEAKER);
  assert.strictEqual(stage.participants.get('user_audience1').position.x, -0.5);

  // Speaking state ducking trigger
  stage.setSpeakingState('user_host', true);
  assert.strictEqual(stage.activeSpeakerId, 'user_host');

  stage.setSpeakingState('user_host', false);
  assert.strictEqual(stage.activeSpeakerId, null);
});
