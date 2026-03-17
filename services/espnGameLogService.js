const PLAYER_CACHE = new Map();
const GAME_LOG_CACHE = new Map();

export async function fetchPropInsights(prop) {
  const player = await resolveEspnPlayer(prop.playerName);
  if (!player) {
    throw new Error(`Could not resolve ${prop.playerName} on ESPN.`);
  }

  const games = await fetchPlayerGameLog(player);
  if (!games.length) {
    throw new Error(`No ESPN game log rows found for ${prop.playerName}.`);
  }

  return {
    player: {
      name: player.name,
      id: player.id,
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

async function resolveEspnPlayer(playerName) {
  const cacheKey = normalizeName(playerName);
  if (PLAYER_CACHE.has(cacheKey)) {
    return PLAYER_CACHE.get(cacheKey);
  }

  const searchUrl = `https://www.espn.com/search/_/q/${encodeURIComponent(playerName)}`;
  const html = await fetchHtml(searchUrl);
  const player = extractPlayerFromSearch(html, cacheKey);

  PLAYER_CACHE.set(cacheKey, player);
  return player;
}

async function fetchPlayerGameLog(player) {
  const season = getCurrentSeasonLabel();
  const cacheKey = `${player.id}:${season}`;

  if (GAME_LOG_CACHE.has(cacheKey)) {
    return GAME_LOG_CACHE.get(cacheKey);
  }

  const url = `https://www.espn.com/nba/player/gamelog/_/id/${player.id}/${player.slug}`;
  const document = await fetchDocument(url);
  const tables = Array.from(document.querySelectorAll("table"));

  let selectedTable = null;
  for (const table of tables) {
    const text = table.textContent || "";
    if (text.includes("Date") && text.includes("OPP") && text.includes("PTS") && text.includes("REB") && text.includes("AST")) {
      selectedTable = table;
      break;
    }
  }

  if (!selectedTable) {
    GAME_LOG_CACHE.set(cacheKey, []);
    return [];
  }

  const games = parseGameLogTable(selectedTable)
    .filter(Boolean)
    .sort((left, right) => right.date - left.date);

  GAME_LOG_CACHE.set(cacheKey, games);
  return games;
}

function extractPlayerFromSearch(html, cacheKey) {
  const matches = Array.from(
    html.matchAll(/(?:https:\/\/www\.espn\.com)?\/nba\/player(?:\/gamelog)?\/_\/id\/(?<id>\d+)\/(?<slug>[a-z0-9-]+)/gi)
  );

  let fallback = null;

  for (const match of matches) {
    const id = match.groups?.id;
    const slug = match.groups?.slug;
    if (!id || !slug) {
      continue;
    }

    const candidateName = slugToName(slug);
    const normalizedCandidate = normalizeName(candidateName);
    const player = {
      id,
      slug,
      name: candidateName
    };

    if (normalizedCandidate === cacheKey) {
      return player;
    }

    if (!fallback && normalizedCandidate.includes(cacheKey)) {
      fallback = player;
    }
  }

  return fallback;
}

function parseGameLogTable(table) {
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  const games = [];

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll("th, td")).map((cell) =>
      cell.textContent.replace(/\s+/g, " ").trim()
    );

    if (cells.length < 13) {
      continue;
    }

    const date = parseEspnDate(cells[0]);
    const opponent = normalizeOpponent(cells[1]);

    if (!date || !opponent) {
      continue;
    }

    const threePointersMade = parseMadeField(cells[6]);
    const rebounds = parseNumber(cells[10]);
    const assists = parseNumber(cells[11]);
    const points = parseNumber(cells[cells.length - 1]);

    if (![points, rebounds, assists].some(Number.isFinite)) {
      continue;
    }

    games.push({
      date,
      opponent,
      points,
      rebounds,
      assists,
      threePointersMade
    });
  }

  return games;
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
  const html = await fetchHtml(url);
  return new DOMParser().parseFromString(html, "text/html");
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}.`);
  }

  return response.text();
}

function parseEspnDate(value) {
  const cleaned = value.replace(/^[A-Za-z]{3}\s+/, "").trim();
  const [month, day] = cleaned.split("/").map((part) => Number.parseInt(part, 10));

  if (!month || !day) {
    return null;
  }

  const season = getCurrentSeasonLabel();
  const startYear = Number.parseInt(season.slice(0, 4), 10);
  const endYear = Number.parseInt(season.slice(5), 10);
  const year = month >= 10 ? startYear : endYear;
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeOpponent(value) {
  const match = value.toUpperCase().match(/(?:VS|@)\s*([A-Z]{2,3})/);
  return match ? match[1] : null;
}

function parseMadeField(value) {
  const match = value.match(/(\d+)-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : parseNumber(value);
}

function slugToName(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function getCurrentSeasonLabel() {
  const now = new Date();
  const year = now.getFullYear();

  if (now.getMonth() >= 6) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }

  return `${year - 1}-${String(year).slice(-2)}`;
}
