import assert from 'node:assert/strict';
import fs from 'node:fs';
import { forcedLaborHeadingsForOrigin, isForcedLaborCountryHeading, requiresColumn1Comparison } from '../lib/ch99-forced-labor.mjs';

// Exercise the real screening handler for EVERY country/territory accepted by
// both the browser and API, not just the China and South Africa examples.
// Mocked official search rows make this a deterministic regression check;
// the test does NOT independently certify all rates, exclusions or legal notes.
const source=fs.readFileSync('netlify/functions/trade-rules.mts','utf8');
const ui=fs.readFileSync('js/hts-shipment.js','utf8');
const indexed=JSON.parse(fs.readFileSync('data/chapter99-index.json','utf8'));
const countrySet=source.match(/const ISO_COUNTRY_CODES=\x60([^\x60]+)\x60\.split\(\/\\s\+\/\)/);
const uiSet=ui.match(/const codes='([^']+)'\.split\(' '\)/);
assert.ok(countrySet&&uiSet,'Extract country lists from UI and API');
const countries=countrySet[1].split(' ');
const displayCountries=uiSet[1].split(' ');
assert.equal(countries.length,249,'Support all 249 ISO country/territory codes');
assert.equal(new Set(countries).size,249,'Duplicate country code in API');
assert.deepEqual([...countries].sort(),[...displayCountries].sort(),'UI and API must accept identical country codes');

globalThis.fetch=async (input)=>{
 const url=new URL(String(input));
 if(url.pathname.endsWith('/currentRelease'))return Response.json({description:'2026 HTS Revision '+indexed.htsRevision});
 if(url.pathname.endsWith('/search')){
   const key=url.searchParams.get('keyword')||'';
   const match=key.match(/^990305([2-8]\d)$/);
   if(match)return Response.json([{htsno:'9903.05.'+match[1],
     description:'Additional duties for the product of a designated origin, subject to U.S. note 52 exceptions',
     general:'The duty provided in the applicable subheading + 12.5%',
     other:'No change'}]);
   return Response.json([]);
 }
 throw Error('Unexpected URL '+url);
};
const {default:handler}=await import('../netlify/functions/trade-rules.mts');
function post({hts,country,smelt,entryDate='2026-10-30'}){
 return new Request('https://example.test/api/trade-rules',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({hts,country,meltPourCountry:smelt,entryDate,customsValue:100000,strictFacts:true})});
}
async function run(hts,country,smelt=''){
 const response=await handler(post({hts,country,smelt}));
 assert.equal(response.status,200,country+' '+hts+' must return valid response');
 const data=await response.json();
 assert.equal(data.query.country,country,'Origin must never be overwritten by metal origin');
 assert.equal(data.revisionVerified,true,hts+': index must match current revision');
 assert.equal(data.indexHts.revision,indexed.htsRevision);
 assert.equal(data.currentHts.revision,indexed.htsRevision);
 assert.ok(Array.isArray(data.measures));
 assert.ok(data.measures.length<80,'Candidate flood for '+hts+' '+country);
 const wrong=data.measures.filter(m=>isForcedLaborCountryHeading(m.hts)&&!forcedLaborHeadingsForOrigin(country).includes(m.hts));
 assert.deepEqual(wrong.map(x=>x.hts),[],country+' must not inherit another country origin tariffs');
 assert.ok(data.measures.every(m=>m.applicability!=='not-applicable'),'Unrelated candidates must be screened out');
 assert.ok(data.measures.every(m=>m.ratePercent==null||(m.ratePercent>=0&&m.ratePercent<=1000)),
  'Any published percent must be an actual numeric percentage');
 return data;
}

for(const code of ['8302','83024130','7206','7326','7610']){
 console.log('INDEX CODE',code,(indexed.codes[code]||[]).join(','));
}
for(const ref of ['9903.82.01','9903.82.02','9903.82.03','9903.82.04','9903.82.06','9903.82.09','9903.82.14','9903.82.18','9903.82.20','9903.82.21','9903.82.22','9903.82.23','9903.82.24','9903.82.25','9903.82.26']){
const m=indexed.headings[ref]||{};
console.log('INDEX HEADING',ref,JSON.stringify(m.text||'').slice(0,1600),'targets',(m.noteTargets||[]).join(','));
}
const families=['8302413000','7206100000','3919102055','8544422000','8716905060'];
let calls=0,originRows=0;
for(const country of countries){
 for(const hts of families){
  // Deliberately set a DIFFERENT smelt country: origin-specific rates must
  // always be controlled by merchandise origin, not by metal origin.
  const smelt=country==='CN'?'ZA':'CN';
  const data=await run(hts,country,smelt);calls++;
  const candidates=data.measures.filter(m=>isForcedLaborCountryHeading(m.hts));
  const expected=forcedLaborHeadingsForOrigin(country);
  assert.deepEqual(candidates.map(m=>m.hts).sort(),[...expected].sort(),
    country+' origin-wide Section 301 candidates under '+hts);
  for(const m of candidates){
   assert.equal(m.program,'Section 301');
   assert.equal(m.ratePercent,12.5,'Live published rate not decoded for '+country+' '+m.hts);
   if(requiresColumn1Comparison(m.hts))
     assert.equal(m.applicability,'review-required','Alternative preferential treatments need actual Column 1 comparison');
   originRows++;
  }
  if(country!=='CA') assert.ok(!data.measures.some(m=>m.program==='Section 338'),
   'Canada-only Section 338 rate incorrectly displayed for '+country);
 }
}
const us=await run('8302413000','US','CN');
assert.equal(us.measures.some(m=>m.hts==='9903.05.31'),false,'CN smelt cannot trigger a China-origin charge');
const china=await run('8302413000','CN','US');
assert.equal(china.measures.some(m=>m.hts==='9903.05.31'),true,'China-origin charge cannot be removed by US smelt');

async function withFacts(hts,country,facts){
  const req=new Request('https://example.test/api/trade-rules',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({hts,country,customsValue:100000,entryDate:'2026-10-30',strictFacts:true,...facts})});
  return (await handler(req)).json();
}
const unknownMetal=await withFacts('8302413000','CN',{meltPourCountry:'CN'});
assert.ok(unknownMetal.requiredFacts.includes('subjectMetalType'),
  'For a base-metal fitting, HTS 8302 does not identify the actual metal; ask for it before selecting Section 232');
const certifiedSteel=await withFacts('7206100000','CN',{meltPourCountry:'CN'});
assert.equal(certifiedSteel.requiredFacts.includes('subjectMetalType'),false,
  'Chapter 72 directly establishes steel; never ask the user to identify steel again');
assert.equal(certifiedSteel.measures.some(m=>m.hts==='9903.82.01'||m.hts==='9903.82.03'),false,
  'No-metal and under-15% exceptions are not valid for HTS Chapter 72');
const statedNone=await withFacts('8302413000','CN',{meltPourCountry:'CN',subjectMetalType:'none'});
assert.equal(statedNone.measures.some(m=>/^9903\\.82\\./.test(m.hts)&&m.hts!=='9903.82.01'),false,
  'When an article has no subject metal, all covered metal-treatment candidates must be screened out');
assert.ok(statedNone.measures.some(m=>m.hts==='9903.05.31'),
  'Metal conditions do not suppress country-based tariff screening');
console.log('PASS: automatic metal inference for chapters 72/73/74/76, single material question for base-metal fittings, and note 16 material exclusions.');
const invalid=await handler(post({hts:'8302413000',country:'XX',smelt:'CN'}));
assert.equal(invalid.status,400,'Invalid origin must be rejected, not silently fall back');

console.log('PASS: all 249 accepted country/territory origins across '+families.length+
 ' HTS families ('+calls+' trade-rule requests); '+originRows+
 ' matched country-wide published rate rows; smelt and origin stay independent. Official rows mocked for regression, not legal certification.');
