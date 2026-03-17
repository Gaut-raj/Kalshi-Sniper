# Kalshi Sniper

Kalshi Sniper is a Chrome extension scaffold for NBA player props on Kalshi. When you hover a likely player prop market, the extension tries to parse the player, stat, line, and opponent from the page, scrapes ESPN game logs, and shows:

- L5 hit rate
- L10 hit rate
- Hit rate versus the same opponent

## Current layout

```text
background/
  background.js
content/
  kalshiHover.js
services/
  espnGameLogService.js
  kalshiapiservice.js
ui/
  popup.css
  popup.html
  popup.js
manifest.json
```

## How it works

1. The content script watches hovered Kalshi elements and collects nearby visible text.
2. The background worker parses that text into a prop request.
3. The ESPN scraper resolves the player page, fetches the current season game log, and computes hit rates.
4. The content script renders a compact hover card next to the prop.

## Important assumptions

- The current parser is tuned for common text patterns such as `Jayson Tatum over 29.5 points` or `Nikola Jokic 10+ rebounds`.
- Hit rates are computed against the displayed line. If no direction is detected, the extension assumes an `over` style prop.
- Opponent history is based on the current season game log against the parsed opponent abbreviation.
- ESPN player resolution is based on ESPN search result links, then the extension scrapes the player game log page.

## Loading the extension

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select this project folder

## Likely next steps

- Tune the Kalshi DOM selectors against the live site once you confirm the exact prop card markup.
- Add support for additional prop types or leagues.
- Cache player logs in `chrome.storage` if you want data to persist across service worker restarts.
