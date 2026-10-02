import baseHandler from './hts-duty.mts';
import tradeHandler from './trade-rules.mts';
import { lineEstimate } from '../../lib/hts-shipment.mjs';
import { screenAgencies } from '../../lib/pga-screening.mjs';

export default async (req:Request) => {
  if(req.method!=='POST') return Response.json({error:'Method not allowed'},{status:405});
  try {
    const input=await req.json();
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
    const [baseResponse,ruleResponse]=await Promise.all([
      baseHandler(make('/api/hts-duty',{...input,quantity:input.quantity1,quantityUnit:input.unit1,ftaQualified:false})),
      tradeHandler(make('/api/trade-rules',{...input,strictFacts:true}))
    ]);
    const base=await baseResponse.json(),rules=await ruleResponse.json();
    if(!baseResponse.ok) return Response.json(base,{status:baseResponse.status});
    if(!ruleResponse.ok) {rules.status='source-unavailable';rules.revisionVerified=false;}
    const estimate=lineEstimate(input,base,rules);
    estimate.measures=estimate.measures.map(({sourceContext,...measure}:any)=>measure);
    const pga=screenAgencies(input.hts,input.mode);
    const exciseReview=['22','24','27'].includes(input.hts.slice(0,2));
    if(exciseReview){estimate.complete=false;estimate.warnings.push('Federal excise taxes may apply to this product and are not calculated. Total taxes require review.');}
    if(['CU','IR','KP','SY','RU','BY'].includes(input.country)) {estimate.complete=false;estimate.warnings.push('Sanctions/export-control restrictions require a separate admissibility and party review; a duty estimate is not import authorization.');}
    return Response.json({input,classification:base.classification,rates:base.rates,estimate,rules:{...rules,measures:undefined},pga,review:base.review,exciseReview,source:base.source},{headers:{'Cache-Control':'no-store'}});
  } catch(error:any) {return Response.json({error:'Unable to complete this line. Retry; no zero-duty result has been assumed.',detail:error.message},{status:502});}
};
export const config={path:'/api/hts-line',method:['POST']};
