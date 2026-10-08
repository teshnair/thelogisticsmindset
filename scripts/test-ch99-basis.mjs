import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildChapter99Basis,formatUsNote} from '../lib/ch99-basis.mjs';

assert.equal(formatUsNote('16:e'),'U.S. note 16(e)');
assert.equal(formatUsNote('38:h:i'),'U.S. note 38(h)(i)');

const note85='For derivative articles at least 85 percent of the aluminum content must be composed of aluminum smelted and cast in the United States. These requirements are cumulative.';
const us=buildChapter99Basis({
  hts:'9903.82.23',applicability:'needs-facts',noteTargets:['16:e','16:c:ii'],
  description:'Covered derivative articles as provided for in U.S. note 16(e)',
  requiredFacts:['usMetalContentQualification'],
  reason:'Additional shipment facts are required to determine this Chapter 99 treatment.'
},{noteTargets:['16:e','16:c:ii'],legalContext:{'16:e':note85}},'JP');
assert.equal(us.status,'Undetermined');
assert.ok(us.eligibility.some(x=>x.includes('85% U.S.')));
assert.ok(us.noteRefs.includes('U.S. note 16(e)'));
assert.ok(us.missingFacts.some(x=>x.includes('smelt')));
assert.ok(us.legalNotes[0].excerpt.includes('85 percent'));

const noThreshold=buildChapter99Basis({
  hts:'9903.82.23',applicability:'review-required',noteTargets:['16:e'],
  description:'Derivative steel products',requiredFacts:[],reason:'Manual review is required'
},{noteTargets:['16:e'],legalContext:{'16:e':'A rule with no stated percentage.'}},'JP');
assert.ok(!noThreshold.eligibility.some(x=>x.includes('85%')),'Never invent numeric thresholds');
assert.equal(noThreshold.status,'Review required');

const uk=buildChapter99Basis({
  hts:'9903.82.04',applicability:'needs-facts',
  description:'Articles the product of the United Kingdom qualifying under U.S. note 16(d)',
  requiredFacts:['ukMetalContentQualification']
},{noteTargets:['16:d'],legalContext:{'16:d':'At least 95 percent of the aluminum was smelted or cast in the United Kingdom.'}},'GB');
assert.ok(uk.eligibility.some(x=>x.includes('95%')));
assert.ok(uk.eligibility.some(x=>x.includes('United Kingdom origin')));

const japan=buildChapter99Basis({
  hts:'9903.94.05',applicability:'needs-facts',
  description:'Except for products described in headings 9903.94.01 and 9903.94.02, articles the product of Japan.',
  exceptionRefs:['9903.94.01','9903.94.02'],
  requiredFacts:['productCondition:9903.94.05']
},{noteTargets:['33:a'],legalContext:{}},'JP');
assert.ok(japan.eligibility.includes('Japan origin'));
assert.ok(japan.eligibility.some(x=>x.includes('9903.94.01')));
assert.ok(japan.missingFacts.some(x=>x.includes('9903.94.05')));

const russia=buildChapter99Basis({
  hts:'9903.90.08',applicability:'applicable',
  description:'Articles the product of the Russian Federation.',requiredFacts:[],reason:'Origin matches.'
},{noteTargets:['30:a'],legalContext:{}},'RU');
assert.ok(russia.eligibility.includes('Russian Federation origin'));
assert.equal(russia.status,'Applicable');
assert.ok(russia.noteRefs.includes('U.S. note 30(a)'));

const alt=buildChapter99Basis({
  hts:'9903.82.02',applicability:'needs-facts',
  description:'Steel derivatives',mutuallyExclusiveGroup:'9903.82.02-9903.82.26',
  requiredFacts:['containsAluminumSteelCopper']
},{noteTargets:['16:c:i'],legalContext:{}},'CA');
assert.equal(alt.mutuallyExclusiveGroup,'9903.82.02-9903.82.26');

console.log('Chapter 99 status/basis tests passed: legal notes, U.S. and U.K. thresholds, Japan exclusions, Russia, mutually exclusive headings and missing facts.');

const legalIndex=JSON.parse(fs.readFileSync('data/chapter99-index.json','utf8'));
assert.equal(legalIndex.htsRevision,20,'Tests must use the currently reviewed Chapter 99 revision');
for (const [hts,noteRef,condition] of [
  ['9903.82.06','U.S. note 16(e)','85%'],
  ['9903.82.04','U.S. note 16(d)','95%'],
  ['9903.03.14','U.S. note 51(b)',null]
]) {
  const meta=legalIndex.headings[hts];
  assert.ok(meta,`Indexed heading ${hts} must exist`);
  const data=buildChapter99Basis({hts,description:meta.text,applicability:'needs-facts',requiredFacts:[]},meta,'CA');
  assert.ok(data.noteRefs.includes(noteRef),`${hts} must cite ${noteRef}`);
  if(condition)assert.ok(data.eligibility.some(v=>v.includes(condition)),`${hts} must summarize the legal threshold ${condition} from the current source`);
}
console.log('Live Chapter 99 index legal-note linkage checks passed.');
