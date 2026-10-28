import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {forcedLaborHeadingsForOrigin,isForcedLaborCountryHeading,forcedLaborHeadingMatchesOrigin,requiresColumn1Comparison} from '../lib/ch99-forced-labor.mjs';
import {explicitHeadingNoteTargets,buildChapter99Basis} from '../lib/ch99-basis.mjs';

// CBP CSMS #69326983, July 23, 2026. The code after .05 is not
// derived from the product's tariff heading: it is dictated by origin.
for(const [origin,heading] of Object.entries({DZ:'9903.05.20',CA:'9903.05.29',CL:'9903.05.30',CN:'9903.05.31',CO:'9903.05.32',MX:'9903.05.55',ZA:'9903.05.69',GB:'9903.05.81'})){
  assert.deepEqual(forcedLaborHeadingsForOrigin(origin),[heading],origin+' origin dispatch');
  assert.equal(forcedLaborHeadingMatchesOrigin(heading,origin),true);
  assert.equal(isForcedLaborCountryHeading(heading),true);
}
assert.equal(forcedLaborHeadingMatchesOrigin('9903.05.30','CO'),false,'Chile cannot appear as Colombia Section 301 country rate');
assert.deepEqual(forcedLaborHeadingsForOrigin('US'),[],'US-origin goods are not among the 60 listed economies');
assert.deepEqual(forcedLaborHeadingsForOrigin('JP'),['9903.05.48','9903.05.49']);
assert.deepEqual(forcedLaborHeadingsForOrigin('DE'),['9903.05.38','9903.05.39']);
assert.deepEqual(forcedLaborHeadingsForOrigin('KR'),['9903.05.70','9903.05.71']);
assert.deepEqual(forcedLaborHeadingsForOrigin('CH'),['9903.05.73','9903.05.74']);
assert.deepEqual(forcedLaborHeadingsForOrigin('TW'),['9903.05.75','9903.05.76']);
assert.equal(requiresColumn1Comparison('9903.05.48'),true);
assert.equal(requiresColumn1Comparison('9903.05.32'),false);
const donation='Articles that are donations of food and clothing intended to relieve human suffering, as provided for in subdivision (v)(ii) of U.S. note 2 to this subchapter';
assert.deepEqual(explicitHeadingNoteTargets(donation),['2:v:ii']);
const donationBasis=buildChapter99Basis(
  {hts:'9903.01.30',description:donation,applicability:'review-required',reason:'Donation status not established',noteTargets:['2:a','2:v','2:v:ii']},
  {text:donation,noteTargets:['2:a','2:v','2:v:ii'],legalContext:{'2:a':'(a) Goods of Mexico; unrelated to donation exemption','2:v:ii':'(a) Goods of Mexico; unrelated to donation exemption'}},'CO'
);
assert.deepEqual(donationBasis.noteRefs,['U.S. note 2(v)(ii)']);
assert.equal(donationBasis.legalNotes.some(n=>n.excerpt&&n.excerpt.includes('Mexico')),false,'Do not display unrelated Mexican note text for Colombian donation exception');

// Exercise real deployed handler logic under isolated official-source stubs.
// Fail if a country-specific code is omitted, if foreign codes leak, or if
// column 2 "No change" overrides the positive column 1 Section 301 rate.
const liveSearches=[];
globalThis.fetch=async input=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/currentRelease'))return Response.json({description:'2026 HTS Revision 21',date:'2026-10-09'});
  if(url.pathname.endsWith('/search')){
    const key=url.searchParams.get('keyword')||'';
    liveSearches.push(key);
    if(key==='99030532')return Response.json([{htsno:'9903.05.32',description:'Except for products described in headings 9903.05.85–9903.05.92, articles the product of Colombia, as provided for in U.S. note 52 to this subchapter',general:'The duty provided in the applicable subheading + 12.5%',other:'No change'}]);
    return Response.json([]);
  }
  throw new Error('Unexpected source URL '+url);
};
const {default: handler}=await import('../netlify/functions/trade-rules.mts');
const post=body=>new Request('https://example.org/api/trade-rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const check=async (hts,country)=>{
  const res=await handler(post({hts,country,customsValue:36000,entryDate:'2026-10-28',strictFacts:true}));
  assert.equal(res.ok,true,'API must return success for '+country);
  return res.json();
};
const co=await check('2008991500','CO');
assert.equal(co.revisionVerified,true);
const forced=co.measures.filter(m=>isForcedLaborCountryHeading(m.hts));
assert.deepEqual(forced.map(m=>m.hts),['9903.05.32'],'Use Colombia heading 9903.05.32 and not Chile or China');
assert.equal(forced[0].program,'Section 301');
assert.equal(forced[0].ratePercent,12.5,'Column 1 +12.5% is controlling even if Column 2 says No change');
assert.equal(co.measures.some(m=>m.hts==='9903.05.30'||m.hts==='9903.05.31'),false);
assert.equal(co.measures.some(m=>m.hts==='9903.01.30'&&m.basis?.legalNotes?.some(n=>n.excerpt&&n.excerpt.includes('Mexico'))),false);
const cl=await check('2008991500','CL');
assert.deepEqual(cl.measures.filter(m=>isForcedLaborCountryHeading(m.hts)).map(m=>m.hts),['9903.05.30']);
assert.ok(liveSearches.includes('99030532'));
console.log('PASS: Colombia 9903.05.32; Chile 9903.05.30; Section 301 Column 1 rate; legal-note specificity; EU/Japan paired rates flagged.');
