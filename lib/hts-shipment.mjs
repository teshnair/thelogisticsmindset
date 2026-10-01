// Shared browser/server arithmetic. No inferred quantities, metal origins or exemptions.
export const roundMoney = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const FEE_SOURCE = 'https://www.federalregister.gov/documents/2026/07/31/2026-15530/customs-user-fees-to-be-adjusted-for-inflation-in-fiscal-year-2027';
export function feeSchedule(date) {
  if (date >= '2026-10-01' && date < '2027-10-01') return {year:2027, rate:0.003464, min:34.58, max:670.86, hmf:0.00125, source:FEE_SOURCE};
  if (date >= '2025-10-01' && date < '2026-10-01') return {year:2026, rate:0.003464, min:33.58, max:651.50, hmf:0.00125, source:'https://www.cbp.gov/trade/basic-import-export/uftd-info'};
  return null;
}
export function canonicalUnit(unit) {
  const u=String(unit||'').toLowerCase().replace(/<sup>2<\/sup>/g,'2').replace(/<sup>3<\/sup>/g,'3').replace(/²/g,'2').replace(/³/g,'3').replace(/[.\s]/g,'');
  const aliases={kg:['kg','kilogram','kilograms'],g:['g','gram','grams'],no:['no','number','unit','units','each','ea'],l:['l','liter','liters','litre','litres'],m:['m','meter','meters','metre','metres'],m2:['m2','sqm'],m3:['m3','cbm'],doz:['doz','dozen'],prs:['prs','pair','pairs']};
  return Object.entries(aliases).find(([,v])=>v.includes(u))?.[0]||u;
}
export function calculateOrdinaryDuty(rate, value, quantities=[]) {
  const fail=reason=>({amount:null,reason,components:[]});
  if (!Number.isFinite(value)||value<=0) return fail('A positive customs value is required.');
  const raw=String(rate||'').replace(/(^|\s)\d+\/(?=\s|$)/g,' ').replace(/\s+/g,' ').trim();
  if (/^free$/i.test(raw)) return {amount:0,reason:null,components:[]};
  if (!raw || /\b(or|less|more|not|maximum|minimum|see|content|proof|each component)\b/i.test(raw)) return fail('Conditional duty formula: rate only; review the tariff text.');
  const components=[];
  // Accept only a fully consumed additive formula. Never silently drop its second unit.
  const parts=raw.split(/\s*\+\s*/);
  for (const part of parts) {
    let m=part.match(/^(\d+(?:\.\d+)?)\s*%(?:\s*ad valorem)?$/i);
    if (m) {components.push({basis:'value',rate:Number(m[1]),amount:value*Number(m[1])/100});continue;}
    m=part.match(/^(\$)?(\d+(?:\.\d+)?)\s*(¢|cents?)?\s*(?:\/|per\s+)([\w²³.]+)$/i);
    if (!m || (!m[1]&&!m[3])) return fail('This published formula requires manual calculation; rate only.');
    const unit=canonicalUnit(m[4]), matches=quantities.filter(q=>canonicalUnit(q.unit)===unit);
    if (matches.length!==1 || !(Number(matches[0].quantity)>0)) return fail(`Enter one quantity in ${m[4]} to calculate this duty; rate only.`);
    const n=Number(m[2])/(m[3]?100:1), quantity=Number(matches[0].quantity);
    components.push({basis:unit,rate:n,quantity,amount:n*quantity});
  }
  return {amount:roundMoney(components.reduce((s,c)=>s+c.amount,0)),reason:null,components};
}
export function lineEstimate(input, base, rules) {
  const quantities=[{quantity:input.quantity1,unit:input.unit1},{quantity:input.quantity2,unit:input.unit2}].filter(q=>q.quantity!==''&&q.quantity!=null&&q.unit);
  const ordinary=calculateOrdinaryDuty(base.rates?.appliedRate,Number(input.customsValue),quantities);
  // The requested optional-blank mode gives MFN rates without inventing dollar amounts.
  if (!quantities.length && !input.meltPourCountry) {ordinary.amount=null;ordinary.reason='Optional shipment details were not entered: MFN rate only.';}
  const fullCode=String(input.hts).replace(/\D/g,'').length===10;
  if (!fullCode) {ordinary.amount=null;ordinary.reason='Select a full 10-digit HTS code for shipment amounts.';}
  const warnings=[];
  if (rules.status==='source-stale'||rules.status==='source-unavailable'||!rules.revisionVerified) warnings.push('Current Chapter 99 source could not be verified. Tariff totals require review.');
  const measures=(rules.measures||[]).map(m=>{
    let amount=m.applicability==='applicable'&&m.rateMode==='additional'?m.estimatedDuty:null;
    let reason=m.reason;
    const metal=m.program==='Section 232'&&((m.noteTargets||[]).some(t=>/^16(?::|$)/.test(t))||/steel|alumin|copper|metal content/i.test(m.description||''));
    if (metal&&!input.meltPourCountry) {amount=null;reason='Smelt/melt and pour details are missing. Rate only; country of origin is not assumed to be metal origin.';}
    if (!fullCode||!rules.revisionVerified||rules.totalRequiresReview) amount=null;
    if (amount!=null) amount=roundMoney(amount);
    return {...m,amount,reason,metal};
  });
  const replacements=measures.filter(m=>m.applicability==='applicable'&&m.rateMode==='replacement');
  // Replacement rates cannot be added to MFN duty or combined without program-specific rules.
  if (replacements.length) warnings.push('A replacement Chapter 99 rate was identified. Review its interaction with ordinary duty; it is not added to the total.');
  const unresolved=measures.some(m=>m.applicability!=='applicable'||m.rateMode==='unknown'||m.rateMode==='replacement'||(m.rateMode==='additional'&&m.amount==null));
  const knownTariffs=roundMoney(measures.reduce((s,m)=>s+(m.amount??0),0));
  const tariffComplete=fullCode&&rules.revisionVerified&&!['source-stale','source-unavailable'].includes(rules.status)&&!rules.totalRequiresReview&&!unresolved&&!replacements.length;
  return {ordinary,measures,knownTariffs,tariffTotal:tariffComplete?knownTariffs:null,complete:ordinary.amount!=null&&tariffComplete,warnings};
}
export function summarizeShipment(lines,mode,date) {
  const value=roundMoney(lines.reduce((s,l)=>s+Number(l.input.customsValue||0),0));
  const schedule=feeSchedule(date);
  const mpf=schedule?roundMoney(Math.max(schedule.min,Math.min(schedule.max,value*schedule.rate))):null;
  const hmf=mode==='ocean'?roundMoney(value*0.00125):0;
  const valid=lines.filter(l=>!l.error&&l.estimate);
  const baseDuty=roundMoney(valid.reduce((s,l)=>s+(l.estimate.ordinary.amount??0),0));
  const tariffs=roundMoney(valid.reduce((s,l)=>s+l.estimate.knownTariffs,0));
  const complete=lines.length>0&&valid.length===lines.length&&valid.every(l=>l.estimate.complete)&&mpf!=null;
  const identifiedSubtotal=roundMoney(baseDuty+tariffs+(mpf??0)+hmf);
  return {value,baseDuty,tariffs,mpf,hmf,schedule,complete,total:complete?identifiedSubtotal:null,identifiedSubtotal,unresolvedLines:lines.filter(l=>l.error||!l.estimate?.complete).length};
}
