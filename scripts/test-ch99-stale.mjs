import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const index=JSON.parse(readFileSync(new URL('../data/chapter99-index.json',import.meta.url),'utf8'));
const next=index.htsRevision+1;
const requested=[];
globalThis.fetch=async input=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/currentRelease'))return Response.json({description:`2026 HTS Revision ${next}`});
  if(url.pathname.endsWith('/search')){
    const key=url.searchParams.get('keyword')||'';
    requested.push(key);
    if(key==='99030531')return Response.json([{htsno:'9903.05.31',description:'Articles the product of China, subject to U.S. note 52 exceptions',general:'The duty provided in the applicable subheading + 12.5%'}]);
    return Response.json([]);
  }
  throw Error('Unexpected URL: '+url);
};
const {default:handler}=await import('../netlify/functions/trade-rules.mts');
const check=async (country,smelt)=>{const res=await handler(new Request('https://example.org/api/trade-rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hts:'8302413000',country,meltPourCountry:smelt,customsValue:100000,entryDate:'2026-10-30'})}));assert.equal(res.ok,true);return res.json();};
const china=await check('CN','CN');
assert.equal(china.status,'source-stale');
assert.equal(china.revisionVerified,false);
assert.equal(china.indexHts.revision,index.htsRevision);
assert.equal(china.currentHts.revision,next);
assert.ok(china.historicalIndexCandidateCount>0);
assert.ok(china.measures.length<=1,'Stale Chapter 99 candidate flood was not filtered');
assert.ok(china.measures.every(m=>m.hts==='9903.05.31'),'Unverified product-specific headings must never leak');
assert.ok(china.measures.every(m=>m.applicability==='review-required'&&m.estimatedDuty===null),'Do not establish payable amounts from an outdated index');
assert.equal(china.measures[0]?.ratePercent,12.5,'An independently fetched current origin-wide published percentage can be displayed, without an assessment');
const usa=await check('US','CN');
assert.equal(usa.status,'source-stale');
assert.deepEqual(usa.measures,[],'A China smelt country is not automatically China merchandise origin');
assert.ok(!requested.includes('99030281'),'Never request unrelated historical Swiss/civil aircraft headings');
assert.match(usa.message,/updated|update|refreshed/i);
console.log('PASS: HTS revision mismatch suppresses historical candidate flood, displays only independently verified published rate without amount, and does not conflate China smelt with country of origin.');
