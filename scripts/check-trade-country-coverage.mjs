import fs from 'node:fs';

const source = fs.readFileSync('netlify/functions/trade-rules.mts', 'utf8');
const match = source.match(/const ISO_COUNTRY_CODES=`([^`]+)`\.split\(\/\\s\+\/\);/);
if (!match) throw new Error('ISO_COUNTRY_CODES list not found in trade-rules.mts');

const codes = match[1].trim().split(/\s+/);
const unique = new Set(codes);
if (codes.length !== 249 || unique.size !== 249) {
  throw new Error(`Expected 249 unique ISO 3166-1 alpha-2 codes, found ${codes.length} entries / ${unique.size} unique`);
}
for (const code of codes) {
  if (!/^[A-Z]{2}$/.test(code)) throw new Error(`Invalid ISO country code in runtime list: ${code}`);
}

const display = new Intl.DisplayNames(['en'], { type: 'region' });
const missingNames = codes.filter(code => {
  try {
    const name = display.of(code);
    return !name || name === code;
  } catch {
    return true;
  }
});
if (missingNames.length) {
  throw new Error(`Runtime cannot resolve country names for: ${missingNames.join(', ')}`);
}

if (!source.includes('for(const code of ISO_COUNTRY_CODES)')) {
  throw new Error('Origin matcher is not iterating over the full ISO country set');
}
if (!source.includes('ISO_COUNTRIES.has(country)')) {
  throw new Error('Request validation is not using the full ISO country set');
}
if (!source.includes('return{state:"unknown" as const,reason:"The origin condition could not be resolved automatically."}')) {
  throw new Error('Fail-safe unresolved-origin behavior is missing');
}

console.log(`Country coverage OK: ${codes.length} ISO country/territory codes, all name-resolvable.`);
