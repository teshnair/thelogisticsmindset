import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceDecision, entryDateError} from '../lib/tariff-decision.mjs';
import {note52Decision} from '../lib/note52-rules.mjs';
import {summarizeShipment} from '../lib/hts-shipment.mjs';
const index=JSON.parse(readFileSync('data/chapter99-index.json'));
assert.equal(index.htsRevision,23);
assert.equal(entryDateError('2026-02-30'),'Enter a valid calendar entry date.');
assert.equal(sourceDecision(index,{revision:24},'2026-11-13'),'source-stale');
assert.equal(sourceDecision(index,{revision:23},'2026-10-28'),'historical-source-required');
assert.equal(sourceDecision(index,{revision:23},'2099-01-01'),'future-source-required');
const purpose={importPurpose:'ordinary',ftaQualification:'no'};
const decide=(country,input=purpose,hts='4819400040',measures=[])=>note52Decision(index,input,hts,country,measures);
assert.equal(decide('CA',{}).state,'needs-facts');
assert.equal(decide('CA',{ftaQualification:'yes',usmcaDutyFree:true}).state,'not-applicable');
assert.equal(decide('CA').state,'applicable');
assert.equal(decide('CN').state,'applicable');
assert.equal(decide('ZA').state,'applicable');
assert.equal(decide('ZA',purpose,'0901110000').state,'not-applicable','Complete enumerated exemption list');
assert.equal(decide('CN',purpose,'7206100000',[{hts:'9903.82.02',program:'Section 232',applicability:'applicable'}]).state,'not-applicable');
assert.equal(decide('CN',purpose,'7604101000',[{hts:'9903.82.04',program:'Section 232',applicability:'needs-facts'}]).state,'review-required');
assert.equal(decide('CN',{importPurpose:'special'}).state,'needs-facts');
// Execute the public rule handler with deterministic official row fixtures.
globalThis.fetch=async input=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/currentRelease'))return Response.json({description:'2026 HTS Revision 23'});
  if(url.pathname.endsWith('/search')){
    const key=url.searchParams.get('keyword');
    const rates={'99030529':10,'99030531':12.5,'99030569':12.5,'99038803':25};
    if(['99038848','99038864','99038867'].includes(key))return Response.json([{htsno:key,description:'[Expired] exclusion through December 31, 2024',general:'Free'}]);
    const rate=rates[key];
    return Response.json(rate==null?[]:[{htsno:key,description:key==='99038803'?'Articles the product of China as provided for in U.S. note 20(f)':`Articles the product of ${key==='99030529'?'Canada':key==='99030531'?'China':'South Africa'}, as provided for in U.S. note 52 to this subchapter`,general:'The duty provided in the applicable subheading + '+rate+'%'}]);
  }
  throw Error('Unexpected source '+url);
};
const {default:handler}=await import('../netlify/functions/trade-rules.mts');
const call=async(country,extra={})=>(await handler(new Request('https://example.org/api/trade-rules',{method:'POST',body:JSON.stringify({hts:'4819400040',country,customsValue:10000,entryDate:'2026-11-13',strictFacts:true,...purpose,...extra})}))).json();
const ca=await call('CA');
assert.deepEqual(ca.measures.map(m=>[m.hts,m.estimatedDuty]),[['9903.05.29',1000]]);
assert.equal(ca.measures.some(m=>m.program==='Section 338'),false,'Canada scope amended in Revision 22');
assert.equal((await call('CA',{ftaQualification:'yes',usmcaDutyFree:true})).measures.length,0);
assert.deepEqual((await call('CN')).measures.map(m=>m.hts),['9903.05.31','9903.88.03']);
assert.deepEqual((await call('ZA')).measures.map(m=>m.hts),['9903.05.69']);
const old=await call('CA',{entryDate:'2026-10-28'});
assert.equal(old.status,'historical-source-required');assert.deepEqual(old.measures,[]);
const summary=summarizeShipment([{input:{country:'CA',usmcaDutyFree:true,customsValue:10000},estimate:{ordinary:{amount:0},knownTariffs:0,tariffTotal:0,complete:true}}],'land','2026-11-13');
assert.equal(summary.mpf,0);assert.equal(summary.hmf,0);assert.equal(summary.total,0);
console.log('PASS: Canada land, USMCA, China, ZA, steel/aluminum sectoral precedence, source/date failures and exempt shipment fees.');

