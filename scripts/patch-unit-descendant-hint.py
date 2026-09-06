from pathlib import Path
p=Path('hts-duty-calculator.html')
s=p.read_text()
old='''  const matches = (Array.isArray(items) ? items : []).filter(item => String(item?.code || '').startsWith(d));
  const exact = matches.filter(item => String(item?.code || '') === d);
  const pool = exact.length ? exact : matches;
  if (!pool.length) {'''
new='''  const matches = (Array.isArray(items) ? items : []).filter(item => String(item?.code || '').startsWith(d));
  const exact = matches.filter(item => String(item?.code || '') === d);
  const exactWithUnits = exact.filter(item => suggestionUnits(item).length);
  const descendantsWithUnits = matches.filter(item => String(item?.code || '').length > d.length && suggestionUnits(item).length);
  const pool = exactWithUnits.length
    ? exactWithUnits
    : descendantsWithUnits.length
      ? descendantsWithUnits
      : exact.length
        ? exact
        : matches;
  if (!pool.length) {'''
if old not in s: raise SystemExit('unit pool block not found')
s=s.replace(old,new,1)
p.write_text(s)
