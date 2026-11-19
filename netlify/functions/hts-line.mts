import { entryDateError, isQualified } from "../../lib/tariff-decision.mjs";
import baseHandler from './hts-duty.mts';
import tradeHandler from './trade-rules.mts';
import { lineEstimate } from '../../lib/hts-shipment.mjs';
import { screenAgencies } from '../../lib/pga-screening.mjs';
import { classificationChoices, lineGuidance, productConditionDescriptions } from '../../lib/hts-guidance.mjs';
import legalIndex from '../../data/chapter99-index.json' with {type:'json'};
import {worstCaseEstimate} from '../../lib/hts-worst-case.mjs';

export default async (req:Request) => {
  if(req.method!=='POST') return Response.json({error:'Method not allowed'},{status:405});
  try {
    const input=await req.json();
    const dateError=entryDateError(input.entryDate);
    if(dateError)return Response.json({error:dateError},{status:400});
    input.hts=String(input.hts||'').replace(/\D/g,'');
    if(!/^(\d{4}|\d{6}|\d{8}|\d{10})$/.test(input.hts)) return Response.json({error:'Enter a 4, 6, 8 or 10-digit HTS code.'},{status:400});
    if(!Number.isFinite(Number(input.customsValue))||Number(input.customsValue)<=0) return Response.json({error:'Enter a positive customs value.'},{status:400});
    for(const n of [1,2]) {
      const q=input[`quantity${n}`],u=input[`unit${n}`];
      if((q!==''&&q!=null)||u) if(!(Number(q)>0)||!u) return Response.json({error:`Quantity ${n} needs both a positive amount and its unit, or leave both blank.`},{status:400});
    }
    for(const key of ['metalContentValue','nonUsContentValue','usContentValue','nonUsVehicleContentValue']) {
      if(input[key]!=null&&input[key]!==''&&(!Number.isFinite(Number(input[key]))||Number(input[key])<0||Number(input[key])>Number(input.customsValue))) return Response.json({error:'Metal/content values must be between zero and the line customs value.'},{status:400});
    }
    const make=(path:string,body:any)=>new Request(new URL(path,req.url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(input.hts.length!==10){
      const response=await baseHandler(make('/api/hts-duty',{action:'search',hts:input.hts,fullCodesOnly:true}));
      const search=await response.json();
      if(!response.ok)return Response.json(search,{status:response.status});
      const options=(search.suggestions||[]).filter((s:any)=>String(s.code||s.hts).replace(/\D/g,'').length===10);
      const comparison:any[]=new Array(options.length);let cursor=0;
      async function worker(){while(cursor<options.length){const n=cursor++,option=options[n],hts=String(option.code||option.hts).replace(/\D/g,'');
        const response=await tradeHandler(make('/api/trade-rules',{...input,hts,strictFacts:true}));const rules=await response.json();
        const rate=['BY','CU','KP','RU'].includes(input.country)?option.column2Rate:option.generalRate;
        const screening=worstCaseEstimate({...input,hts},{appliedRate:rate},rules,legalIndex);
        comparison[n]={hts,displayHts:option.hts,description:option.descriptionPath||option.description,ordinaryRate:rate,screening};
      }}
      await Promise.all(Array.from({length:Math.min(4,options.length)},worker));
      const selected=[...comparison].sort((a,b)=>(b.screening.totalDuty??-1)-(a.screening.totalDuty??-1))[0];
      const screening=selected?{...selected.screening,complete:comparison.every(c=>c.screening.complete),selectedHts:selected.displayHts,label:'Worst-case across matching classifications'}:{complete:false,totalDuty:null,ordinaryDuty:null,additionalDuty:0,measures:[],assumptions:[],unpriced:[]};
      if(!screening.complete)screening.totalDuty=null;
      return Response.json({input,comparison,screening,guidance:{state:'comparison',questions:[],choices:comparison},classification:{displayHts:input.hts,description:options.length+' matching full HTS classifications',units:[]},rules:{requiredFacts:[]},estimate:{complete:false}},{headers:{'Cache-Control':'no-store'}});
    }
    const baseResponse=await baseHandler(make('/api/hts-duty',{...input,quantity:input.quantity1,quantityUnit:input.unit1,ftaQualified:isQualified(input.ftaQualification)}));
    const base=await baseResponse.json();
    if(!baseResponse.ok)return Response.json(base,{status:baseResponse.status});
    input.usmcaDutyFree=['CA','MX'].includes(input.country)&&isQualified(input.ftaQualification)&&/^free$/i.test(base.rates?.appliedRate||'');
    const ruleResponse=await tradeHandler(make('/api/trade-rules',{...input,strictFacts:true}));
    const rules=await ruleResponse.json();
    if(!ruleResponse.ok) {rules.status='source-unavailable';rules.revisionVerified=false;}
    const estimate=lineEstimate(input,base,rules);
    const screening=worstCaseEstimate(input,base.rates,rules,legalIndex);
    const productConditions=productConditionDescriptions((rules.measures||[]).map((m:any)=>({...m,sourceContext:[...Object.values((legalIndex.headings as any)[m.hts]?.legalContext||{}),...(m.noteTargets||[]).map((key:string)=>(legalIndex.legalNotes as any)[key]||'')].join(' ')})),input.hts);
    estimate.measures=estimate.measures.map(({sourceContext,...measure}:any)=>measure);
    const pga=screenAgencies(input.hts,input.mode);
    const exciseReview=['22','24','27'].includes(input.hts.slice(0,2));
    if(exciseReview){estimate.complete=false;estimate.warnings.push('Federal excise taxes may apply to this product and are not calculated. Total taxes require review.');}
    if(['CU','IR','KP','SY','RU','BY'].includes(input.country)) {estimate.complete=false;estimate.warnings.push('Sanctions/export-control restrictions require a separate admissibility and party review; a duty estimate is not import authorization.');}
    if(exciseReview||['CU','IR','KP','SY','RU','BY'].includes(input.country)){screening.complete=false;screening.totalDuty=null;}
    return Response.json({input,classification:base.classification,rates:base.rates,estimate,screening,guidance:{...lineGuidance(input,estimate,rules),productConditions},aceMeasures:(rules.measures||[]).filter(m=>m.applicability!=='not-applicable').map(({hts,program,applicability,reason,rateMode,ratePercent,estimatedDuty,requiredFacts,liveHeadingVerified})=>({hts,program,applicability,reason,rateMode,ratePercent,estimatedDuty,requiredFacts,liveHeadingVerified})),rules:{...rules,measures:undefined},pga,review:base.review,exciseReview,source:base.source},{headers:{'Cache-Control':'no-store'}});
  } catch(error:any) {return Response.json({error:'Unable to complete this line. Retry; no zero-duty result has been assumed.',detail:error.message},{status:502});}
};
export const config={path:'/api/hts-line',method:['POST']};

