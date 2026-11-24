/* ═════════════════════════════════════════════════════════════════════
   ZYNTRIXLY 10 — AI CONCIERGE (on-device only)
   A private intelligence drawer wired to src/ai/OnDeviceAI.js:
   - "Catch me up": local extractive summary + action items of the open thread
   - Semantic search: local TF-IDF cosine search over the decrypted thread
   Strict privacy: the model input never leaves this tab; the badge states it.
   Exposes: window.ZxConcierge
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let root = null;

  function getAI() {
    if (typeof ZxAIInstance !== 'undefined' && ZxAIInstance) return ZxAIInstance;
    if (typeof OnDeviceAI !== 'undefined') return new OnDeviceAI();
    return null;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ── Thread reading (already decrypted in the DOM) ──────────── */
  function readThread() {
    const rows = document.querySelectorAll('#msgs-wrap .msg-row');
    const msgs = [];
    rows.forEach(row => {
      const bub = row.querySelector('.bubble');
      if (!bub) return;
      const text = (bub.textContent || '').trim();
      if (!text || text === '…' || text === 'This message was deleted') return;
      const mine = row.classList.contains('mine');
      let sender = 'You';
      if (!mine) {
        const sn = row.querySelector('.msg-sender span');
        sender = sn ? sn.textContent.replace('@', '') : 'Them';
      }
      const ts = parseInt(row.dataset.sentAt || '0', 10);
      msgs.push({ sender, text, timestamp: ts });
    });
    return msgs;
  }

  function threadTitle() {
    const el = document.querySelector('.chat-hdr-name');
    return el ? el.textContent.trim() : 'this chat';
  }

  /* ── Renderers ─────────────────────────────────────────────── */
  function card(title, bodyHtml) {
    return `<div class="v10-conc-card"><div class="h">${title}</div>${bodyHtml}</div>`;
  }

  function renderSummary(sum) {
    const body = root.querySelector('#v10-conc-summary');
    if (!sum || !sum.messageCount) {
      body.innerHTML = `<div class="v10-conc-empty">Open a conversation first — the Concierge reads only what is already decrypted on this device.</div>`;
      return;
    }
    let html = `<p>${esc(sum.summary || 'Thread read locally.')}</p>`;
    if (sum.actionItems && sum.actionItems.length) {
      html += sum.actionItems.slice(0, 6).map(a => `<div class="bul">${esc(a)}</div>`).join('');
    }
    html += `<p style="margin-top:10px;font-size:11.5px;color:var(--text-subdued)">
      ${sum.messageCount} messages · ${sum.participants.length} participants · computed on this device</p>`;
    body.innerHTML = card('Catch me up', html);
    if (window.ZxMotion) window.ZxMotion.staggerIn([body.firstElementChild]);
  }

  function renderSearch(results) {
    const body = root.querySelector('#v10-conc-results');
    if (!results || !results.length) {
      body.innerHTML = `<div class="v10-conc-empty">No matches in this thread.</div>`;
      return;
    }
    body.innerHTML = card('Semantic matches', results.map(r =>
      `<div class="r"><b>${esc(r.score ? (Math.round(r.score * 100) + '%') : '')}</b><span>${esc((r.text || '').slice(0, 180))}</span></div>`
    ).join(''));
  }

  /* ── Actions ─────────────────────────────────────────────── */
  async function summarize() {
    const body = root.querySelector('#v10-conc-summary');
    body.innerHTML = `<div class="v10-conc-empty">Reading the thread locally...</div>`;
    const ai = getAI();
    const msgs = readThread();
    if (!ai) {
      body.innerHTML = `<div class="v10-conc-empty">OnDeviceAI is not part of this build.</div>`;
      return;
    }
    try {
      const sum = await ai.summarizeThread(msgs);
      renderSummary(sum);
    } catch (e) {
      console.error('[V10 Concierge]', e);
      body.innerHTML = `<div class="v10-conc-empty">Summary failed — see console.</div>`;
    }
  }

  async function search(q) {
    const body = root.querySelector('#v10-conc-results');
    if (!q || q.trim().length < 2) { body.innerHTML = ''; return; }
    const ai = getAI();
    if (!ai) return;
    const msgs = readThread();
    const docs = msgs.map((m, i) => ({ id: i, text: m.text, sender: m.sender }));
    try {
      const res = ai.searchSemantic(q.trim(), docs) || [];
      renderSearch(res.slice(0, 6));
    } catch (e) {
      console.error('[V10 Concierge]', e);
      body.innerHTML = `<div class="v10-conc-empty">Search failed — see console.</div>`;
    }
  }

  /* ── DOM ──────────────────────────────────────────────── */
  function ensureDom() {
    if (root) return;
    root = document.createElement('aside');
    root.className = 'v10-conc';
    root.id = 'v10-conc';
    root.setAttribute('aria-label', 'AI Concierge');
    root.innerHTML = `
      <button class="v10-conc-x" title="Close" aria-label="Close concierge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="v10-conc-head">
        <div class="row">
          <span class="v10-kicker">Concierge</span>
          <span class="v10-conc-badge"><span class="dot"></span>On-device</span>
        </div>
        <div class="sub">Reads only decrypted threads in this tab. Zero bytes leave the device — no API, no relay, no telemetry.</div>
      </div>
      <div class="v10-conc-body">
        <div class="v10-conc-card">
          <div class="h">Semantic search</div>
          <div class="v10-conc-search">
            <input id="v10-conc-q" type="text" placeholder="Meaning, not keywords — &quot;that deadline talk&quot;"/>
            <button class="btn btn-sm btn-default" id="v10-conc-qgo">Find</button>
          </div>
          <div class="v10-conc-res" id="v10-conc-results"></div>
        </div>
        <div id="v10-conc-summary">
          <div class="v10-conc-empty">Open a conversation, then press <b>Catch me up</b>.</div>
        </div>
        <button class="btn btn-outline" id="v10-conc-sum" style="width:100%">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>
          Catch me up on ${'<span id="v10-conc-chat">this chat</span>'}
        </button>
        <div style="margin-top:12px;font-size:11px;color:var(--text-subdued);display:flex;align-items:center;gap:6px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>
          <span id="v10-conc-gpu">Checking local compute (WebGPU)...</span>
        </div>
      </div>`;
    document.body.appendChild(root);

    root.querySelector('.v10-conc-x').addEventListener('click', close);
    root.querySelector('#v10-conc-sum').addEventListener('click', summarize);
    root.querySelector('#v10-conc-qgo').addEventListener('click', () => {
      search(root.querySelector('#v10-conc-q').value);
    });
    root.querySelector('#v10-conc-q').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') search(e.target.value);
    });

    // WebGPU status
    setTimeout(() => {
      const el = root.querySelector('#v10-conc-gpu');
      const ai = getAI();
      if (!el) return;
      if (ai && ai.hasWebGPU) el.textContent = 'WebGPU adapter detected — local compute ready.';
      else el.textContent = 'WebGPU unavailable — heuristic local mode (still zero-network).';
    }, 600);
  }

  function open() {
    ensureDom();
    root.classList.add('open');
    const t = root.querySelector('#v10-conc-chat');
    const title = threadTitle();
    if (t && title) t.textContent = title;
    if (window.ZxMotion) window.ZxMotion.staggerIn(root.querySelectorAll('.v10-conc-card'));
    setTimeout(() => root.querySelector('#v10-conc-q').focus(), 250);
  }

  function close() {
    if (root) root.classList.remove('open');
  }

  function toggle() {
    if (!root || !root.classList.contains('open')) open();
    else close();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root && root.classList.contains('open')) close();
  });

  window.ZxConcierge = { version: '10.0.0', open, close, toggle, summarize };
})();
