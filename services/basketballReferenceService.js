const PLAYER_CACHE = new Map();
const GAME_LOG_CACHE = new Map();

export async function fetchPropInsights(prop) {
  const player = await resolveBasketballReferencePlayer(prop.playerName);
  if (!player) {
    throw new Error(`Could not resolve ${prop.playerName} on Basketball Reference.`);
  }

  const seasonEndYear = getCurrentSeasonEndYear();
  const games = await fetchPlayerGameLog(player, seasonEndYear);

  if (!games.length) {
    throw new Error(`No game log rows found for ${prop.playerName}.`);
  }

  return {
    player: {
      name: player.name,
      slug: player.slug
    },
    sampleSize: games.length,
    l5: summarizeGames(games.slice(0, 5), prop),
    l10: summarizeGames(games.slice(0, 10), prop),
    opponent: prop.opponent
      ? summarizeGames(
          games.filter((game) => game.opponent === prop.opponent),
          prop
        )
      : null
  };
}

async function resolveBasketballReferencePlayer(playerName) {
  const cacheKey = normalizeName(playerName);
  if (PLAYER_CACHE.has(cacheKey)) {
    return PLAYER_CACHE.get(cacheKey);
  }

  const lastNameInitial = cacheKey.charAt(cacheKey.lastIndexOf(" ") + 1) || cacheKey.charAt(0);
  const directoryUrl = `https://www.basketball-reference.com/players/${lastNameInitial}/`;
  const document = await fetchDocument(directoryUrl);
  const rows = Array.from(document.querySelectorAll("#players tbody tr"));

  let exactMatch = null;
  let fallbackMatch = null;

  for (const row of rows) {
    const playerLink = row.querySelector("th[data-stat='player'] a");
    if (!playerLink) {
      continue;
    }

    const candidateName = playerLink.textContent.trim();
    const normalizedCandidate = normalizeName(candidateName);
    const href = playerLink.getAttribute("href") || "";
    const slugMatch = href.match(/\/players\/[a-z]\/([^.\/]+)\.html$/i);

    if (!slugMatch) {
      continue;
    }

    const player = {
      name: candidateName,
      slug: slugMatch[1]
    };

    if (normalizedCandidate === cacheKey) {
      exactMatch = player;
      break;
    }

    if (!fallbackMatch && normalizedCandidate.includes(cacheKey)) {
      fallbackMatch = player;
    }
  }

  const resolved = exactMatch || fallbackMatch || null;
  PLAYER_CACHE.set(cacheKey, resolved);
  return resolved;
}

async function fetchPlayerGameLog(player, seasonEndYear) {
  const cacheKey = `${player.slug}:${seasonEndYear}`;
  if (GAME_LOG_CACHE.has(cacheKey)) {
    return GAME_LOG_CACHE.get(cacheKey);
  }

  const gamelogUrl = `https://www.basketball-reference.com/players/${player.slug.charAt(0)}/${player.slug}/gamelog/${seasonEndYear}`;
  const document = await fetchDocument(gamelogUrl);
  const gameLogTable = findTable(document, "pgl_basic");

  if (!gameLogTable) {
    GAME_LOG_CACHE.set(cacheKey, []);
    return [];
  }

  const rows = Array.from(gameLogTable.querySelectorAll("tbody tr"))
    .filter((row) => !row.classList.contains("thead"))
    .map(parseGameLogRow)
    .filter(Boolean)
    .sort((left, right) => right.date - left.date);

  GAME_LOG_CACHE.set(cacheKey, rows);
  return rows;
}

function parseGameLogRow(row) {
  const inactive = getCellText(row, "reason");
  if (inactive) {
    return null;
  }

  const dateText = getCellText(row, "date_game");
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date,
    opponent: getCellText(row, "opp_id") || null,
    points: parseNumber(getCellText(row, "pts")),
    rebounds: parseNumber(getCellText(row, "trb")),
    assists: parseNumber(getCellText(row, "ast")),
    threePointersMade: parseNumber(getCellText(row, "fg3"))
  };
}

function summarizeGames(games, prop) {
  const samples = games.filter((game) => Number.isFinite(game[prop.stat.key]));
  const hits = samples.filter((game) => isHit(game[prop.stat.key], prop.line, prop.direction));

  return {
    games: samples.length,
    hits: hits.length,
    rate: samples.length ? Number(((hits.length / samples.length) * 100).toFixed(1)) : null,
    average: samples.length
      ? Number(
          (
            samples.reduce((total, game) => total + game[prop.stat.key], 0) / samples.length
          ).toFixed(1)
        )
      : null
  };
}

function isHit(value, line, direction) {
  if (!Number.isFinite(value) || !Number.isFinite(line)) {
    return false;
  }

  return direction === "under" ? value < line : value >= line;
}

async function fetchDocument(url) {
  const response = await fetch(url, {
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}.`);
  }

  const html = await response.text();
  return new DOMParser().parseFromString(html, "text/html");
}

function findTable(document, tableId) {
  const inlineTable = document.getElementById(tableId);
  if (inlineTable) {
    return inlineTable;
  }

  const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
  while (walker.nextNode()) {
    const commentValue = walker.currentNode.nodeValue || "";
    if (!commentValue.includes(`id="${tableId}"`)) {
      continue;
    }

    const parsedComment = new DOMParser().parseFromString(commentValue, "text/html");
    return parsedComment.getElementById(tableId);
  }

  return null;
}

function getCellText(row, stat) {
  const headerCell = row.querySelector(`th[data-stat="${stat}"]`);
  if (headerCell) {
    return headerCell.textContent.trim();
  }

  const dataCell = row.querySelector(`td[data-stat="${stat}"]`);
  return dataCell ? dataCell.textContent.trim() : "";
}

function normalizeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCurrentSeasonEndYear() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 6 ? year + 1 : year;
}
