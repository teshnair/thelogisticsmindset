from pathlib import Path
p=Path('netlify/functions/trade-rules.mts')
s=p.read_text()
old='''function conditionDecision(ref:string,meta:IndexHeading|undefined,input:any,hts:string,country:string){const required=new Set<string>(),context=headingContext(meta),rowText=clean(meta?.text),targets=meta?.noteTargets||[],chapter=Number(hts.slice(0,2));if(hts.startsWith("8703")&&/\\b(?:vehicle|automobile)\\s+parts\\b/i.test(rowText))return{state:"not-applicable" as const,reason:"HTS 8703 is a passenger-vehicle classification, not a vehicle-parts classification.",requiredFacts:[]};'''
new='''function conditionDecision(ref:string,meta:IndexHeading|undefined,input:any,hts:string,country:string){const required=new Set<string>(),context=headingContext(meta),rowText=clean(meta?.text),targets=meta?.noteTargets||[],chapter=Number(hts.slice(0,2));if(hts.startsWith("8703")&&(targets.includes("33:g")||/\\b(?:vehicle|automobile)\\s+parts\\b/i.test(rowText)))return{state:"not-applicable" as const,reason:"U.S. note 33(g) and automobile-parts provisions do not apply to a finished passenger vehicle classified in HTS 8703.",requiredFacts:[]};'''
if old not in s: raise SystemExit('vehicle-parts condition marker not found')
p.write_text(s.replace(old,new,1))
