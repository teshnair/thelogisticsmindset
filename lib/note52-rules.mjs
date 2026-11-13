import {isQualified} from './tariff-decision.mjs';

const listed = (text, hts) => [...String(text || '').matchAll(/\b\d{4}\.\d{2}(?:\.\d{2,4})?\b/g)]
  .some(m => hts.startsWith(m[0].replace(/\D/g, '')));

// U.S. note 52: evaluate exemptions before the country-wide surcharge.
export function note52Decision(index, input, hts, country, measures) {
  const notes = index.legalNotes || {};
  if (!notes['52:a'] || !notes['52:b']) return {state:'review-required', reason:'Complete U.S. note 52 is unavailable.', requiredFacts:[]};
  if (listed(notes['52:b'], hts)) return {state:'not-applicable', reason:'U.S. note 52(b), heading 9903.05.86, excludes this classification.', requiredFacts:[]};
  if (['CA','MX'].includes(country)) {
    if (isQualified(input.ftaQualification) && input.usmcaDutyFree === true)
      return {state:'not-applicable', reason:`U.S. note 52(${country==='CA'?'g':'h'}), heading ${country==='CA'?'9903.05.93':'9903.05.94'}: confirmed duty-free USMCA entry.`, requiredFacts:[]};
    if (input.ftaQualification == null || input.ftaQualification === '')
      return {state:'needs-facts', reason:'Confirm USMCA eligibility; Canadian or Mexican origin alone does not establish the exemption.', requiredFacts:['ftaQualification']};
    if (isQualified(input.ftaQualification) && input.usmcaDutyFree !== true)
      return {state:'review-required', reason:'The exemption requires a verified duty-free USMCA entry.', requiredFacts:[]};
  }
  const sectoral = measures.filter(m => m.applicability === 'applicable' && /9903\.(82\.(02|0[4-9]|1\d|2[0-6])|94\.|74\.|76\.|79\.01|04\.6)/.test(m.hts));
  if (sectoral.length) return {state:'not-applicable',reason:'U.S. note 52(f) sectoral exemption: '+sectoral.map(m=>m.hts).join(', '),requiredFacts:[]};
  if (measures.some(m => m.program==='Section 232' && m.applicability!=='not-applicable'))
    return {state:'review-required',reason:'Resolve Section 232 treatment before applying the U.S. note 52(f) exemption.',requiredFacts:[]};
  if (listed(notes['52:c'],hts) || listed(notes['52:d'],hts) || listed(notes['52:e'],hts))
    return {state:'review-required',reason:'The classification has a product or end-use exemption under U.S. note 52(c)-(e).',requiredFacts:[]};
  if (input.importPurpose !== 'ordinary') return {state:'needs-facts',reason:'Confirm an ordinary commercial entry. Chapter 98, donations, informational materials and personal baggage require separate treatment.',requiredFacts:['importPurpose']};
  return {state:'applicable',reason:'Country-wide surcharge; ordinary commercial entry, no enumerated classification, USMCA or sectoral exemption established.',requiredFacts:[]};
}

