import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import handler from '../netlify/functions/trade-rules.mts';
const index=JSON.parse(fs.readFileSync('data/chapter99-index.json','utf8'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'note31-'));
try {
  execFileSync('python3',['scripts/build-chapter99-index.py','scripts/fixtures/chapter99-note31-rev20.txt',path.join(dir,'index.json')]);
  const rebuilt=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
  for(const data of [index,rebuilt]) {
    for(const c of ['87169050','87169030','8716390090']) {
      const refs=data.codes[c]||[];
      assert(refs.includes('9903.91.12')&&refs.includes('9903.91.13'),c);
      for(const bad of ['9903.91.03','9903.91.11','9903.91.14']) assert(!refs.includes(bad),`${c}: false match ${bad}`);
    }
    assert(!(data.codes['87163900']||[]).includes('9903.91.12'),'Do not broaden an exact statistical suffix');
    const actual=Object.entries(data.codes).filter(([,refs])=>refs.includes('9903.91.03')).map(([c])=>c).sort();
    assert.deepEqual(actual,['87024031','87024061','87029031','87029061','87036000','87037000','87038000','87039001','90183100','90183200']);
    assert((data.codes['81019400']||[]).includes('9903.91.11'));
    assert((data.codes['40151210']||[]).includes('9903.91.08'));
    assert.deepEqual(data.headings['9903.91.12'].noteTargets,['31:k:i']);
    assert.deepEqual(data.headings['9903.91.13'].noteTargets,['31:k:ii']);
  }
} finally {fs.rmSync(dir,{recursive:true,force:true});}
// Official operative-row wording for the two alternatives; no live network in tests.
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/currentRelease'))return Response.json({description:'2026 HTS Revision 20'});
  const code=u.searchParams.get('keyword');
  const ref=code?.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1.$2.$3');
  const meta=index.headings[ref];
  if(!meta)return Response.json([]);
  return Response.json([{htsno:ref,description:meta.text,general:ref==='9903.91.12'?'The duty provided in subheadings 8716.39.00, 8716.90.30 or 8716.90.50 + 100%':ref==='9903.91.13'?'The duty provided in the applicable subheading':''}]);
};
const run=async(extra={})=>(await handler(new Request('https://example.test/api/trade-rules',{method:'POST',body:JSON.stringify({hts:'8716905060',country:'CN',customsValue:1000,strictFacts:true,entryDate:'2026-10-02',...extra})}))).json();
const pair=r=>r.measures.filter(m=>['9903.91.12','9903.91.13'].includes(m.hts));
try {
  for(const entryDate of ['2026-10-02','2026-11-09']) {
    const r=await run({entryDate});assert.equal(pair(r).length,0);
    assert(r.supplementalNotices.some(n=>n.kind==='section301-chassis'&&n.status==='suspended'));
    assert(!r.measures.some(m=>m.hts==='9903.91.03'));
  }
  const unknown=await run({entryDate:'2026-11-10'});
  assert.equal(pair(unknown).length,2);
  assert(pair(unknown).every(m=>m.applicability==='needs-facts'&&m.estimatedDuty===null));
  for(const scope of ['yes','no']) {
    const r=await run({entryDate:'2026-11-10',intermodalChassisScope:scope});
    const selected=pair(r);assert.equal(selected.length,1);
    assert.equal(selected[0].hts,scope==='yes'?'9903.91.12':'9903.91.13');
    assert.equal(selected[0].program,'Section 301');
    assert.equal(selected[0].estimatedDuty,scope==='yes'?1000:0);
  }
  assert.equal(pair(await run({country:'DE',entryDate:'2026-11-10'})).length,0);
  assert.equal(pair(await run({hts:'8716390030',entryDate:'2026-11-10'})).length,0);
} finally {globalThis.fetch=originalFetch;}
console.log('Note 31 tests passed: exact legal scope, nested letters, statistical suffixes, suspension boundary, origin and exclusive chassis alternatives.');
