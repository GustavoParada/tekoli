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

module.exports = {
  DONO_KEYWORDS,
  RESP_KEYWORDS,
  matchesKeyword,
  stripCommandPrefix,
  escapeRegex,
};
