const TEAM_NAME_TO_ABBR = new Map([
  ["atlanta hawks", "ATL"],
  ["boston celtics", "BOS"],
  ["brooklyn nets", "BRK"],
  ["charlotte hornets", "CHO"],
  ["chicago bulls", "CHI"],
  ["cleveland cavaliers", "CLE"],
  ["dallas mavericks", "DAL"],
  ["denver nuggets", "DEN"],
  ["detroit pistons", "DET"],
  ["golden state warriors", "GSW"],
  ["houston rockets", "HOU"],
  ["indiana pacers", "IND"],
  ["la clippers", "LAC"],
  ["los angeles clippers", "LAC"],
  ["los angeles lakers", "LAL"],
  ["la lakers", "LAL"],
  ["memphis grizzlies", "MEM"],
  ["miami heat", "MIA"],
  ["milwaukee bucks", "MIL"],
  ["minnesota timberwolves", "MIN"],
  ["new orleans pelicans", "NOP"],
  ["new york knicks", "NYK"],
  ["oklahoma city thunder", "OKC"],
  ["orlando magic", "ORL"],
  ["philadelphia 76ers", "PHI"],
  ["phoenix suns", "PHO"],
  ["portland trail blazers", "POR"],
  ["sacramento kings", "SAC"],
  ["san antonio spurs", "SAS"],
  ["toronto raptors", "TOR"],
  ["utah jazz", "UTA"],
  ["washington wizards", "WAS"]
]);

const TEAM_ABBREVIATIONS = new Set(TEAM_NAME_TO_ABBR.values());

const STAT_PATTERNS = [
  { key: "points", regex: /\b(points?|pts?)\b/i, label: "Points" },
  { key: "rebounds", regex: /\b(rebounds?|rebs?|reb)\b/i, label: "Rebounds" },
  { key: "assists", regex: /\b(assists?|asts?|ast)\b/i, label: "Assists" },
  { key: "threePointersMade", regex: /\b(three pointers?|3-pointers?|3pt(?:s)?|threes?)\b/i, label: "3PM" }
];

const PROP_PATTERNS = [
  /(?<player>[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})\s+(?<direction>over|under)\s+(?<line>\d+(?:\.\d+)?)\s+(?<stat>points?|pts?|rebounds?|rebs?|reb|assists?|asts?|ast|three pointers?|3-pointers?|3pt(?:s)?|threes?)/i,
  /(?<player>[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})\s+(?<line>\d+(?:\.\d+)?)\+?\s+(?<stat>points?|pts?|rebounds?|rebs?|reb|assists?|asts?|ast|three pointers?|3-pointers?|3pt(?:s)?|threes?)/i
];

export function parseKalshiPropContext(payload) {
  const candidates = buildCandidateList(payload);

  for (const text of candidates) {
    const parsed = parsePropText(text, candidates);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function buildCandidateList(payload) {
  const values = [
    payload?.hoverText,
    payload?.elementText,
    ...(Array.isArray(payload?.ancestorTexts) ? payload.ancestorTexts : []),
    payload?.pageTitle
  ];

  const unique = [];
  const seen = new Set();

  for (const rawValue of values) {
    if (typeof rawValue !== "string") {
      continue;
    }

    const cleaned = rawValue.replace(/\s+/g, " ").trim();
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }

    seen.add(cleaned);
    unique.push(cleaned);
  }

  return unique;
}

function parsePropText(text, allCandidates) {
  for (const pattern of PROP_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.groups) {
      continue;
    }

    const stat = mapStat(match.groups.stat);
    if (!stat) {
      continue;
    }

    const opponent = inferOpponent([text, ...allCandidates]);
    return {
      playerName: match.groups.player.trim(),
      line: Number.parseFloat(match.groups.line),
      direction: (match.groups.direction || "over").toLowerCase(),
      stat,
      opponent
    };
  }

  return null;
}

function mapStat(rawStat) {
  if (!rawStat) {
    return null;
  }

  return STAT_PATTERNS.find((entry) => entry.regex.test(rawStat)) || null;
}

function inferOpponent(candidates) {
  for (const value of candidates) {
    const lowerValue = value.toLowerCase();

    for (const [teamName, abbreviation] of TEAM_NAME_TO_ABBR.entries()) {
      if (lowerValue.includes(teamName)) {
        return abbreviation;
      }
    }

    const tokens = value.toUpperCase().match(/\b[A-Z]{2,3}\b/g) || [];
    for (const token of tokens) {
      if (TEAM_ABBREVIATIONS.has(token)) {
        return token;
      }
    }
  }

  return null;
}
