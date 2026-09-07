from pathlib import Path

p=Path('netlify/functions/trade-rules.mts')
s=p.read_text()

old='''function enforceMetalMutualExclusivity(measures:EvaluatedMeasure[]){const candidates=measures.filter(m=>isMutuallyExclusiveMetalHeading(m.hts)&&m.applicability!=="not-applicable");if(candidates.length<=1)return;const reason="U.S. note 16(a) makes headings 9903.82.02 through 9903.82.26 mutually exclusive. More than one candidate was identified, but only one of these headings may apply; the rates must not be added together.";for(const m of candidates){m.applicability="needs-facts";m.estimatedDuty=null;m.replacementDutyEstimate=null;m.reason=reason;}}
function applyWorstCaseEstimates(measures:EvaluatedMeasure[],input:any,customsValue:number,country:string){const enteredMeltPour=clean(fact(input,"meltPourCountry")).toUpperCase();for(const m of measures){const a=m as any;a.worstCaseEstimatedDuty=m.estimatedDuty;a.assumptions=[] as string[];if(m.applicability==="not-applicable"||m.ratePercent===null||m.ratePercent===0||m.rateMode!=="additional")continue;if(m.estimatedDuty===null&&customsValue>0){let base=customsValue;const contentSpecific=/only apply to the declared value of the (?:aluminum|steel|copper) content|duty.*value of the (?:aluminum|steel|copper) content/i.test(m.sourceContext);if(contentSpecific){const enteredContent=numberValue(fact(input,"metalContentValue"))??numberValue(fact(input,"nonUsContentValue"));base=enteredContent??customsValue;if(enteredContent===null)a.assumptions.push("Covered metal content value was not entered, so the full entered customs value was used for the quick estimate.");}a.worstCaseEstimatedDuty=base*m.ratePercent/100;}if(m.program==="Section 232"&&!enteredMeltPour)a.assumptions.push(`First melt/pour country was not entered, so the entered country of origin (${country}) was assumed to be the melt/pour country.`);if(m.applicability!=="applicable")a.assumptions.push("Any unresolved exclusion, exception, special program, or product-specific condition was assumed not to reduce the identified duty.");}}
'''

new='''function enforceMetalMutualExclusivity(measures:EvaluatedMeasure[]){
  const candidates=measures.filter(m=>isMutuallyExclusiveMetalHeading(m.hts)&&m.applicability!=="not-applicable");
  if(candidates.length<=1)return;
  const reason="U.S. note 16(a) makes headings 9903.82.02 through 9903.82.26 mutually exclusive. More than one candidate was identified, but only one of these headings may apply; the rates must not be added together.";
  for(const m of candidates){
    (m as any).mutuallyExclusiveGroup="9903.82.02-9903.82.26";
    m.applicability="needs-facts";
    m.estimatedDuty=null;
    m.replacementDutyEstimate=null;
    m.reason=reason;
  }
}
function applyWorstCaseEstimates(measures:EvaluatedMeasure[],input:any,customsValue:number,country:string){
  const enteredMeltPour=clean(fact(input,"meltPourCountry")).toUpperCase();
  for(const m of measures){
    const a=m as any;
    a.worstCaseEstimatedDuty=m.estimatedDuty;
    a.assumptions=[] as string[];
    if(m.applicability==="not-applicable"||m.ratePercent===null||m.ratePercent===0||m.rateMode!=="additional")continue;
    if(m.estimatedDuty===null&&customsValue>0){
      let base=customsValue;
      const contentSpecific=/only apply to the declared value of the (?:aluminum|steel|copper) content|duty.*value of the (?:aluminum|steel|copper) content/i.test(m.sourceContext);
      if(contentSpecific){
        const enteredContent=numberValue(fact(input,"metalContentValue"))??numberValue(fact(input,"nonUsContentValue"));
        base=enteredContent??customsValue;
        if(enteredContent===null)a.assumptions.push("Covered metal content value was not entered, so the full entered customs value was used for the quick estimate.");
      }
      a.worstCaseEstimatedDuty=base*m.ratePercent/100;
    }
    if(m.program==="Section 232"&&!enteredMeltPour)a.assumptions.push(`First melt/pour country was not entered, so the entered country of origin (${country}) was assumed to be the melt/pour country.`);
    if(m.applicability!=="applicable")a.assumptions.push("Any unresolved exclusion, exception, special program, or product-specific condition was assumed not to reduce the identified duty.");
  }

  // U.S. note 16(a): headings 9903.82.02 through 9903.82.26 are mutually
  // exclusive. If facts do not identify a single heading, retain exactly one
  // dollar estimate: the highest potentially applicable quick-estimate amount.
  // Other headings remain visible only as legal alternatives and must never be
  // presented or totaled as additional duties.
  const metalCandidates=measures.filter(m=>isMutuallyExclusiveMetalHeading(m.hts)&&m.applicability!=="not-applicable");
  if(metalCandidates.length>1){
    const ranked=[...metalCandidates].sort((a,b)=>{
      const av=Number((a as any).worstCaseEstimatedDuty ?? a.estimatedDuty ?? -1);
      const bv=Number((b as any).worstCaseEstimatedDuty ?? b.estimatedDuty ?? -1);
      if(bv!==av)return bv-av;
      return Number(b.ratePercent??-1)-Number(a.ratePercent??-1);
    });
    const selected=ranked[0];
    for(const m of metalCandidates){
      const a=m as any;
      a.mutuallyExclusiveGroup="9903.82.02-9903.82.26";
      a.mutuallyExclusiveSelected=(m===selected);
      if(m===selected){
        a.assumptions=[...new Set([...(a.assumptions||[]),`Only one heading in 9903.82.02 through 9903.82.26 may apply. ${m.hts} was used for the worst-case quick estimate because it produced the highest potentially applicable duty; alternative headings were not added.`])];
      }else{
        a.worstCaseEstimatedDuty=null;
        a.assumptions=[...new Set([...(a.assumptions||[]),`Alternative mutually exclusive Section 232 heading. Not added to the estimate because U.S. note 16(a) permits no more than one heading in 9903.82.02 through 9903.82.26.`])];
      }
    }
  }
}
'''

if old not in s:
    raise SystemExit('mutual exclusivity block not found')
s=s.replace(old,new,1)
p.write_text(s)
print('Patched mutually exclusive Section 232 worst-case estimates.')
