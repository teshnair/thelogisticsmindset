const code = value => String(value || '').replace(/\D/g, '');

export function classificationChoices(suggestions, prefix) {
  const descendants=suggestions.filter(s => code(s.code || s.hts).length > code(prefix).length && code(s.code || s.hts).startsWith(code(prefix)));
  const depth=Math.min(...descendants.map(s=>code(s.code||s.hts).length));
  return descendants.filter(s=>code(s.code||s.hts).length===depth)
    .map(s => ({hts: s.code || code(s.hts), displayHts: s.hts, description: s.descriptionPath || s.description, units: s.units || []}));
}

export function lineGuidance(input, estimate, rules) {
  if (code(input.hts).length !== 10) return {state:'needs-classification', title:'Choose the complete product classification', message:'This is a product family. Select the matching 10-digit code below before calculating duty.', questions:[]};
  const questions = [...new Set(rules.requiredFacts || [])];
  if (estimate.measures.some(m => m.metal && m.rateMode !== 'no-change') && !input.meltPourCountry) questions.push('meltPourCountry');
  if (estimate.complete) return {state:'complete', title:'Calculated', questions:[]};
  return {state:questions.length?'needs-details':'review-required', title:questions.length?'Answer the product questions below':'This treatment needs review', message:questions.length?'These answers select the applicable duties. No alternative tariff has been added to the total.':estimate.ordinary.reason || estimate.warnings[0] || rules.message || 'The available information does not establish one duty treatment.', questions:[...new Set(questions)]};
}

export function productConditionDescriptions(measures, hts) {
  const target=code(hts), out={};
  for (const m of measures) {
    for (const key of m.requiredFacts || []) {
      if (!key.startsWith('productCondition:')) continue;
      const chunks=String(m.sourceContext || '').split(/(?=\(\d+\)\s)/);
      const matches=chunks.filter(t=>[...t.matchAll(/\b\d{4}\.\d{2}\.\d{2,4}\b/g)].some(x=>target.startsWith(code(x[0]))));
      if(matches.length) out[key]=[...new Set(matches.map(t=>t.replace(/Harmonized Tariff Schedule[^]*?Purposes/g,' ').trim().slice(0,1200)))].slice(0,8);
    }
  }
  return out;
}
