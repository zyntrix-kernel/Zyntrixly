// ════════════════════════════════════════════════
//  ZYNTRIXLY — src/security/sanitizer.js
//  Universal Strict DOM & Text Sanitizer
// ════════════════════════════════════════════════

const ZxSanitizer = (() => {
  const ESC_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  /**
   * Fast HTML entity escaping for plain strings
   * @param {string} str 
   * @returns {string}
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, c => ESC_MAP[c]);
  }

  /**
   * Sanitizes reaction keys to ensure only valid emojis or known codes pass
   * @param {string} rawKey 
   * @param {Record<string, string>} knownKeyMap 
   * @returns {string}
   */
  function sanitizeReactionKey(rawKey, knownKeyMap = {}) {
    if (typeof rawKey !== 'string') return '👍';
    if (knownKeyMap[rawKey]) return knownKeyMap[rawKey];
    // Check if the string consists solely of emoji characters
    // Using Unicode property escapes for emojis and pictographs
    const emojiRegex = /^[\p{Emoji}\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u;
    if (emojiRegex.test(rawKey.trim())) {
      return rawKey.trim();
    }
    // Return escaped string or fallback
    return '👍';
  }

  /**
   * Strict URL validator: only allows http, https, mailto, and safe blob URLs
   * @param {string} url 
   * @returns {boolean}
   */
  function isSafeUrl(url) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:text/html') || trimmed.startsWith('vbscript:')) {
      return false;
    }
    return (
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('blob:')
    );
  }

  /**
   * Deeply sanitizes an HTML fragment, stripping all scripts, styles, iframes, and handlers
   * @param {string} html 
   * @returns {string}
   */
  function sanitizeHtml(html) {
    if (typeof html !== 'string') return '';
    if (typeof document === 'undefined') {
      // In non-DOM (Node.js test) environment, fallback to complete HTML entity escaping
      return escapeHtml(html);
    }

    const template = document.createElement('template');
    template.innerHTML = html;
    const docFrag = template.content;

    const ALLOWED_TAGS = new Set([
      'b', 'strong', 'i', 'em', 'u', 's', 'span', 'p', 'br',
      'code', 'pre', 'blockquote', 'a', 'ul', 'ol', 'li'
    ]);
    const ALLOWED_ATTRS = new Set(['href', 'title', 'class', 'target', 'rel']);

    function cleanNode(node) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === 3) {
          // Text node — safe
          continue;
        }
        if (child.nodeType === 1) {
          // Element node
          const tagName = child.tagName.toLowerCase();
          if (!ALLOWED_TAGS.has(tagName)) {
            // Strip tag but keep text content
            const textNode = document.createTextNode(child.textContent || '');
            node.replaceChild(textNode, child);
            continue;
          }

          // Strip disallowed attributes or event handlers
          const attrs = Array.from(child.attributes);
          for (const attr of attrs) {
            const attrName = attr.name.toLowerCase();
            if (attrName.startsWith('on') || !ALLOWED_ATTRS.has(attrName)) {
              child.removeAttribute(attr.name);
            } else if (attrName === 'href' && !isSafeUrl(attr.value)) {
              child.removeAttribute('href');
            }
          }

          if (tagName === 'a') {
            child.setAttribute('rel', 'noopener noreferrer');
          }

          cleanNode(child);
        } else {
          // Strip comments or other node types
          node.removeChild(child);
        }
      }
    }

    cleanNode(docFrag);
    const div = document.createElement('div');
    div.appendChild(docFrag.cloneNode(true));
    return div.innerHTML;
  }

  return {
    escapeHtml,
    sanitizeReactionKey,
    isSafeUrl,
    sanitizeHtml
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZxSanitizer;
}
if (typeof window !== 'undefined') {
  window.ZxSanitizer = ZxSanitizer;
}
