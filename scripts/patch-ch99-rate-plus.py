from pathlib import Path

p=Path('netlify/functions/trade-rules.mts')
s=p.read_text()
old='''function rateDecision(meta:IndexHeading|undefined,live:any){
  const d=clean(live?.description),a=clean(live?.additionalDuties),g=clean(live?.general),m=clean(meta?.text);
  // Rate treatment must come from the operative tariff row itself. Relation/
  // legal-note context is used to determine scope and conditions only. Nearby
  // Chapter 99 provisions often contain unrelated percentages and must never
  // donate a rate to this heading.
  const rowText=`${a} ${g} ${d} ${m}`;
  const rateText=a||g||d||m;

  if(/in lieu of the rates? of duty|in lieu of.*column\\s*2/i.test(rowText)){
    const pct=parsePercent(rowText)??(()=>{const x=rowText.match(/\\b(\\d+(?:\\.\\d+)?)\\s*(?:percent|%)\\s+ad\\s+valorem/i);return x?Number(x[1]):null;})();
    return{rateMode:"replacement" as const,ratePercent:pct,rateText};
  }

  // A row that says to use the duty in the applicable HTS subheading is not an
  // additional percentage duty. Check this before looking for percentages.
  if(/\\b0\\s*%\\s+additional|no\\s+additional\\s+duty|no change|the duty provided in (?:the )?applicable subheading/i.test(rowText))
    return{rateMode:"no-change" as const,ratePercent:0,rateText};

  const pct=parsePercent(a)??parsePercent(g)??parsePercent(d)??parsePercent(m);
  if(pct!==null)return{rateMode:"additional" as const,ratePercent:pct,rateText};
  return{rateMode:"unknown" as const,ratePercent:null,rateText};
}
'''
new='''function rateDecision(meta:IndexHeading|undefined,live:any){
  const d=clean(live?.description),a=clean(live?.additionalDuties),g=clean(live?.general),m=clean(meta?.text);
  // Rate treatment must come from the operative tariff row itself. Relation/
  // legal-note context is used to determine scope and conditions only. Nearby
  // Chapter 99 provisions often contain unrelated percentages and must never
  // donate a rate to this heading.
  const rowText=`${a} ${g} ${d} ${m}`;
  const rateText=a||g||d||m;

  if(/in lieu of the rates? of duty|in lieu of.*column\\s*2/i.test(rowText)){
    const pct=parsePercent(rowText)??(()=>{const x=rowText.match(/\\b(\\d+(?:\\.\\d+)?)\\s*(?:percent|%)\\s+ad\\s+valorem/i);return x?Number(x[1]):null;})();
    return{rateMode:"replacement" as const,ratePercent:pct,rateText};
  }

  const pct=parsePercent(a)??parsePercent(g)??parsePercent(d)??parsePercent(m);

  // Explicit no-additional-duty wording always controls. The phrase "the duty
  // provided in the applicable subheading" by itself is also no-change, but
  // Chapter 99 frequently writes an actual surcharge as that phrase + 25%.
  if(/\\b0\\s*%\\s+additional|no\\s+additional\\s+duty|no change/i.test(rowText))
    return{rateMode:"no-change" as const,ratePercent:0,rateText};
  if(/the duty provided in (?:the )?applicable subheading/i.test(rowText) && pct===null)
    return{rateMode:"no-change" as const,ratePercent:0,rateText};

  if(pct!==null)return{rateMode:"additional" as const,ratePercent:pct,rateText};
  return{rateMode:"unknown" as const,ratePercent:null,rateText};
}
'''
if old not in s:
    raise SystemExit('current rateDecision block not found')
s=s.replace(old,new,1)
p.write_text(s)
print('Patched Chapter 99 applicable-subheading + percent handling.')
