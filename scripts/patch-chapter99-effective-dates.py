from pathlib import Path

p = Path('netlify/functions/trade-rules.mts')
s = p.read_text()

old = '''function parseDate(text:string){const d=new Date(text);return Number.isNaN(d.getTime())?null:d;}
function effectiveDecision(context:string,liveDescription:string){const text=`${liveDescription} ${context}`;if(/\\b(?:heading|provision|exclusion)\\b[^.]{0,100}\\bexpired\\b|\\[\\s*expired\\s*\\]/i.test(liveDescription))return{state:"not-applicable" as const,reason:"The current HTS text marks this provision as expired."};const now=new Date();const before=text.match(/(?:on or )?before\\s+([A-Z][a-z]+\\s+\\d{1,2},\\s+\\d{4})/i);if(before){const d=parseDate(before[1]);if(d&&now>new Date(d.getTime()+86400000))return{state:"not-applicable" as const,reason:`The stated effective period ended ${before[1]}.`};}const after=text.match(/(?:on or )?after\\s+([A-Z][a-z]+\\s+\\d{1,2},\\s+\\d{4})/i);if(after){const d=parseDate(after[1]);if(d&&now<d)return{state:"not-applicable" as const,reason:`The provision is not effective until ${after[1]}.`};}return{state:"possible" as const,reason:"The provision is within its stated effective period."};}
'''

new = '''function parseDate(text:string){const d=new Date(text);return Number.isNaN(d.getTime())?null:d;}
function effectiveDecision(context:string,liveDescription:string,entryDateValue?:unknown){
  const text=clean(`${liveDescription} ${context}`);
  if(/\\b(?:heading|provision|exclusion)\\b[^.]{0,100}\\bexpired\\b|\\[\\s*expired\\s*\\]/i.test(liveDescription))return{state:"not-applicable" as const,reason:"The current HTS text marks this provision as expired."};

  const supplied=clean(entryDateValue);
  const parsed=supplied?parseDate(supplied):null;
  const sourceDate=parsed||new Date();
  const entryDate=new Date(sourceDate.getFullYear(),sourceDate.getMonth(),sourceDate.getDate());
  const dayStart=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const dayAfter=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);
  const datePattern='([A-Z][a-z]+\\\\s+\\\\d{1,2},\\\\s+\\\\d{4})';
  const match=(re:RegExp)=>text.match(re);

  // Inclusive end-date wording used heavily in Chapter 99, e.g. "through June 14, 2024".
  for(const re of [new RegExp(`\\\\bthrough\\\\s+${datePattern}`,'i'),new RegExp(`\\\\bon or before\\\\s+${datePattern}`,'i')]){
    const m=match(re); if(m){const d=parseDate(m[1]); if(d&&entryDate>=dayAfter(d))return{state:"not-applicable" as const,reason:`The stated effective period ended ${m[1]}.`};}
  }

  // Exclusive end-date wording, e.g. "before June 15, 2024".
  const beforeRe=new RegExp(`\\\\bbefore\\\\s+${datePattern}`,'ig');
  for(const m of text.matchAll(beforeRe)){
    const prefix=text.slice(Math.max(0,(m.index||0)-12),m.index||0).toLowerCase();
    if(/on or\\s*$/.test(prefix))continue;
    const d=parseDate(m[1]); if(d&&entryDate>=dayStart(d))return{state:"not-applicable" as const,reason:`The stated effective period ended before ${m[1]}.`};
  }

  // Inclusive start-date wording, e.g. "on or after January 1, 2024".
  for(const re of [new RegExp(`\\\\bon or after\\\\s+${datePattern}`,'i'),new RegExp(`\\\\bfrom\\\\s+${datePattern}`,'i')]){
    const m=match(re); if(m){const d=parseDate(m[1]); if(d&&entryDate<dayStart(d))return{state:"not-applicable" as const,reason:`The provision is not effective until ${m[1]}.`};}
  }

  return{state:"possible" as const,reason:supplied?`The provision is within its stated effective period for entry date ${supplied}.`:"The provision is within its stated effective period as of the current date."};
}
'''

if old not in s:
    raise SystemExit('effectiveDecision block not found')
s = s.replace(old, new, 1)

old_call = 'const effective=effectiveDecision(context,clean(live?.description));'
new_call = 'const effective=effectiveDecision(context,clean(live?.description),fact(input,"entryDate"));'
if old_call not in s:
    raise SystemExit('effectiveDecision call not found')
s = s.replace(old_call, new_call, 1)

p.write_text(s)
print('Patched Chapter 99 effective-date filtering.')
