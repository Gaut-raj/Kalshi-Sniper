(function () {
  const CARD_ID = "kalshi-sniper-card";
  const REQUEST_DEBOUNCE_MS = 180;
  const MIN_TEXT_LENGTH = 12;
  const MAX_TEXT_LENGTH = 220;

  let hoverTimer = null;
  let lastSignature = "";
  let activeTarget = null;
  let selectionTimer = null;

  document.addEventListener("mouseover", handleMouseOver, true);
  document.addEventListener("mouseout", handleMouseOut, true);
  document.addEventListener("mouseup", handleSelectionChange, true);
  document.addEventListener("keyup", handleSelectionChange, true);
  window.addEventListener("scroll", hideCard, true);

  function handleMouseOver(event) {
    const element = event.target instanceof Element ? event.target : null;
    if (!element) {
      return;
    }

    const context = collectHoverContext(element);
    if (!context) {
      return;
    }

    activeTarget = element;
    requestInsights(element, context);
  }

  function handleMouseOut(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const card = document.getElementById(CARD_ID);
    const relatedTarget = event.relatedTarget instanceof Element ? event.relatedTarget : null;

    if (card && relatedTarget && (card.contains(relatedTarget) || event.target.contains(relatedTarget))) {
      return;
    }

    if (activeTarget && event.target === activeTarget) {
      hideCard();
      activeTarget = null;
      lastSignature = "";
    }
  }

  function handleSelectionChange() {
    window.clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection ? sanitizeText(selection.toString()) : "";

      if (!selectedText) {
        return;
      }

      const range = selection.rangeCount ? selection.getRangeAt(0) : null;
      const node = range?.commonAncestorContainer;
      const anchorElement = node instanceof Element ? node : node?.parentElement;
      if (!anchorElement) {
        return;
      }

      const context = collectHoverContext(anchorElement, selectedText);
      if (!context) {
        return;
      }

      const rect = range.getBoundingClientRect();
      const virtualAnchor = createVirtualAnchor(rect);
      requestInsights(virtualAnchor, context);
    }, 80);
  }

  function collectHoverContext(element, selectedText) {
    const elementText = sanitizeText(element.textContent || "");
    const ancestorTexts = [];
    const row = element.closest("tr");
    const rowText = row ? sanitizeText(row.textContent || "") : "";
    const cellTexts = row
      ? Array.from(row.querySelectorAll("th, td"))
          .map((cell) => sanitizeText(cell.textContent || ""))
          .filter(Boolean)
      : [];

    let current = element.closest("[data-testid], article, section, li, div, button") || element;
    let depth = 0;
    while (current && depth < 4) {
      const text = sanitizeText(current.textContent || "");
      if (text && text !== elementText) {
        ancestorTexts.push(text);
      }
      current = current.parentElement;
      depth += 1;
    }

    const hoverText = element.getAttribute("aria-label") || element.getAttribute("title") || elementText;
    const cleanedHoverText = sanitizeText(hoverText);

    if (!cleanedHoverText && !ancestorTexts.length) {
      return null;
    }

    return {
      hoverText: cleanedHoverText,
      elementText,
      selectedText: sanitizeText(selectedText || ""),
      rowText,
      cellTexts,
      ancestorTexts,
      pageTitle: document.title
    };
  }

  function sanitizeText(value) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (cleaned.length < MIN_TEXT_LENGTH || cleaned.length > MAX_TEXT_LENGTH) {
      return "";
    }

    return cleaned;
  }

  function renderInsights(anchor, result) {
    const { parsedProp, insights } = result;
    const opponentSummary = parsedProp.opponent && insights.opponent
      ? `<div class="ks-row"><span>Vs ${parsedProp.opponent}</span><strong>${formatRate(insights.opponent)}</strong></div>`
      : "";

    const html = [
      `<div class="ks-title">${escapeHtml(parsedProp.playerName)} ${escapeHtml(parsedProp.direction)} ${parsedProp.line} ${escapeHtml(parsedProp.stat.label)}</div>`,
      `<div class="ks-subtitle">Sample: ${insights.sampleSize} games</div>`,
      `<div class="ks-row"><span>L5</span><strong>${formatRate(insights.l5)}</strong></div>`,
      `<div class="ks-row"><span>L10</span><strong>${formatRate(insights.l10)}</strong></div>`,
      opponentSummary
    ].join("");

    showCard(anchor, html, true);
  }

  function requestInsights(anchor, context) {
    const signature = JSON.stringify(context);
    if (signature === lastSignature) {
      return;
    }

    lastSignature = signature;
    showCard(anchor, "Loading Kalshi Sniper...");

    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      chrome.runtime.sendMessage(
        {
          type: "KALSHI_SNIPER_HOVER",
          payload: context
        },
        (response) => {
          if (chrome.runtime.lastError) {
            showCard(anchor, "Background request failed.");
            return;
          }

          if (!response?.ok) {
            showCard(anchor, response?.error || "No stats found.");
            return;
          }

          renderInsights(anchor, response.result);
        }
      );
    }, REQUEST_DEBOUNCE_MS);
  }

  function formatRate(summary) {
    if (!summary || !summary.games) {
      return "No sample";
    }

    return `${summary.hits}/${summary.games} (${summary.rate}%)`;
  }

  function showCard(anchor, content, isHtml) {
    const card = ensureCard();
    card.innerHTML = isHtml ? content : `<div class="ks-message">${escapeHtml(content)}</div>`;

    const rect = anchor.getBoundingClientRect();
    const top = window.scrollY + rect.top;
    const left = window.scrollX + rect.right + 12;

    card.style.top = `${top}px`;
    card.style.left = `${Math.min(left, window.scrollX + window.innerWidth - 290)}px`;
    card.hidden = false;
  }

  function hideCard() {
    const card = document.getElementById(CARD_ID);
    if (card) {
      card.hidden = true;
    }
  }

  function ensureCard() {
    let card = document.getElementById(CARD_ID);
    if (card) {
      return card;
    }

    card = document.createElement("div");
    card.id = CARD_ID;
    card.hidden = true;
    card.style.position = "absolute";
    card.style.zIndex = "2147483647";
    card.style.width = "260px";
    card.style.padding = "12px";
    card.style.borderRadius = "12px";
    card.style.background = "#111827";
    card.style.color = "#f9fafb";
    card.style.boxShadow = "0 14px 40px rgba(15, 23, 42, 0.35)";
    card.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
    card.style.fontSize = "13px";
    card.style.lineHeight = "1.45";
    card.style.border = "1px solid rgba(255,255,255,0.08)";
    card.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      #${CARD_ID} .ks-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
      #${CARD_ID} .ks-subtitle { color: #9ca3af; margin-bottom: 8px; }
      #${CARD_ID} .ks-row { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; }
      #${CARD_ID} .ks-message { color: #e5e7eb; }
    `;

    document.documentElement.appendChild(style);
    document.body.appendChild(card);
    return card;
  }

  function createVirtualAnchor(rect) {
    return {
      getBoundingClientRect() {
        return rect;
      }
    };
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
