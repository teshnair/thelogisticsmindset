import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const index=JSON.parse(readFileSync('data/chapter99-index.json','utf8'));
assert.equal(index.htsRevision,23);
const rates={99038804:25,99038815:7.5,99030531:12.5,99030120:10,99030301:10};
globalThis.fetch=async (input)=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/currentRelease'))return Response.json({description:'2026 HTS Revision 23'});
  if(url.pathname.endsWith('/search')){
    const key=url.searchParams.get('keyword');
    const rate=rates[key];
    return Response.json(rate==null?[]:[{htsno:key,description:'Articles the product of China as provided for in Chapter 99; relevant exclusions apply',general:'The duty provided in the applicable subheading + '+rate+'%'}]);
  }
  throw Error('Unexpected live fetch '+url);
};
const {default:handler}=await import('../netlify/functions/trade-rules.mts');
const run=async(hts,entryDate='2026-11-18')=>{
  const response=await handler(new Request('https://example.org/api/trade-rules',{method:'POST',body:JSON.stringify({hts,country:'CN',customsValue:1000,entryDate,importPurpose:'ordinary',ftaQualification:'no',strictFacts:true})}));
  assert(response.ok);
  return response.json();
};
const exact=await run('8517620090');
console.log('Active 8517.62.0090 headings:',exact.measures.map(m=>m.hts+': '+m.ratePercent+'% ('+m.applicability+')').join('; '));
assert.equal(exact.revisionVerified,true);
assert(!exact.measures.some(m=>m.hts==='9903.88.04'),'Note 20(g)(2) specifically excludes suffix .0090');
assert(exact.measures.some(m=>m.hts==='9903.88.15'&&m.ratePercent===7.5),'Note 20(s)(ii) 7.5% rate must be present');
assert(!exact.measures.some(m=>/^9903\\.0[12]\\./.test(m.hts)),'Expired IEEPA measures must be excluded');
assert(!exact.measures.some(m=>/^9903\\.03\\.(?:0[1-9]|1[01])$/.test(m.hts)),'Expired Section 122 must be excluded');
assert.equal(exact.note52Exemption?.hts,'9903.05.86','Note 52(b) classifies 8517.62.00 as exempt from the country-wide 12.5% surcharge');
assert(!exact.measures.some(m=>m.hts==='9903.05.31'),'Exempt heading should not be included as a surcharge');
assert(!exact.measures.some(m=>m.hts==='9903.05.86'),'Exemption heading must be shown as basis, not as an unpriced surcharge');
assert(!exact.measures.some(m=>m.hts.startsWith('9903.02.')),'Expired IEEPA heading flood must not appear');
assert(exact.measures.length<20,'Only relevant active Chapter 99 provisions should be shown');
assert.deepEqual(exact.measures.map(m=>m.hts),['9903.88.15'],'Only the active List 4A tariff should remain for the stated ordinary-entry facts');
const {worstCaseEstimate}=await import('../lib/hts-worst-case.mjs');
const screening=worstCaseEstimate({hts:'8517620090',country:'CN',customsValue:1000,importPurpose:'ordinary',ftaQualification:'no',entryDate:'2026-11-18'},{appliedRate:'Free'},exact,index);
assert.equal(screening.complete,true,'No expired tariff should leave the 8517 calculation incomplete');
assert.equal(screening.additionalDuty,75,'7.5% on $1,000 is $75, not $590');
assert.equal(screening.totalDuty,75);
assert.deepEqual(screening.measures.map(m=>m.hts),['9903.88.15']);
const other=await run('8517620010');
assert(!other.measures.some(m=>m.hts==='9903.88.15'&&m.applicability==='applicable'),'Sibling suffix must not inherit .0090 List 4A exception');
console.log('PASS: China 8517.62.0090 specific Chapter 99, expired IEEPA/Section 122, sibling suffix');
