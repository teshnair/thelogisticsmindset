// Country dispatch for the July 24, 2026 Section 301 forced-labor action.
// Source: CBP CSMS #69326983, https://content.govdelivery.com/accounts/USDHSCBP/bulletins/421d887
// Index 20..84 follows the order in CBP guidance; EU, Japan, South Korea,
// Switzerland and Taiwan have two mutually exclusive column-1 rate treatments.
// This table chooses origin-specific *candidates*, never grants an exemption.
const HEADING_COUNTRIES=`DZ AO AR AU BS BH BD BR KH CA CL CN CO CR DO EC EG SV EU EU GT GY HN HK IN ID IQ IL JP JP JO KZ KW LY MY MX MA NZ NI NG NO OM PK PE PH QA RU SA SG ZA KR KR LK CH CH TW TW TH TT TR AE GB UY VE VN`.split(' ');
if(HEADING_COUNTRIES.length!==65)throw new Error('Invalid official Section 301 origin map');
const EU=new Set(`AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK`.split(' '));
const codeFor=n=>`9903.05.${String(n).padStart(2,'0')}`;
export const SECTION301_FORCED_LABOR_EFFECTIVE='2026-07-24';
export function isForcedLaborCountryHeading(ref){
  const m=String(ref||'').match(/^9903\.05\.(\d\d)$/);
  return m!==null&&Number(m[1])>=20&&Number(m[1])<=84;
}
export function forcedLaborHeadingsForOrigin(country){
  const c=EU.has(country)?'EU':country;
  const result=[];
  for(let i=0;i<HEADING_COUNTRIES.length;i++)if(HEADING_COUNTRIES[i]===c)result.push(codeFor(i+20));
  return result;
}
export function forcedLaborHeadingMatchesOrigin(ref,country){
  return forcedLaborHeadingsForOrigin(country).includes(ref);
}
export function requiresColumn1Comparison(ref){
  return new Set([38,39,48,49,70,71,73,74,75,76]).has(Number(String(ref).slice(-2)))&&isForcedLaborCountryHeading(ref);
}
