const DONO_KEYWORDS = ['/rathole dono', '/rathole owner', 'dono', 'owner'];
const RESP_KEYWORDS = [
  '/rathole responsavel',
  '/rathole responsible',
  'responsavel',
  'responsável',
  'responsible',
];

function keywordMatch(text, keywords) {
  const lower = text.trim().toLowerCase();
  const ordered = [...keywords].sort((a, b) => b.length - a.length);
  return ordered.find(
    (keyword) => lower === keyword || lower.startsWith(`${keyword} `) || lower.startsWith(`${keyword}:`)
  );
}

function matchesKeyword(text, keywords) {
  return Boolean(keywordMatch(text, keywords));
}

function stripCommandPrefix(content, keywords) {
  const trimmed = content.trim();
  const keyword = keywordMatch(trimmed, keywords);
  if (!keyword) return '';

  let rest = trimmed.slice(keyword.length).trim();
  rest = rest.replace(/^(?:do|da|de|of|for|pelo|por|:)\s*/i, '').trim();
  return rest.slice(0, 64);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NAME_STOPWORDS = new Set([
  'a', 'an', 'the', 'os', 'as', 'um', 'uma', 'o', 'de', 'do', 'da',
  'rathole', 'ratholes', 'my', 'me',
]);

function normalizeQuestion(text) {
  return text
    .replace(/<@[!&]?\d+>/g, ' ')
    .replace(/[?!.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOwnerQuestion(text) {
  const normalized = normalizeQuestion(text);
  const patterns = [
    /^(?:quais|qual)\s+(?:s[aã]o\s+)?(?:os\s+|as\s+)?ratholes?\s+(?:do|da|de)\s+(.+)$/i,
    /^(?:os\s+|as\s+)?ratholes?\s+(?:do|da|de)\s+(.+)$/i,
    /^(?:quais|qual)\s+(?:s[aã]o\s+)?(?:os\s+)?ratholes?\s+(?:que\s+)?(?:o|a)\s+(.+?)\s+(?:tem|possui|e\s+dono|é\s+dono|e\s+owner|é\s+owner)$/i,
    /^(?:me\s+fala|me\s+diz|mostra|liste|lista)\s+(?:os\s+)?ratholes?\s+(?:do|da|de)\s+(.+)$/i,
    /^(?:what|which)\s+(?:are|is)\s+(?:the\s+)?(.+?)['’]s\s+ratholes?$/i,
    /^(.+?)['’]s\s+ratholes?$/i,
    /^(?:what|which)\s+(?:are|is)\s+(?:the\s+)?ratholes?\s+(?:of|for|owned\s+by)\s+(.+)$/i,
    /^(?:which|what)\s+ratholes?\s+(?:does|do)\s+(.+?)\s+own$/i,
    /^(?:show|list)\s+(?:me\s+)?(?:the\s+)?ratholes?\s+(?:of|for)\s+(.+)$/i,
    /^(?:what|which)\s+(?:are|is)\s+(.+?)\s+ratholes?$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const name = match[1].trim().slice(0, 64);
    if (name.length < 2 || NAME_STOPWORDS.has(name.toLowerCase())) continue;
    return name;
  }

  return null;
}

module.exports = {
  DONO_KEYWORDS,
  RESP_KEYWORDS,
  matchesKeyword,
  stripCommandPrefix,
  escapeRegex,
  parseOwnerQuestion,
};
