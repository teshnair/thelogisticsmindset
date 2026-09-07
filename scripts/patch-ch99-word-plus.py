from pathlib import Path

p=Path('netlify/functions/trade-rules.mts')
s=p.read_text()
old='''function parsePercent(text:string):number|null{const c=clean(text),patterns=[/additional(?:\\s+ad\\s+valorem)?(?:\\s+rate\\s+of\\s+duty)?[^%]{0,100}?(\\d+(?:\\.\\d+)?)\\s*%/i,/additional\\s+(\\d+(?:\\.\\d+)?)\\s*percent/i,/\\+\\s*(?:a\\s+)?(?:duty\\s+of\\s+)?(\\d+(?:\\.\\d+)?)\\s*%/i,/subject\\s+to\\s+(?:an?\\s+)?(?:additional\\s+)?(\\d+(?:\\.\\d+)?)\\s*percent/i,/\\b(\\d+(?:\\.\\d+)?)\\s*%\\s+additional/i];for(const re of patterns){const m=c.match(re);if(m)return Number(m[1]);}return null;}'''
new='''function parsePercent(text:string):number|null{const c=clean(text),patterns=[/additional(?:\\s+ad\\s+valorem)?(?:\\s+rate\\s+of\\s+duty)?[^%]{0,100}?(\\d+(?:\\.\\d+)?)\\s*%/i,/additional\\s+(\\d+(?:\\.\\d+)?)\\s*percent/i,/\\+\\s*(?:a\\s+)?(?:duty\\s+of\\s+)?(\\d+(?:\\.\\d+)?)\\s*%/i,/\\bplus\\s+(?:a\\s+)?(?:duty\\s+of\\s+)?(\\d+(?:\\.\\d+)?)\\s*%/i,/\\bplus\\s+(\\d+(?:\\.\\d+)?)\\s*percent(?:\\s+ad\\s+valorem)?\\b/i,/subject\\s+to\\s+(?:an?\\s+)?(?:additional\\s+)?(\\d+(?:\\.\\d+)?)\\s*percent/i,/\\b(\\d+(?:\\.\\d+)?)\\s*%\\s+additional/i];for(const re of patterns){const m=c.match(re);if(m)return Number(m[1]);}return null;}'''
if old not in s:
    raise SystemExit('parsePercent block not found')
s=s.replace(old,new,1)
p.write_text(s)
print('Patched Chapter 99 word-plus percentage parsing.')
