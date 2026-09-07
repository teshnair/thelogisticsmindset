from pathlib import Path

p=Path('hts-duty-calculator.html')
s=p.read_text()
old="""    review.appendChild(intro);

    measures.forEach(measure => {"""
new="""    review.appendChild(intro);

    if (section232Amount > 0 && section301Amount > 0) {
      const stacking = document.createElement('div');
      stacking.className = 'notice info';
      stacking.innerHTML = '<strong>Tariff stacking:</strong> Section 232 and Section 301 are separate trade remedies and are cumulative in this estimate. The mutual-exclusivity rule applies only within the Section 232 heading family 9903.82.02–9903.82.26, so no more than one heading from that family is included.';
      review.appendChild(stacking);
    }

    measures.forEach(measure => {"""
if old not in s:
    raise SystemExit('stacking insertion point not found')
s=s.replace(old,new,1)
p.write_text(s)
print('Added Section 232/301 stacking explanation.')
