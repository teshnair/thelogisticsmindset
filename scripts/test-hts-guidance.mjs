import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classificationChoices,lineGuidance,productConditionDescriptions} from '../lib/hts-guidance.mjs';
const choices=[{hts:'8427.10',code:'842710',description:'Electric trucks'},{hts:'8427.10.40',code:'84271040',description:'Rider-type, counterbalanced'},{hts:'8427.10.40.10',code:'8427104010',description:'Fuel cell'},{hts:'8427.10.40.90',code:'8427104090',description:'Other'},{hts:'8427.10.80',code:'84271080',description:'Other trucks'}];
assert.deepEqual(classificationChoices(choices,'842710').map(c=>c.hts),['84271040','84271080'],'Offer the next classification decision, never guess a statistical suffix');
assert.deepEqual(classificationChoices(choices,'84271040').map(c=>c.hts),['8427104010','8427104090']);
assert.equal(lineGuidance({hts:'8427.10'},{measures:[]},{}).state,'needs-classification');
assert.deepEqual(lineGuidance({hts:'8431200000'},{complete:false,measures:[],warnings:[],ordinary:{}},{requiredFacts:['containsAluminumSteelCopper','containsAluminumSteelCopper']}).questions,['containsAluminumSteelCopper']);
const index=JSON.parse(readFileSync('data/chapter99-index.json'));
const descriptions=productConditionDescriptions([{requiredFacts:['productCondition:9903.88.69'],sourceContext:index.headings['9903.88.69'].legalContext['20:vvv']}],'8431200000');
assert.ok(descriptions['productCondition:9903.88.69'].some(s=>/Counterweight|Tines/i.test(s)),'Explain the actual exclusion product descriptions');
const fixture=JSON.parse(readFileSync('scripts/fixtures/hts-8431-rev23.json'));
globalThis.fetch=async input=>{
  const u=new URL(String(input));
  if(u.pathname.endsWith('/currentRelease'))return Response.json({description:'2026 HTS Revision 23'});
  if(u.pathname.endsWith('/search')){
    const k=u.searchParams.get('keyword');
    if(k.startsWith('99'))return Response.json(fixture.rows[k]||[]);
    if(k.startsWith('8427'))return Response.json(choices.map(c=>({htsno:c.hts,description:c.description,indent:c.code.length===6?1:c.code.length===8?2:3,general:c.code.length===8?'Free':'',units:['No.']})));
    return Response.json([{htsno:'8431',description:'Parts',indent:0,general:''},{htsno:'8431.20.00.00',description:'Of machinery of heading 8427',indent:1,general:'Free',units:['No.']}]);
  }
  throw Error('No external fee call in deterministic tests');
};
const {default:handler}=await import('../netlify/functions/hts-line.mts');
const call=async body=>{const r=await handler(new Request('https://example.org/api/hts-line',{method:'POST',body:JSON.stringify({country:'CN',entryDate:'2026-11-17',mode:'ocean',importPurpose:'ordinary',ftaQualification:'no',...body})}));assert.equal(r.status,200);return r.json();};
const line1=await call({hts:'8431.20.00.00',customsValue:30000});
const line2=await call({hts:'8427.10',customsValue:4944});
assert.equal(line1.guidance.state,'needs-details');
assert.ok(line1.guidance.questions.includes('containsAluminumSteelCopper'));
assert.ok(line1.guidance.questions.includes('meltPourCountry'));
assert.ok(line1.guidance.productConditions['productCondition:9903.88.69'].length);
assert.equal(line2.guidance.state,'needs-classification');
assert.equal(line2.guidance.choices.length,2);
assert.equal(line2.estimate.complete,false);
const resolved=await call({hts:'8431200000',customsValue:30000,meltPourCountry:'CN',containsAluminumSteelCopper:'yes',subjectMetalWeightPercent:100,usMetalContentQualification:'no','productCondition:9903.88.69':'no'});
assert.equal(resolved.guidance.state,'complete');assert.equal(resolved.estimate.tariffTotal,15000);
console.log('PASS: exact pasted two-line inputs, explicit classification choices, product descriptions, missing metal origin, and one resolved duty amount.');
