import {summarizePlanning} from '/lib/hts-worst-case.mjs';
import {canonicalUnit} from '/lib/hts-shipment.mjs';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'Rate only / review':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const codes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const names=new Intl.DisplayNames(['en'],{type:'region'});
const countryOptions=codes.map(c=>[c,names.of(c)]).sort((a,b)=>a[1].localeCompare(b[1])).map(([c,n])=>`<option value="${c}">${esc(n)} (${c})</option>`).join('');
const commonUnits=['kg','g','no.','l','m','m²','m³','doz.','prs.','t','1000','1000 kWh','doz. prs.','pf.liter'];
const factLabels={meltPourCountry:'Steel melt/pour country',metalContentValue:'Covered metal content value (USD)',nonUsContentValue:'Non-U.S. content value (USD)',usContentValue:'U.S. content value (USD)',subjectMetalWeightPercent:'Subject metal weight (%)',containsAluminumSteelCopper:'Contains aluminum, steel or copper?',usMetalContentQualification:'Is at least 85% of each covered metal U.S.-melted/poured or U.S.-smelted/cast, with supporting evidence?',ukMetalContentQualification:'Meets U.K. metal qualification?',vehicleManufactureYear:'Vehicle manufacture year',vehiclePartCategory:'Vehicle part use',mhdProductionRepairCertification:'MHD production/repair certification?',nonUsVehicleContentValue:'Non-U.S. vehicle content value (USD)',commerceApproval:'Required Commerce approval?',quotaEligibility:'Quota eligibility confirmed?',column2CountryStatus:'Column 2 country status?',importedBeforeBan:'Imported before September 29, 2026, 12:01 a.m. ET?',packagedAlcohol:'Packaged for direct consumption (including kegs)?',importPurpose:'Import purpose',ftaQualification:'Special-program qualification confirmed?',approvalStatus:'Required program approval confirmed?',productSpecificCondition:'Meets product-specific condition?'};
let nextId=0,busy=false,lastResults=[],lookupTimers=new Map();
const field=(line,key)=>line.querySelector(`[data-field="${key}"]`);
const unitsOptions=units=>'<option value="">Select unit</option>'+[...new Set([...units,...commonUnits])].map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join('');
function invalidate(event){const force=event===true||event?.target?.dataset?.field==='hts';const guiding=lastResults.length&&lastResults.some(r=>!r.estimate?.complete);if(!$('shipmentResults').hidden){if(force||!guiding)$('shipmentResults').hidden=true;$('status').textContent='Inputs changed. Calculate again to update results.';}if(force||!guiding)lastResults=[];}
function counts(){const n=$('shipmentLines').children.length;$('lineCount').textContent=`${n} / 10 lines`;$('addLine').disabled=busy||n>=10;document.querySelectorAll('[data-remove]').forEach(b=>b.disabled=busy||n===1);document.querySelectorAll('.line-number').forEach((el,i)=>el.textContent=`Line ${i+1}`);}
function addLine(){if(busy||$('shipmentLines').children.length>=10)return;invalidate(true);const id=++nextId,el=document.createElement('section');el.className='card line';el.dataset.id=id;
  const input=(key,label,type='text',extra='')=>`<div><label for="${key}-${id}">${label}</label><input id="${key}-${id}" data-field="${key}" type="${type}" ${extra}></div>`;
  el.innerHTML=`<div class="line-head"><h3 class="line-number"></h3><button type="button" class="text-button" data-remove aria-label="Remove this HTS line">Remove line</button></div>
  <div class="line-primary"><div class="hts-input"><label for="hts-${id}">HTS code *</label><input id="hts-${id}" data-field="hts" placeholder="e.g. 7308.90.3000" inputmode="numeric" autocomplete="off" required aria-describedby="hint-${id}"><div class="lookup-results" hidden></div></div><div><label for="country-${id}">Country of origin *</label><select id="country-${id}" data-field="country" required><option value="">Select country</option>${countryOptions}</select></div>${input('customsValue','Customs value (USD) *','number','min="0.01" step="0.01" required placeholder="10000.00"')}</div>
  <details class="line-optional-details"><summary>Optional: quantities, trade agreements and metal origin</summary><div class="line-optional"><div><label for="purpose-${id}">Entry purpose</label><select id="purpose-${id}" data-field="importPurpose"><option value="ordinary">Ordinary commercial entry</option><option value="special">Special entry / Chapter 98 / donation / other</option></select></div><div><label for="fta-${id}">Trade agreement qualification</label><select id="fta-${id}" data-field="ftaQualification"><option value="">Not established</option><option value="yes">Confirmed eligible</option><option value="no">Not eligible</option></select></div>${input('quantity1','Quantity 1 <small>optional</small>','number','min="0.000001" step="any"')}<div><label for="unit1-${id}">Unit 1 <small>optional</small></label><select id="unit1-${id}" data-field="unit1">${unitsOptions([])}</select></div>${input('quantity2','Quantity 2 <small>optional</small>','number','min="0.000001" step="any"')}<div><label for="unit2-${id}">Unit 2 <small>optional</small></label><select id="unit2-${id}" data-field="unit2">${unitsOptions([])}</select></div><div><label for="meltPourCountry-${id}">Smelt / melt &amp; pour country <small>optional</small></label><select id="meltPourCountry-${id}" data-field="meltPourCountry"><option value="">Unknown / not applicable</option>${countryOptions}</select></div></div></details>
  <div id="hint-${id}" class="line-hint">Enter 4–10 digits to find a code. Use 10 digits for amounts. Metal origin may differ from country of origin; aluminum can require separate smelt/cast facts.</div><div class="extra-facts"></div>`;
  $('shipmentLines').append(el);el.querySelector('[data-remove]').addEventListener('click',()=>{el.remove();invalidate(true);counts();});
  field(el,'hts').addEventListener('input',()=>{clearTimeout(lookupTimers.get(id));el.savedFacts={};el.querySelector('.extra-facts').innerHTML='';el.querySelector('.lookup-results').hidden=true;lookupTimers.set(id,setTimeout(()=>lookup(el),400));});counts();return el;
}
async function jsonFetch(url,body,signal){const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});let data;try{data=await res.json();}catch{throw Error('The lookup service did not return a result. Please retry.');}if(!res.ok)throw Error(data.error||`Lookup failed (${res.status}).`);return data;}
function setUnits(el,units){for(const key of ['unit1','unit2']){const select=field(el,key),previous=select.value;select.innerHTML=unitsOptions([...units,...(previous?[previous]:[])]);select.value=previous;}}
async function lookup(el){const input=field(el,'hts'),code=input.value.replace(/\D/g,''),box=el.querySelector('.lookup-results');if(code.length<4||code.length>10||busy)return;
  try{const data=await jsonFetch('/api/hts-duty',{action:'search',hts:code},AbortSignal.timeout(25000));if(!el.isConnected||input.value.replace(/\D/g,'')!==code||busy)return;
    box.innerHTML='';const items=data.suggestions||[];if(!items.length){el.querySelector('.line-hint').textContent='No matching HTS found. Check the code.';return;}
    for(const item of items.slice(0,12)){const b=document.createElement('button');b.type='button';const hts=item.hts||item.htsno||item.code;b.innerHTML=`<strong>${esc(item.displayHts||hts)}</strong>${esc(item.descriptionPath||item.description||'')}${String(hts).replace(/\D/g,'').length<10?' · Choose a more specific code':''}`;b.addEventListener('click',()=>{input.value=item.displayHts||hts;el.savedFacts={};el.querySelector('.extra-facts').innerHTML='';box.hidden=true;setUnits(el,item.units||[]);el.querySelector('.line-hint').textContent=`${item.description||''} · Published units: ${(item.units||[]).join(', ')||'not specified'}`;invalidate();});box.append(b);}box.hidden=false;
  }catch(e){el.querySelector('.line-hint').textContent=e.message;}
}
function readLine(el){const input={...(el.savedFacts||{})};el.querySelectorAll('[data-field]').forEach(e=>input[e.dataset.field]=e.value);input.customsValue=Number(input.customsValue);input.mode=$('shipmentMode').value;input.entryDate=$('entryDate').value;return input;}
function showFacts(el,result){const keys=[...new Set(result.guidance?.questions||result.rules.requiredFacts||[])].filter(k=>!['hts','country','customsValue','meltPourCountry','ftaQualification','importPurpose'].includes(k));const originLabel=el.querySelector('label[for="meltPourCountry-'+el.dataset.id+'"]');if(originLabel)originLabel.textContent='Smelt / melt & pour country (optional refinement)';const box=el.querySelector('.extra-facts');const saved=readLine(el);el.savedFacts=saved;box.innerHTML='';if(!keys.length)return;
  const numeric=new Set(['metalContentValue','nonUsContentValue','usContentValue','nonUsVehicleContentValue','subjectMetalWeightPercent','vehicleManufactureYear']);
  const choices={vehiclePartCategory:[['passenger-light','Passenger vehicle / light truck'],['mhd','Medium / heavy-duty vehicle'],['not-vehicle','Not a vehicle part']],importPurpose:[['ordinary','Ordinary consumption'],['prototype','Prototype'],['testing','Testing / research'],['temporary','Temporary import']],vehicleEngineStatus:[['original','Original'],['modified','Modified']]};
  box.innerHTML=`<details class="facts"><summary>Optional refinements (${keys.length})</summary><p class="hint">The worst-case estimate is already calculated without these answers. Add confirmed details only if you want to refine it.</p><div class="fact-grid">${keys.map((key,i)=>{const label=factLabels[key]||(key.startsWith('productCondition:')?'Does this product qualify for the exclusion described below? ('+key.split(':')[1]+')':key.replace(/([a-z])([A-Z])/g,'$1 $2'));const id=`fact-${el.dataset.id}-${i}`;return `<div><label for="${id}">${esc(label)}</label>${numeric.has(key)?`<input type="number" min="0" step="any" id="${id}" data-field="${esc(key)}" ${key==='subjectMetalWeightPercent'?'max="100"':''}>`:`<select id="${id}" data-field="${esc(key)}"><option value="">Not known</option>${(choices[key]||[['yes','Yes'],['no','No']]).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>`}${(result.guidance?.productConditions?.[key]||[]).map(t=>`<p class="hint">${esc(t)}</p>`).join('')}</div>`;}).join('')}</div></details>`;
  keys.forEach(key=>{const f=field(el,key);if(f&&saved[key])f.value=saved[key];});
}
function coverage(r){const programs=['Section 232','Section 301','Section 338','Section 122','Section 201 / safeguard','Other Chapter 99'];return programs.map(p=>{const ms=r.estimate.measures.filter(m=>p==='Other Chapter 99'?!programs.includes(m.program):m.program===p);return `${p}: ${ms.length?ms.length+' relevant provision(s)':'no applicable provision identified'}`;}).join(' · ');}

function relevantMeasures(screening, program) {
  if (!screening?.sourceVerified) return [];
  return [...(screening.measures||[]),...(screening.replacement?[screening.replacement]:[])]
    .filter(m=>m.program===program && m.hts && m.ratePercent!=null)
    .concat((screening.unpriced||[]).filter(m=>m.program===program && m.hts));
}
function rateList(screening,program){
  return relevantMeasures(screening,program).map(m=>{
    const rate=m.ratePercent==null?'Review required':esc(m.ratePercent)+'%';
    return rate+' ('+esc(m.hts)+')'+(m.rateMode==='replacement'?' · replacement':'');
  }).join('<br>');
}
function comparisonTable(r){
  const rows=r.comparison||[];
  // Only display a tariff column when at least one candidate has a relevant tariff.
  const programs=['Section 232','Section 301',...(r.input.country==='CA'?['Section 338']:[]),'Section 122','Section 201 / safeguard'];
  const visible=programs.filter(program=>rows.some(c=>relevantMeasures(c.screening,program).length));
  const headers=visible.map(program=>'<th>'+esc(program)+'</th>').join('');
  const body=rows.map(c=>'<tr><td><strong>'+esc(c.displayHts)+'</strong><small>'+esc(c.description)+'</small><button type="button" class="text-button" data-select-line="'+esc(r.input.lineIndex)+'" data-code="'+esc(c.hts)+'">Use this code</button></td><td>'+esc(c.ordinaryRate||'Published formula unavailable')+'</td>'+visible.map(program=>'<td>'+(rateList(c.screening,program)||'')+'</td>').join('')+'<td class="amount">'+money(c.screening.totalDuty)+'</td></tr>').join('');
  return '<div class="tablescroll"><table><thead><tr><th>Full HTS code / product</th><th>Ordinary duty rate</th>'+headers+'<th>Worst-case duty amount</th></tr></thead><tbody>'+body+'</tbody></table></div>';
}
function renderAgencyReview(r){
  const rows=(r.pga?.rows||[]).filter(item=>item.agency!=='FMC');
  const agency=rows.length
    ?'<div class="pga-list">'+rows.map(item=>'<div class="pga-item"><strong>'+esc(item.agency)+'</strong><span class="muted">'+esc(item.status||'Potential requirement')+'</span><p>'+esc(item.requirement)+'</p>'+(item.url?'<a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">Agency guidance</a>':'')+'</div>').join('')+'</div>'
    :'';
  const measures=r.screening||{};
  const replacement=measures.replacement;
  const chapter99=[...(replacement?[replacement]:[]),...(measures.measures||[]),...(measures.unpriced||[])];
  const chapter99Html=chapter99.length
    ?'<p>'+chapter99.map(m=>'<strong>'+esc(m.hts||'Code under review')+'</strong> · '+esc(m.program||'Chapter 99')+' · '+esc(m.rateText||((m.ratePercent!=null)?m.ratePercent+'%':'Rate requires verification'))).join('<br>')+'</p>'
    :'<p>No Chapter 99 provision was identified in this result. This is not confirmation of exemption; verify source coverage and the current legal notes.</p>';
  const note52=r.rules?.note52Exemption;
  const note52Info=note52?'<p><strong>Section 301 exemption · '+esc(note52.hts)+'</strong>: '+esc(note52.reason)+'</p>':'';
  const s338=r.rules?.section338;
  const s338Info=r.input?.country==='CA'&&s338?.inNote51List
    ?'<div class="notice info"><strong>Section 338 · Canada: '+(s338.inNote51List?'50% potential additional duty ('+esc(s338.hts)+')':'Not listed for this classification')+'</strong><p>'+esc(s338.message)+'</p><p class="source">Status: '+esc(s338.status)+' · Source: HTS Revision '+esc(s338.sourceRevision)+' · <a href="'+esc(s338.reference)+'" target="_blank" rel="noopener noreferrer">CBP guidance</a></p></div>'
    :'';
  return '<section class="line-screening"><h4>Chapter 99 provisions identified</h4>'+chapter99Html+note52Info+s338Info
    +(rows.length?'<h4>Potential government agency requirements (PGA)</h4>'+agency+'<p class="source">'+esc(r.pga?.note||'Product-specific PGA flags are not verified against live ACE data.')+'</p>':'')
    +'<h4>Antidumping / countervailing duty (AD/CVD)</h4><p><strong>Not determined.</strong> AD/CVD orders depend on product scope, exporter/manufacturer and case details, not HTS alone. The estimate excludes AD/CVD; absence from the duty table does not mean the goods are outside an order. <a href="https://access.trade.gov/" target="_blank" rel="noopener noreferrer">Check Commerce ACCESS</a> and <a href="https://www.usitc.gov/trade_remedy/731_ad_701_cvd/index.htm" target="_blank" rel="noopener noreferrer">USITC trade remedies</a>.</p></section>';
}
function renderAceOrder(r) {
  const source = '<a href="https://content.govdelivery.com/accounts/USDHSCBP/bulletins/4270d2a">CBP filing sequence</a>';
  const start = '<section class="line-screening"><h4>ACE filing order</h4>';
  if (r.comparison || String(r.classification.displayHts).replace(/\D/g,'').length !== 10)
    return start + '<p>Select the full 10-digit commodity code to see the line sequence.</p></section>';
  const rows = [...(r.aceMeasures || [])];
  const exemption = r.rules?.note52Exemption;
  if (exemption && !rows.some(m => m.hts === exemption.hts))
    rows.push({...exemption, program:'Section 301', applicability:'review-required'});
  function order(m) {
    if (m.program === 'Section 301') return 2;
    if (m.program === 'Section 338') return 3;
    if (m.program === 'Section 232') return 4;
    if (/Section 201/.test(m.program)) return /quota/i.test(m.program) ? 6 : 5;
    if (/quota/i.test(m.program)) return 8;
    if (m.rateMode === 'replacement') return 7;
    if (m.rateMode === 'additional') return 1;
    return null;
  }
  const filing = [], review = [];
  for (const m of rows.sort((a,b)=>(order(a)??99)-(order(b)??99))) {
    const rate = m.ratePercent == null ? 'Rate unverified' : esc(m.ratePercent)+'%';
    const item = '<strong>'+esc(m.hts)+'</strong> · '+esc(m.program)+' · '+rate;
    if (m.applicability === 'applicable' && m.liveHeadingVerified && r.rules?.revisionVerified && order(m) !== null)
      filing.push(item + (m.ratePercent === 0 ? ' · $0.00' : ''));
    else review.push(item+' · '+esc(m.reason || 'Confirm applicability and filing instructions.'));
  }
  filing.push('<strong>'+esc(r.classification.displayHts)+'</strong> · Commodity classification');
  return start+'<p>Report applicable provisions in this sequence. Include a required zero-duty code. If claiming Chapter 98, enter it first.</p><ol><li>'+filing.join('</li><li>')+'</li></ol>'
    +(review.length ? '<h5>Conditional provisions requiring review</h5><ul><li>'+review.join('</li><li>')+'</li></ul>' : '')
    +'<p>Report entered value on the commodity code unless Chapter 98 directs otherwise. '+source+'</p></section>';
}
function renderLine(r,i){
  if(r.error)return '<section class="card error"><h3>Line '+(i+1)+' · '+esc(r.input.hts)+'</h3><p>'+esc(r.error)+'</p></section>';
  const w=r.screening||{},comparison=r.comparison,hasAmount=w.totalDuty!=null;
  return '<section class="card result-line"><h3>Line '+(i+1)+' · '+esc(r.classification.displayHts)+' · '+esc(names.of(r.input.country))+'</h3><p>'+esc(r.classification.description)+'</p><div class="line-answer"><strong>Worst-case duty for this line: '+(hasAmount?money(w.totalDuty):'Not fully quantified')+'</strong><span>'+(comparison?'Highest-cost matching classification'+(w.selectedHts?' · '+esc(w.selectedHts):'')+'. This does not select the correct product classification.':'Ordinary / replacement duty '+money(w.ordinaryDuty)+' + additional tariffs '+money(w.additionalDuty)+'.')+' Shipment fees are shown once above.</span></div>'
  +(comparison?'<p>'+comparison.length+' matching 10-digit codes. Each amount assumes the whole line value of '+money(r.input.customsValue)+' falls under that row.</p>'+comparisonTable(r):'<table><thead><tr><th>Duty</th><th>Planning rate</th><th>Amount</th></tr></thead><tbody><tr><td>'+(w.replacement?'Replacement ordinary duty':'Ordinary duty')+'</td><td>'+esc(w.replacement?w.replacement.ratePercent+'%':w.ordinaryRate||'Unknown')+'</td><td>'+money(w.ordinaryDuty)+'</td></tr>' +(w.replacement?'<tr><td>Chapter 99 replacement provision · '+esc(w.replacement.hts||'Not identified')+'</td><td>'+esc(w.replacement.ratePercent!=null?w.replacement.ratePercent+'%':'Review')+'</td><td>Included in ordinary / replacement duty above</td></tr>':'')+(w.measures||[]).map(m=>'<tr><td>'+esc(m.program)+' · '+esc(m.hts)+'</td><td>'+esc(m.ratePercent)+'%</td><td>'+money(m.screeningAmount)+'</td></tr>').join('')+'</tbody></table>')
  +renderAceOrder(r)+renderAgencyReview(r)
  +'<details class="legal-details"><summary>Estimate assumptions and limitations</summary><ul>'+(w.assumptions||[]).map(a=>'<li>'+esc(a)+'</li>').join('')+'</ul>'+(w.unpriced||[]).map(m=>'<p>Unquantified: '+esc(m.hts)+' · '+esc(m.rateText)+'</p>').join('')+'<p>AD/CVD, excise, quotas and special-entry costs are excluded. This is a planning estimate, not a confirmed filing total.</p></details></section>';
}
function render(results){
  results.forEach((r,i)=>r.input.lineIndex=i);
  const s=summarizePlanning(results,$('shipmentMode').value,$('entryDate').value);lastResults=results;
  const metric=(label,value,cls='')=>'<div class="metric '+cls+'"><span>'+label+'</span><strong>'+value+'</strong></div>';
  $('shipmentResults').innerHTML='<div class="section-heading"><div><h2>Worst-case shipment estimate</h2><p>'+results.length+' line(s) · '+esc($('shipmentMode').value)+' · customs value '+money(s.value)+'</p></div><button type="button" id="printResults" class="secondary">Print / save PDF</button></div><div class="summary">'+metric('Ordinary / replacement duty',money(s.baseDuty))+metric('Potential additional tariffs',money(s.tariffs))+metric('Shipment MPF',money(s.mpf))+metric('Shipment HMF',money(s.hmf))+metric('Worst-case planning total',s.complete?money(s.total):'Not fully quantified','total')+'</div><div class="notice info">Conservative planning estimate. No unconfirmed exclusions or reduced-duty treatment are assumed. Alternative Section 232 headings are not added together. For an incomplete HTS, the highest matching row is used for the shipment estimate; every matching code is shown below.</div>'+(s.complete?'':'<div class="notice">Some published formulas or treatments could not be priced. They are not treated as zero.</div>')+results.map(renderLine).join('');
  $('shipmentResults').hidden=false;$('printResults').addEventListener('click',()=>window.print());
  $('shipmentResults').querySelectorAll('[data-select-line]').forEach(button=>button.addEventListener('click',()=>{const el=$('shipmentLines').children[Number(button.dataset.selectLine)];field(el,'hts').value=button.dataset.code;el.savedFacts={};el.querySelector('.extra-facts').innerHTML='';invalidate(true);field(el,'hts').focus();$('status').textContent='Full HTS selected. Calculate again to refine this line.';}));
}
$('shipmentForm').addEventListener('input',invalidate);$('shipmentForm').addEventListener('change',invalidate);
$('addLine').addEventListener('click',()=>{const el=addLine();field(el,'hts').focus();});
$('clearAll').addEventListener('click',()=>{if(busy)return;$('shipmentLines').innerHTML='';invalidate();addLine();$('status').textContent='';});
document.addEventListener('click',e=>{if(!e.target.closest('.hts-input'))document.querySelectorAll('.lookup-results').forEach(b=>b.hidden=true);});
$('shipmentForm').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;const els=[...$('shipmentLines').children],inputs=els.map(readLine);
  for(let i=0;i<inputs.length;i++){const input=inputs[i];for(const n of [1,2]){const q=input[`quantity${n}`],u=input[`unit${n}`];if((q||u)&&(!(Number(q)>0)||!u)){$('status').textContent=`Line ${i+1}: enter both quantity ${n} and unit ${n}, or leave both blank.`;return;}}if(input.unit1&&input.unit2&&canonicalUnit(input.unit1)===canonicalUnit(input.unit2)){$('status').textContent=`Line ${i+1}: quantity 1 and 2 must use different units.`;return;}}
  busy=true;document.querySelectorAll('#shipmentForm input,#shipmentForm select,#shipmentForm button').forEach(e=>e.disabled=true);document.querySelectorAll('.lookup-results').forEach(b=>b.hidden=true);$('shipmentResults').hidden=true;
  const results=new Array(inputs.length);let cursor=0,done=0;async function worker(){while(cursor<inputs.length){const i=cursor++;try{results[i]=await jsonFetch('/api/hts-line',inputs[i],AbortSignal.timeout(65000));setUnits(els[i],results[i].classification.units||[]);showFacts(els[i],results[i]);}catch(e){results[i]={input:inputs[i],error:e.message};}done++;$('status').textContent=`Checked ${done} of ${inputs.length} lines…`;}}
  $('status').textContent=`Checking ${inputs.length} line(s)…`;await Promise.all([worker(),worker()]);busy=false;document.querySelectorAll('#shipmentForm input,#shipmentForm select,#shipmentForm button').forEach(e=>e.disabled=false);counts();render(results);$('status').textContent='Worst-case estimate calculated. Product details are optional refinements.';$('shipmentResults').scrollIntoView({behavior:'smooth',block:'start'});
});
const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const d=Object.fromEntries(parts.map(p=>[p.type,p.value]));$('entryDate').value=`${d.year}-${d.month}-${d.day}`;
document.querySelector('.page-header h1').textContent='U.S. Import Duty Calculator';document.querySelector('.page-header .subtitle').textContent='Duties, tariffs and import requirements — by shipment';
addLine();

