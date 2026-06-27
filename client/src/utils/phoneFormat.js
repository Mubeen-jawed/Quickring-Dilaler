// Country calling codes → { name, flag, code }
// Ordered longest-prefix-first so +44 matches before +4
const COUNTRY_CODES = [
  { prefix: '1',   flag: '\u{1F1FA}\u{1F1F8}', name: 'US/CA',       len: 10 },
  { prefix: '44',  flag: '\u{1F1EC}\u{1F1E7}', name: 'UK',          len: 10 },
  { prefix: '91',  flag: '\u{1F1EE}\u{1F1F3}', name: 'India',       len: 10 },
  { prefix: '61',  flag: '\u{1F1E6}\u{1F1FA}', name: 'Australia',   len: 9 },
  { prefix: '81',  flag: '\u{1F1EF}\u{1F1F5}', name: 'Japan',       len: 10 },
  { prefix: '86',  flag: '\u{1F1E8}\u{1F1F3}', name: 'China',       len: 11 },
  { prefix: '49',  flag: '\u{1F1E9}\u{1F1EA}', name: 'Germany',     len: 11 },
  { prefix: '33',  flag: '\u{1F1EB}\u{1F1F7}', name: 'France',      len: 9 },
  { prefix: '39',  flag: '\u{1F1EE}\u{1F1F9}', name: 'Italy',       len: 10 },
  { prefix: '34',  flag: '\u{1F1EA}\u{1F1F8}', name: 'Spain',       len: 9 },
  { prefix: '55',  flag: '\u{1F1E7}\u{1F1F7}', name: 'Brazil',      len: 11 },
  { prefix: '52',  flag: '\u{1F1F2}\u{1F1FD}', name: 'Mexico',      len: 10 },
  { prefix: '82',  flag: '\u{1F1F0}\u{1F1F7}', name: 'South Korea', len: 10 },
  { prefix: '7',   flag: '\u{1F1F7}\u{1F1FA}', name: 'Russia',      len: 10 },
  { prefix: '971', flag: '\u{1F1E6}\u{1F1EA}', name: 'UAE',         len: 9 },
  { prefix: '966', flag: '\u{1F1F8}\u{1F1E6}', name: 'Saudi Arabia',len: 9 },
  { prefix: '234', flag: '\u{1F1F3}\u{1F1EC}', name: 'Nigeria',     len: 10 },
  { prefix: '27',  flag: '\u{1F1FF}\u{1F1E6}', name: 'South Africa',len: 9 },
  { prefix: '254', flag: '\u{1F1F0}\u{1F1EA}', name: 'Kenya',       len: 9 },
  { prefix: '63',  flag: '\u{1F1F5}\u{1F1ED}', name: 'Philippines', len: 10 },
  { prefix: '62',  flag: '\u{1F1EE}\u{1F1E9}', name: 'Indonesia',   len: 11 },
  { prefix: '60',  flag: '\u{1F1F2}\u{1F1FE}', name: 'Malaysia',    len: 10 },
  { prefix: '65',  flag: '\u{1F1F8}\u{1F1EC}', name: 'Singapore',   len: 8 },
  { prefix: '64',  flag: '\u{1F1F3}\u{1F1FF}', name: 'New Zealand', len: 9 },
  { prefix: '92',  flag: '\u{1F1F5}\u{1F1F0}', name: 'Pakistan',    len: 10 },
  { prefix: '880', flag: '\u{1F1E7}\u{1F1E9}', name: 'Bangladesh',  len: 10 },
  { prefix: '977', flag: '\u{1F1F3}\u{1F1F5}', name: 'Nepal',       len: 10 },
  { prefix: '94',  flag: '\u{1F1F1}\u{1F1F0}', name: 'Sri Lanka',   len: 9 },
  { prefix: '353', flag: '\u{1F1EE}\u{1F1EA}', name: 'Ireland',     len: 9 },
  { prefix: '31',  flag: '\u{1F1F3}\u{1F1F1}', name: 'Netherlands', len: 9 },
  { prefix: '46',  flag: '\u{1F1F8}\u{1F1EA}', name: 'Sweden',      len: 9 },
  { prefix: '47',  flag: '\u{1F1F3}\u{1F1F4}', name: 'Norway',      len: 8 },
  { prefix: '45',  flag: '\u{1F1E9}\u{1F1F0}', name: 'Denmark',     len: 8 },
  { prefix: '358', flag: '\u{1F1EB}\u{1F1EE}', name: 'Finland',     len: 9 },
  { prefix: '41',  flag: '\u{1F1E8}\u{1F1ED}', name: 'Switzerland', len: 9 },
  { prefix: '43',  flag: '\u{1F1E6}\u{1F1F9}', name: 'Austria',     len: 10 },
  { prefix: '48',  flag: '\u{1F1F5}\u{1F1F1}', name: 'Poland',      len: 9 },
  { prefix: '90',  flag: '\u{1F1F9}\u{1F1F7}', name: 'Turkey',      len: 10 },
  { prefix: '20',  flag: '\u{1F1EA}\u{1F1EC}', name: 'Egypt',       len: 10 },
  { prefix: '212', flag: '\u{1F1F2}\u{1F1E6}', name: 'Morocco',     len: 9 },
  { prefix: '351', flag: '\u{1F1F5}\u{1F1F9}', name: 'Portugal',    len: 9 },
  { prefix: '32',  flag: '\u{1F1E7}\u{1F1EA}', name: 'Belgium',     len: 9 },
  { prefix: '30',  flag: '\u{1F1EC}\u{1F1F7}', name: 'Greece',      len: 10 },
  { prefix: '972', flag: '\u{1F1EE}\u{1F1F1}', name: 'Israel',      len: 9 },
  { prefix: '66',  flag: '\u{1F1F9}\u{1F1ED}', name: 'Thailand',    len: 9 },
  { prefix: '84',  flag: '\u{1F1FB}\u{1F1F3}', name: 'Vietnam',     len: 9 },
  { prefix: '852', flag: '\u{1F1ED}\u{1F1F0}', name: 'Hong Kong',   len: 8 },
  { prefix: '886', flag: '\u{1F1F9}\u{1F1FC}', name: 'Taiwan',      len: 9 },
  { prefix: '56',  flag: '\u{1F1E8}\u{1F1F1}', name: 'Chile',       len: 9 },
  { prefix: '57',  flag: '\u{1F1E8}\u{1F1F4}', name: 'Colombia',    len: 10 },
  { prefix: '51',  flag: '\u{1F1F5}\u{1F1EA}', name: 'Peru',        len: 9 },
  { prefix: '54',  flag: '\u{1F1E6}\u{1F1F7}', name: 'Argentina',   len: 10 },
];

// Sort by prefix length descending so longer prefixes match first (e.g. 971 before 97)
const SORTED_CODES = [...COUNTRY_CODES].sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Parse an E.164 phone number into country info + formatted local number.
 * @param {string} raw  e.g. "+15551234567", "15551234567", "client:agent_1"
 * @returns {{ flag: string, country: string, formatted: string }}
 */
export function parsePhone(raw) {
  if (!raw || raw.startsWith('client:') || raw === 'Anonymous') {
    return { flag: '', country: '', formatted: raw || 'Unknown' };
  }

  // Strip everything except digits and leading +
  const cleaned = raw.replace(/[^\d+]/g, '');
  const digits = cleaned.replace('+', '');

  // Try to match a country prefix (longest prefix first)
  for (const cc of SORTED_CODES) {
    if (digits.startsWith(cc.prefix)) {
      const local = digits.slice(cc.prefix.length);

      // If prefix is '1' (US/CA) but local part is way too long, the leading 1
      // may be an international dialing prefix, not the country code.
      // Strip it and try matching the real country code underneath.
      if (cc.prefix === '1' && local.length > cc.len + 1) {
        const stripped = digits.slice(1);
        for (const cc2 of SORTED_CODES) {
          if (stripped.startsWith(cc2.prefix)) {
            const local2 = stripped.slice(cc2.prefix.length);
            if (Math.abs(local2.length - cc2.len) <= 2) {
              return {
                flag: cc2.flag,
                country: cc2.name,
                formatted: `+${cc2.prefix} ${formatLocal(local2)}`,
              };
            }
          }
        }
      }

      return {
        flag: cc.flag,
        country: cc.name,
        formatted: `+${cc.prefix} ${formatLocal(local)}`,
      };
    }
  }

  // No match — return with + prefix if it had one
  return {
    flag: '\u{1F30D}',
    country: '',
    formatted: cleaned.startsWith('+') ? cleaned : `+${digits}`,
  };
}

/** Group local digits into readable chunks: 555 123 4567 or 55 1234 5678 */
function formatLocal(digits) {
  const len = digits.length;
  if (len <= 4) return digits;
  if (len <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (len === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  // Generic: groups of 3-4
  const parts = [];
  let i = 0;
  while (i < len) {
    const remaining = len - i;
    const chunk = remaining > 4 ? 3 : remaining;
    parts.push(digits.slice(i, i + chunk));
    i += chunk;
  }
  return parts.join(' ');
}
