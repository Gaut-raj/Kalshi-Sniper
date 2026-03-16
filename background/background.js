import { fetchPropInsights } from "../services/basketballReferenceService.js";
import { parseKalshiPropContext } from "../services/kalshiapiservice.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "KALSHI_SNIPER_HOVER") {
    return false;
  }

  handleHover(message.payload)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    });

  return true;
});

async function handleHover(payload) {
  const parsedProp = parseKalshiPropContext(payload);

  if (!parsedProp) {
    throw new Error("Could not parse a supported NBA player prop from the hovered text.");
  }

  const insights = await fetchPropInsights(parsedProp);
  return {
    parsedProp,
    insights
  };
}
