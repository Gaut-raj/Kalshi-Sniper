(() => {
  const PANEL_ID = "kalshi-edge-panel";

  if (document.getElementById(PANEL_ID)) {
    return;
  }

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText = [
    "position:fixed",
    "top:16px",
    "right:16px",
    "z-index:2147483647",
    "font-family:'Times New Roman', Georgia, serif",
    "background:linear-gradient(135deg, #f5e9d5, #f0d7b8)",
    "border:2px solid #3b2f2f",
    "box-shadow:0 12px 30px rgba(0,0,0,0.25)",
    "border-radius:12px",
    "padding:12px 14px",
    "width:260px"
  ].join(";");

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-weight:700;font-size:16px;letter-spacing:0.2px;">Kalshi Edge</div>
      <button id="kalshi-edge-close" style="border:none;background:#3b2f2f;color:#f5e9d5;border-radius:6px;padding:2px 8px;cursor:pointer;">x</button>
    </div>
    <div style="font-size:12px;color:#3b2f2f;margin-bottom:10px;">
      Enter your probability vs market price to find edge.
    </div>
    <label style="display:block;font-size:12px;margin-bottom:6px;">
      Your probability (%)
      <input id="kalshi-edge-prob" type="number" min="0" max="100" step="0.1" value="60"
        style="width:100%;margin-top:4px;padding:6px;border:1px solid #3b2f2f;border-radius:6px;">
    </label>
    <label style="display:block;font-size:12px;margin-bottom:8px;">
      Market price (cents)
      <input id="kalshi-edge-price" type="number" min="0" max="100" step="0.1" value="40"
        style="width:100%;margin-top:4px;padding:6px;border:1px solid #3b2f2f;border-radius:6px;">
    </label>
    <button id="kalshi-edge-calc" style="width:100%;background:#3b2f2f;color:#f5e9d5;border:none;border-radius:8px;padding:8px;cursor:pointer;font-weight:700;">
      Calculate Edge
    </button>
    <div id="kalshi-edge-result" style="margin-top:10px;font-size:12px;line-height:1.4;"></div>
  `;

  document.body.appendChild(panel);

  const result = panel.querySelector("#kalshi-edge-result");
  const probInput = panel.querySelector("#kalshi-edge-prob");
  const priceInput = panel.querySelector("#kalshi-edge-price");

  panel.querySelector("#kalshi-edge-close").addEventListener("click", () => {
    panel.remove();
  });

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const formatPct = (value) => `${value.toFixed(1)}%`;

  const updateResult = () => {
    const userProb = toNumber(probInput.value);
    const marketPrice = toNumber(priceInput.value);

    if (userProb === null || marketPrice === null) {
      result.textContent = "Enter valid numbers.";
      return;
    }

    if (userProb < 0 || userProb > 100 || marketPrice < 0 || marketPrice > 100) {
      result.textContent = "Values must be between 0 and 100.";
      return;
    }

    const marketProb = marketPrice / 100;
    const edge = userProb / 100 - marketProb;
    const edgePct = edge * 100;

    const direction = edge > 0 ? "positive" : edge < 0 ? "negative" : "neutral";
    const verdict =
      edge > 0
        ? "Potential edge in your favor."
        : edge < 0
        ? "Market implies higher odds than your estimate."
        : "No edge detected.";

    result.innerHTML = `
      <div><strong>Market implied:</strong> ${formatPct(marketProb * 100)}</div>
      <div><strong>Your edge:</strong> ${formatPct(edgePct)} (${direction})</div>
      <div style="margin-top:6px;">${verdict}</div>
      <div style="margin-top:6px;color:#5a4a4a;">Not financial advice.</div>
    `;
  };

  panel.querySelector("#kalshi-edge-calc").addEventListener("click", updateResult);
})();
