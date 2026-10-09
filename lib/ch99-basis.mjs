// Evidence-based Chapter 99 eligibility descriptions.
// Do not infer an exemption or a missing origin condition from an HTS match alone.
const tidy = value => String(value ?? '').replace(/<\/?il>/gi,'').replace(/\s+/g,' ').trim();
const unique = values => [...new Set(values.filter(Boolean))];
const shorter = (value,max=340) => {
  const s=tidy(value).replace(/^99\d{2}\.\d{2}\.\d{2}\s*/, '');
  if(s.length<=max)return s;
  const at=s.lastIndexOf('; ',max);
  return s.slice(0,at>max/2?at:max).trim().replace(/[\s,;:.]+$/,'')+'…';
};
export function formatUsNote(target){
  const parts=String(target??'').split(':').filter(Boolean);
  if(!parts.length)return '';
  if(!/^\d+$/.test(parts[0]))return String(target);
  return 'U.S. note '+parts[0]+parts.slice(1).map(x=>'('+x+')').join('');
}
const FACT_LABELS={
  containsAluminumSteelCopper:'Whether the article contains aluminum, steel or copper',
  subjectMetalWeightPercent:'Percent of the imported article weight that is subject metal',
  usMetalContentQualification:'Evidence of U.S. smelt/cast or melt/pour for each covered metal',
  ukMetalContentQualification:'Evidence of U.K. smelt/cast or melt/pour for each covered metal',
  meltPourCountry:'Country of first melt/pour or smelt/cast (as relevant)',
  metalContentValue:'Value attributable to covered metal content',
  usContentValue:'U.S.-origin content value',
  nonUsContentValue:'Non-U.S.-origin content value',
  column2CountryStatus:'Eligibility under General Note 3(b) (Column 2 origin)',
  vehiclePartCategory:'Whether the article is a passenger/light-duty or medium/heavy-duty vehicle part',
  mhdProductionRepairCertification:'Medium/heavy-duty vehicle production or repair certification',
  vehicleManufactureYear:'Year the vehicle was manufactured',
  nonUsVehicleContentValue:'Non-U.S. vehicle content value',
  commerceApproval:'Department of Commerce approval',
  approvalStatus:'Required approval/certificate',
  quotaEligibility:'Applicable quota eligibility and availability',
  ftaQualification:'Applicable preference / USMCA qualification',
  productSpecificCondition:'Whether the exact product meets the cited tariff provision'
};
export function describeMissingFact(key){
  const s=String(key??'');
  if(s.startsWith('productCondition:'))return 'Whether the product meets the specific conditions of '+s.split(':')[1];
  return FACT_LABELS[s]||s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
}
const mentions = (t,regex) => regex.test(tidy(t));
function summariseConditions(heading,meta,measure,country){
  const clauses=[];
  const add=s=>{if(s&&!clauses.includes(s))clauses.push(s);};
  const row=tidy(heading);
  const note=key=>tidy(meta?.legalContext?.[key]);
  const targets=new Set(meta?.noteTargets||[]);
  // Require the origin to appear in the operative heading. Related notes may
  // mention other countries as exceptions and must not set a positive origin.
  const origins=[
    [/\b(?:products?|articles?|goods?)\s+(?:the\s+)?products?\s+of\s+(?:the\s+)?japan\b|\b(?:products?|articles?|goods?)\s+(?:of|from)\s+japan\b/i,'Japan origin'],
    [/\b(?:products?|articles?|goods?)\s+(?:the\s+)?products?\s+of\s+(?:the\s+)?russian federation\b|\b(?:products?|articles?|goods?)\s+(?:of|from)\s+(?:the\s+)?russian federation\b/i,'Russian Federation origin'],
    [/\b(?:products?|articles?|goods?)\s+(?:the\s+)?products?\s+of\s+(?:the\s+)?united kingdom\b|\b(?:products?|articles?|goods?)\s+(?:of|from)\s+(?:the\s+)?united kingdom\b/i,'United Kingdom origin'],
    [/\b(?:products?|articles?|goods?)\s+(?:the\s+)?products?\s+of\s+(?:the\s+)?china\b|\b(?:products?|articles?|goods?)\s+(?:of|from)\s+china\b/i,'China origin'],
    [/\b(?:products?|articles?|goods?)\s+(?:the\s+)?products?\s+of\s+(?:the\s+)?canada\b|\b(?:products?|articles?|goods?)\s+(?:of|from)\s+canada\b/i,'Canada origin']
  ];
  for(const [re,label] of origins)if(re.test(row))add(label);
  if(targets.has('51:b'))add('Canada origin and the specific articles enumerated in U.S. note 51(b)');
  if(targets.has('20:b')||targets.has('20:d')||targets.has('20:f')||targets.has('20:g'))add('China-origin merchandise covered by the cited Section 301 list');
  const metals85=note('16:e');
  if(targets.has('16:e')&&mentions(metals85,/\bat least\s+85\s*(?:percent|%)/i)&&mentions(metals85,/united states/i)){
    add('At least 85% U.S.-smelted/cast aluminum or copper, or U.S.-melted/poured steel content, for each covered metal as applicable; mixed-metal qualifications are cumulative');
  }
  const uk=note('16:d');
  if(targets.has('16:d')&&mentions(uk,/\bat least\s+95\s*(?:percent|%)/i)&&mentions(uk,/united kingdom/i)){
    add('United Kingdom origin, with at least 95% qualifying U.K. aluminum smelt/cast or steel melt/pour content as applicable');
  }
  if(measure.hts==='9903.82.03')add('Applicable metal weight below 15% of imported article weight; excludes chapters 72, 73, 74 and 76');
  if(measure.hts==='9903.82.01')add('Article contains no aluminum, steel or copper');
  if(targets.has('33:e'))add('Vehicle at least 25 years old, subject to U.S. note 33(e)');
  if(targets.has('33:d'))add('USMCA vehicle and approved non-U.S. content treatment under U.S. note 33(d)');
  if(targets.has('16:j'))add('Qualifying Canada/Mexico USMCA derivative steel articles under U.S. note 16(j)');
  if(targets.has('38:j'))add('Certified medium/heavy-duty vehicle parts under U.S. note 38(j), excluding chapters 72, 73 and 76');
  // Exceptions are alternatives, never evidence that an exemption was met.
  const except=unique((measure.exceptionRefs||[]).slice(0,12));
  if(except.length)add('Except where '+except.join(', ')+' applies; verify the referenced exemption separately');
  else if(/\bexcept(?:\s+as\s+provided)?\b/i.test(row))add('Exceptions are specified in the published heading text; verify them before applying this provision');
  return clauses;
}
function notePreview(source,measure){
  const s=tidy(source);
  if(!s)return null;
  // The index stores at most 5,000 characters for most notes. Never describe a
  // shortened extract as the complete legal text.
  const direct=s.match(/(?:at least|less than|more than|not more than|except for|except as provided|apply to|applies to)[^.]{0,240}/i);
  const evidence=direct?.[0]||s;
  return shorter(evidence,240);
}
export function buildChapter99Basis(measure,meta,country){
  const row=tidy(measure?.description||meta?.text);
  const targets=unique(meta?.noteTargets||measure?.noteTargets||[]);
  const noteRefs=targets.map(formatUsNote);
  const legalNotes=targets.map(t=>({reference:formatUsNote(t),excerpt:notePreview(meta?.legalContext?.[t],measure)}));
  const eligibility=summariseConditions(row,meta,measure,country);
  const missing=unique(measure?.requiredFacts||[]).map(describeMissingFact);
  const status=measure?.applicability==='applicable'?'Applicable':
    measure?.applicability==='not-applicable'?'Not applicable':
    measure?.applicability==='review-required'?'Review required':'Undetermined';
  const rawReason=tidy(measure?.reason);
  const generic=/^additional shipment facts are required to determine this chapter 99 treatment\.?$/i;
  const reason=!generic.test(rawReason)?rawReason:'Eligibility cannot be established until the listed information is supplied.';
  const mutuallyExclusiveGroup=measure?.mutuallyExclusiveGroup||null;
  return {
    status,
    headingSummary:shorter(row,350)||'Official heading description unavailable; inspect the linked USITC tariff provision.',
    eligibility,
    noteRefs,
    legalNotes,
    missingFacts:missing,
    reason,
    mutuallyExclusiveGroup,
    // The HTS index links notes to candidate headings; it does not by itself
    // establish that a product satisfies an exclusion or special condition.
    legalScope:'Candidate heading and related legal-note excerpts, not an independent customs ruling.',
    liveHeadingVerified:Boolean(measure?.liveHeadingVerified)
  };
}
