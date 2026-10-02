// Product-scope screening is deliberately separate from official ACE tariff flags.
export function screenAgencies(hts, mode) {
  const code=String(hts).replace(/\D/g,''), ch=Number(code.slice(0,2)), rows=[];
  const add=(agency,requirement,url)=>rows.push({agency,status:'Possible requirement — confirm product scope',flag:null,requirement,url});
  const starts=(...prefixes)=>prefixes.some(p=>code.startsWith(p));
  if(ch>=1&&ch<=24) add('FDA','Food/feed may require Prior Notice, facility registration, FSVP and admissibility review. USDA jurisdiction can apply instead.','https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags');
  if(ch<=14&&ch>=1) add('USDA / APHIS','Check commodity-and-origin admissibility, animal/plant permits, health or phytosanitary documents and treatment.','https://www.aphis.usda.gov/contact/trade');
  if([2,4,16].includes(ch)) add('USDA / FSIS','Meat, poultry and certain egg products: confirm foreign establishment eligibility and import inspection.','https://www.fsis.usda.gov/inspection/import-export');
  if([30,33].includes(ch)||starts('9018','9019','9020','9021','9022')) add('FDA','Confirm actual drug, cosmetic or device use, registration/listing, approval, labeling and admissibility.','https://www.fda.gov/industry/import-program/fda-import-process');
  if(ch>=28&&ch<=39) add('EPA / TSCA','Chemical substance/mixture: determine certification, exclusions or exemptions from actual composition and use.','https://www.epa.gov/tsca-import-export-requirements');
  if(starts('3808')) add('EPA / FIFRA','Pesticide/device: confirm registration, labeling and Notice of Arrival.','https://www.epa.gov/compliance/importing-and-exporting-pesticides-and-devices');
  if(starts('8407','8408','8701','8702','8703','8704','8705','8711')) add('EPA','Engine/vehicle emissions conformity and declaration; exemption eligibility depends on configuration, age and use.','https://www.epa.gov/importing-vehicles-and-engines');
  if(ch===87||starts('4011','4012','7007')) add('DOT / NHTSA','Check motor-vehicle/equipment scope, FMVSS compliance, HS-7 and any applicable age or temporary-import exception.','https://www.nhtsa.gov/importing-vehicle/importation-and-certification-faqs');
  if(ch===85||starts('8471','8806')) add('FCC','RF transmitting or digital circuitry may require equipment authorization, labeling and an allowed import condition.','https://www.fcc.gov/oet/ea/importation');
  if([44,45,46,47,48,94,92].includes(ch)) add('APHIS / Lacey Act','Plant-derived material: check the exact HTS declaration schedule, species, harvest country and exemptions.','https://www.aphis.usda.gov/plant-imports/file-lacey-act-declaration/requirements');
  if([1,3,5,41,42,43,50,51,67].includes(ch)) add('FWS / CITES','Wildlife or protected species/material: confirm declaration 3-177, permits, licenses and designated-port rules.','https://www.fws.gov/program/office-of-law-enforcement/information-importers-exporters');
  if([22,24].includes(ch)) add('TTB','Alcohol/tobacco: confirm permits, label/formula approvals and federal excise tax. Excise tax is not calculated here.','https://www.ttb.gov/import-export');
  if(ch===93) add('ATF','Firearms/ammunition: confirm import permit, licensing and article-specific restrictions.','https://www.atf.gov/firearms/import-firearms-ammunition-and-defense-articles');
  if([28,29,30].includes(ch)) add('DEA','Check whether the actual substance is controlled or a listed chemical; permits/registration may apply. HTS alone cannot decide.','https://www.deadiversion.usdoj.gov/imp_exp/imp_exp.html');
  if(ch===3||ch===16) add('NOAA / NMFS','Seafood species may trigger Seafood Import Monitoring Program and other fishery documentation.','https://www.fisheries.noaa.gov/international/seafood-import-monitoring-program');
  if([39,40,42,61,62,63,64,65,70,73,82,83,84,85,94,95,96].includes(ch)) add('CPSC','If this is a regulated finished consumer product, check testing, certification and certificate eFiling.','https://www.cpsc.gov/efiling/importers');
  if(mode==='ocean') rows.push({agency:'FMC',status:'Transport oversight — not an HTS product flag',flag:null,requirement:'Ocean carrier/OTI practices, shipping charges and cargo disputes fall within FMC oversight; this is separate from product admissibility.',url:'https://www.fmc.gov/complaints-and-assistance/cargo-shipment-assistance/'});
  return {officialFlagsStatus:'Not verified — no live ACE REF-001/ABI tariff-flag feed connected',rows,
    note:'These are product-scope screening prompts, not verified ACE flags. No match does not mean no agency applies. Confirm exact HTS flags through ACE/your broker and check intended use, composition and manufacturer.',
    flagReference:'https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags'};
}
