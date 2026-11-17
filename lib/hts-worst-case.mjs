import {calculateOrdinaryDuty,roundMoney,summarizeShipment} from './hts-shipment.mjs';
import {isForcedLaborCountryHeading} from './ch99-forced-labor.mjs';
import {note52Decision} from './note52-rules.mjs';

// A planning estimate from the current, origin/date-filtered candidate set.
// Relief is not assumed; legally alternative headings are never added together.
export function worstCaseEstimate(input, rates, rules, index) {
  const value=Number(input.customsValue),quantities=[1,2].map(n=>({quantity:input['quantity'+n],unit:input['unit'+n]}));
  const ordinary=calculateOrdinaryDuty(rates.appliedRate,value,quantities);
  const assumptions=['Planning estimate: no unconfirmed product exclusion, preferential program or reduced-duty qualification is claimed.'];
  const unavailable=!rules.revisionVerified||rules.totalRequiresReview;
  const unpriced=(rules.measures||[]).filter(m=>m.applicability!=='not-applicable'&&(m.rateMode==='unknown'||m.ratePercent==null));
  const potential=(rules.measures||[]).filter(m=>m.applicability!=='not-applicable'&&m.ratePercent>0&&['additional','replacement'].includes(m.rateMode));
  const amount=m=>m.applicability==='applicable'&&m.estimatedDuty!=null?Number(m.estimatedDuty):value*m.ratePercent/100;
  const metal=potential.filter(m=>m.program==='Section 232');
  const rest=potential.filter(m=>m.program!=='Section 232');
  const forced=rest.filter(m=>isForcedLaborCountryHeading(m.hts));
  const others=rest.filter(m=>!isForcedLaborCountryHeading(m.hts));
  const noMetalPossible=!metal.length||(rules.measures||[]).some(m=>['9903.82.01','9903.82.03'].includes(m.hts));
  const routes=[];
  for(const selected of [...(noMetalPossible?[null]:[]),...metal]){
    const sectoral=selected&&note52Decision(index,{...input,importPurpose:input.importPurpose||'ordinary'},input.hts,input.country,[{...selected,applicability:'applicable'}]);
    const countryOptions=sectoral?.state==='not-applicable'&&/sectoral/i.test(sectoral.reason)?[null]:forced.length?forced:[null];
    for(const country of countryOptions){
      const measures=[...others,...(selected?[selected]:[]),...(country?[country]:[])];
      // Explicit exception headings are alternatives, even where facts are unknown.
      const retained=measures.filter(m=>!measures.some(other=>other!==m&&((m.exceptionRefs||[]).includes(other.hts)||(other.exceptionRefs||[]).includes(m.hts))&&(amount(other)>amount(m)||(amount(other)===amount(m)&&other.hts<m.hts))));
      const replacements=retained.filter(m=>m.rateMode==='replacement');
      const replacement=replacements.sort((a,b)=>amount(b)-amount(a))[0];
      const ordinaryDuty=replacement?amount(replacement):ordinary.amount;
      const charges=retained.filter(m=>m.rateMode==='additional').map(m=>({...m,screeningAmount:roundMoney(amount(m))}));
      const additionalDuty=roundMoney(charges.reduce((sum,m)=>sum+m.screeningAmount,0));
      routes.push({ordinaryDuty,additionalDuty,totalDuty:ordinaryDuty==null?null:roundMoney(ordinaryDuty+additionalDuty),measures:charges,replacement:replacement?{...replacement,screeningAmount:roundMoney(amount(replacement))}:null});
    }
  }
  const chosen=routes.sort((a,b)=>(b.totalDuty??-1)-(a.totalDuty??-1))[0]||{ordinaryDuty:ordinary.amount,additionalDuty:0,totalDuty:ordinary.amount,measures:[],replacement:null};
  if(metal.length)assumptions.push('At most one Section 232 heading is used. Unknown covered content is valued at the full customs value; the highest-cost compatible treatment is selected.');
  if(forced.length&&metal.length)assumptions.push('The country-wide surcharge and the Section 232 route are compared with the U.S. note 52 sectoral exemption; they are not blindly stacked.');
  const complete=!unavailable&&ordinary.amount!=null&&!unpriced.length;
  const lean=m=>({hts:m.hts,program:m.program,ratePercent:m.ratePercent,rateMode:m.rateMode,screeningAmount:m.screeningAmount});
  const measures=chosen.measures.map(lean),replacement=chosen.replacement?lean(chosen.replacement):null;
  return {...chosen,measures,replacement,label:'Worst-case planning estimate',complete,totalDuty:complete?chosen.totalDuty:null,ordinaryRate:rates.appliedRate,assumptions,unpriced:unpriced.map(m=>({hts:m.hts,program:m.program,rateText:m.rateText,reason:m.reason})),sourceVerified:!!rules.revisionVerified,section232:measures.filter(m=>m.program==='Section 232'),section301:measures.filter(m=>m.program==='Section 301')};
}

export function summarizePlanning(lines,mode,date){
  const summary=summarizeShipment(lines.map(line=>({input:line.input,estimate:{ordinary:{amount:line.screening?.ordinaryDuty??null},knownTariffs:line.screening?.additionalDuty||0,tariffTotal:line.screening?.complete?line.screening.additionalDuty:null,complete:!!line.screening?.complete}})),mode,date);
  return {...summary,isPlanning:true};
}
