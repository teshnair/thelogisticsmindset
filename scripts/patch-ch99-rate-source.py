from pathlib import Path

p=Path('netlify/functions/trade-rules.mts')
s=p.read_text()
old='''function rateDecision(meta:IndexHeading|undefined,live:any){const d=clean(live?.description),a=clean(live?.additionalDuties),g=clean(live?.general),context=headingContext(meta,live),combined=`${a} ${g} ${d} ${context}`;if(/in lieu of the rates? of duty|in lieu of.*column\\s*2/i.test(combined)){const pct=parsePercent(combined)??(()=>{const m=combined.match(/\\b(\\d+(?:\\.\\d+)?)\\s*(?:percent|%)\\s+ad\\s+valorem/i);return m?Number(m[1]):null;})();return{rateMode:"replacement" as const,ratePercent:pct,rateText:a||g||d||clean(meta?.text)};}const pct=parsePercent(a)??parsePercent(g)??parsePercent(d)??parsePercent(context);if(pct!==null)return{rateMode:"additional" as const,ratePercent:pct,rateText:a||g||d||clean(meta?.text)};if(/\\b0\\s*%\\s+additional|no\\s+additional\\s+duty|no change|the duty provided in (?:the )?applicable subheading/i.test(combined))return{rateMode:"no-change" as const,ratePercent:0,rateText:a||g||d||clean(meta?.text)};return{rateMode:"unknown" as const,ratePercent:null,rateText:a||g||d||clean(meta?.text)};}
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

  // A row that says to use the duty in the applicable HTS subheading is not an
  // additional percentage duty. Check this before looking for percentages.
  if(/\\b0\\s*%\\s+additional|no\\s+additional\\s+duty|no change|the duty provided in (?:the )?applicable subheading/i.test(rowText))
    return{rateMode:"no-change" as const,ratePercent:0,rateText};

  const pct=parsePercent(a)??parsePercent(g)??parsePercent(d)??parsePercent(m);
  if(pct!==null)return{rateMode:"additional" as const,ratePercent:pct,rateText};
  return{rateMode:"unknown" as const,ratePercent:null,rateText};
}
'''
if old not in s:
    raise SystemExit('rateDecision block not found')
s=s.replace(old,new,1)
p.write_text(s)
print('Patched Chapter 99 rate-source precedence.')
