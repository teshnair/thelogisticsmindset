// Reviewed against FR 2026-18835/6/7, 2026-19498, 2026-19537 and 2026-19399.
// HTS matches identify screening candidates; shipment facts control applicability.
const alcohol = `22030000 22041000 22042120 22042130 22042150 22042160 22042180 22042220 22042240 22042260 22042280 22042961 22042981 22051030 22060015 22060030 22060045 22060060 22060090 22071030 22082010 22082020 22082030 22082040 22082050 22082060 22083030 2208306020 2208306040 2208306055 2208306065 2208306075 22084020 22084040 22084060 22084080 22085000 22086010 22086020 22086050 2208700030 22089010 22089012 22089014 22089015 22089020 22089025 22089030 22089035 22089040 22089050 22089072 22089075`.split(' ');
const packaged = new Set(`22030000 22041000 22042260 22042280 22042961 22042981 22060015 22060030 22060045 22060060 22060090 22071030 22082010 22082050 22082060 22083030 2208306040 2208306075 22084060 22084080 22085000 22086050 22089010 22089014 22089015 22089035 22089040 22089075`.split(' '));
const dairy = `04041005 04041008 04041011 04041015 04041020 04041048 04041050 04041090 17029035 17031030 17031050 17039030 17039050 22029100`.split(' ');
const polysilicon = `28046100 3818000020 3818000040 3818000045 3818000050 3818000091 85414200 85414300`.split(' ');
const match = (codes:string[], hts:string) => codes.find(c => hts.startsWith(c) || c.startsWith(hts));
const tri = (v:unknown) => v === true || v === 'yes' || v === 'true' ? true : v === false || v === 'no' || v === 'false' ? false : null;
export function supplementalScreening(hts:string, country:string, input:any, index:any, now=new Date()) {
  const notices:any[]=[];
  const requiredFacts:string[]=[];
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const currentDate = /^\d{4}-\d{2}-\d{2}$/.test(input.entryDate||'') ? input.entryDate : today;
  const a=match(alcohol,hts),d=match(dairy,hts),v=match(['87115000'],hts);
  if(country==='CA' && (a||d||v) && currentDate>='2026-09-29') {
    const before=tri(input.importedBeforeBan),pack=tri(input.packagedAlcohol);
    const limited=Boolean(a && packaged.has(a));
    if(before!==true && !(limited && pack===false)) {
      const full=hts.length >= (a||d||v)!.length;
      const confirmed=before===false && (!limited||pack===true) && full;
      if(before===null)requiredFacts.push('importedBeforeBan');
      if(limited&&pack===null)requiredFacts.push('packagedAlcohol');
      const doc=a?'2026-18835':d?'2026-18836':'2026-18837';
      notices.push({kind:'import-restriction',status:confirmed?'prohibited':'may-apply',blocksTotal:true,title:confirmed?'Canadian import prohibition applies':'Canadian import prohibition may apply',message:'Listed Canadian products imported on or after September 29, 2026 at 12:01 a.m. Eastern are excluded from importation. '+(limited?'This alcohol line is restricted only when packaged in bottles, cans, boxes, kegs or similar direct-to-consumption containers. ':'')+'Goods imported before that cutoff remain subject to the applicable 50% Section 338 duty. Paying duty does not authorize importation of prohibited goods.'+(!full?' Enter the full 10-digit HTS to confirm the listed statistical line.':''),source:'https://www.federalregister.gov/documents/2026/09/14/'+doc});
    }
  }
  const refs=new Set<string>();
  for(const n of [6,8,10])if(hts.length>=n)for(const ref of index.codes?.[hts.slice(0,n)]||[])refs.add(ref);
  const pharma=[...refs].some(ref=>(index.headings?.[ref]?.noteTargets||[]).some((t:string)=>/^40(?::|$)/.test(t)));
  if(pharma)notices.push({kind:'pharmaceutical',status:'review-required',blocksTotal:true,title:'Pharmaceutical tariff eligibility requires review',message:'Section 232 patented-pharmaceutical treatment can reach 100%, with origin-specific rates and company or product exceptions. The general company deferral ended September 29, 2026. Generic products, qualifying specialty medicines and eligible clinical-trial or R&D imports can receive different treatment. Revision 20 includes the September 23 corrections; confirm patent status, intended use, origin and Commerce eligibility before calculating a total. No pharmaceutical rate is automatically assumed from the HTS alone.',source:'https://www.federalregister.gov/documents/2026/09/23/2026-19498'});
  if(match(polysilicon,hts)&&currentDate>='2026-09-22'&&currentDate<='2026-12-03')notices.push({kind:'polysilicon',status:'may-apply',blocksTotal:false,title:'Polysilicon stockpiling restrictions may apply',message:'Through December 3, 2026, Commerce can prohibit further entries by importers found to be stockpiling. New importers registered on or after August 6 face weekly limits unless approved: 12 kg for 2804.61.00; 7 kg for the listed 3818.00 statistical lines; 2,000 units for 8541.42.00; 55 units for 8541.43.00. Check importer history, weekly quantities and any Commerce waiver. This is an admissibility restriction, not an added duty.',source:'https://www.federalregister.gov/documents/2026/09/24/2026-19537'});
  if(hts.startsWith('1701'))notices.push({kind:'quota',status:'may-apply',blocksTotal:false,title:'Raw cane sugar quota allocation review',message:'FY2027 in-quota entries begin October 1, 2026. The September 23 notice adds country allocations; certificates of quota eligibility and current quota availability must be checked. The calculator does not confirm quota availability.',source:'https://www.federalregister.gov/documents/2026/09/23/2026-19399'});
  return {notices,requiredFacts,pharma,blocksTotal:notices.some(n=>n.blocksTotal)};
}
