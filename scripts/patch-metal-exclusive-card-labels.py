from pathlib import Path

p=Path('js/hts-import-screening-v2.js')
s=p.read_text()
old='''    const estimated = measure.estimatedDuty ?? measure.worstCaseEstimatedDuty;
    const assumed = measure.estimatedDuty == null && measure.worstCaseEstimatedDuty != null;
    const duty = estimated == null ? "Dollar amount could not be estimated automatically" : `${assumed ? "Worst-case quick estimate" : "Estimated additional duty"}: <strong>${esc(money(estimated))}</strong>`;
    const facts = Array.isArray(measure.requiredFacts) && measure.requiredFacts.length ? `<br><span class="tiny"><strong>Facts that could change this estimate:</strong> ${esc(measure.requiredFacts.map(questionLabel).join(", "))}</span>` : (measure.applicability !== "applicable" && measure.reason ? `<br><span class="tiny"><strong>Why review is still required:</strong> ${esc(measure.reason)}</span>` : "");
    const assumptions = Array.isArray(measure.assumptions) && measure.assumptions.length ? `<br><span class="assumption-note"><strong>Assumptions:</strong> ${esc(measure.assumptions.join(" "))}</span>` : "";
    div.innerHTML = `<strong>${esc(measure.program)} — ${esc(measure.hts)} — ${esc(measure.rateText || "See current provision")}</strong>${measure.description ? `<br>${esc(measure.description)}` : ""}<br><span class="tiny">${duty}</span>${facts}${assumptions}<br><span class="tiny">Source: current USITC HTS / Chapter 99</span>`;
'''
new='''    const exclusiveAlternative = !!measure.mutuallyExclusiveGroup && measure.mutuallyExclusiveSelected === false;
    const exclusiveSelected = !!measure.mutuallyExclusiveGroup && measure.mutuallyExclusiveSelected === true;
    const estimated = exclusiveAlternative ? null : (measure.estimatedDuty ?? measure.worstCaseEstimatedDuty);
    const assumed = measure.estimatedDuty == null && measure.worstCaseEstimatedDuty != null;
    const duty = exclusiveAlternative
      ? "<strong>ALTERNATIVE — NOT ADDED.</strong> U.S. note 16(a) allows no more than one heading in 9903.82.02 through 9903.82.26."
      : estimated == null
        ? "Dollar amount could not be estimated automatically"
        : `${exclusiveSelected ? "USED FOR WORST-CASE ESTIMATE" : assumed ? "Worst-case quick estimate" : "Estimated additional duty"}: <strong>${esc(money(estimated))}</strong>`;
    const facts = Array.isArray(measure.requiredFacts) && measure.requiredFacts.length ? `<br><span class="tiny"><strong>Facts that could change this estimate:</strong> ${esc(measure.requiredFacts.map(questionLabel).join(", "))}</span>` : (measure.applicability !== "applicable" && measure.reason ? `<br><span class="tiny"><strong>Why review is still required:</strong> ${esc(measure.reason)}</span>` : "");
    const assumptions = Array.isArray(measure.assumptions) && measure.assumptions.length ? `<br><span class="assumption-note"><strong>Assumptions:</strong> ${esc(measure.assumptions.join(" "))}</span>` : "";
    div.innerHTML = `<strong>${esc(measure.program)} — ${esc(measure.hts)} — ${esc(measure.rateText || "See current provision")}</strong>${measure.description ? `<br>${esc(measure.description)}` : ""}<br><span class="tiny">${duty}</span>${facts}${assumptions}<br><span class="tiny">Source: current USITC HTS / Chapter 99</span>`;
'''
if old not in s:
    raise SystemExit('addMeasureCard block not found')
s=s.replace(old,new,1)
p.write_text(s)
print('Patched mutually exclusive result-card labels.')
