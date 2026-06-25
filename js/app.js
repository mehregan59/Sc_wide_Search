/**
 * SciWide Search — single-file bundle
 * Phase 2: systematic review, screening states, PRISMA log,
 *          RIS/EndNote export, arXiv, PubMed, bioRxiv connectors.
 */
document.addEventListener('DOMContentLoaded', () => {

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function lines(id){ const el=document.getElementById(id); return (el&&el.value||'').split('\n').map(s=>s.trim()).filter(Boolean); }
function setLines(id,arr){ const el=document.getElementById(id); if(el) el.value=(arr||[]).join('\n'); }
function checked(sel){ return [...document.querySelectorAll(sel)].filter(e=>e.checked).map(e=>e.value); }
function setChecked(sel,values){ if(!Array.isArray(values))return; const set=new Set(values); document.querySelectorAll(sel).forEach(e=>{e.checked=set.has(e.value);}); }
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const stamp=()=>new Date().toISOString().slice(0,10);
function dlFile(content,name,mime){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:mime}));
  a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);
}

// ═══════════════════════════════════════════════════════════════
// SCREENING STATE — per-record include/exclude/maybe + reason
// ═══════════════════════════════════════════════════════════════
const _screening=new Map();
function screeningKey(r){ return (r.doi&&r.doi!=='not reported')?r.doi:(r.full_citation||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,80); }
function getScreening(r){ return _screening.get(screeningKey(r))||{decision:'',reason:''}; }
function setScreening(r,decision,reason){ _screening.set(screeningKey(r),{decision,reason:reason||''}); }

// ═══════════════════════════════════════════════════════════════
// PRISMA SEARCH LOG
// ═══════════════════════════════════════════════════════════════
const _searchLog=[];
function logSearch(db,term,hits,newN,dupes){ _searchLog.push({ts:new Date().toISOString(),db,term,hits,new:newN,dupes}); }
function clearSearchLog(){ _searchLog.length=0; }

// ═══════════════════════════════════════════════════════════════
// LIVE SCHEMA
// ═══════════════════════════════════════════════════════════════
let LIVE_SCHEMA=[
  {field:'full_citation',label:'Full citation',type:'string',desc:'Full reference (APA)',enabled:true,extractFrom:null},
  {field:'pub_year',label:'Publication year',type:'integer',desc:'Year of publication',enabled:true,extractFrom:null},
  {field:'source_type',label:'Source type',type:'enum',desc:'journal|thesis|report|conference|grey',enabled:true,extractFrom:null},
  {field:'language',label:'Language',type:'string',desc:'ISO 639-1 code',enabled:true,extractFrom:null},
  {field:'country',label:'Country',type:'string',desc:'Country of record origin',enabled:true,extractFrom:'country',
    keywords:['Japan','China','Korea','Taiwan','United States','USA','Canada','Mexico','Germany','France','Italy','Spain','Portugal','Switzerland','Austria','Belgium','Netherlands','United Kingdom','UK','Poland','Czech Republic','Hungary','Slovenia','Croatia','Serbia','Romania','Bulgaria','Greece','Turkey','Chile','Brazil','Argentina','Uruguay','Colombia','Peru','Australia','New Zealand','South Africa','Morocco','Tunisia','Israel','India','Thailand','Vietnam','Malaysia','Indonesia','Philippines','Finland','Sweden','Norway','Denmark','Ireland','Scotland']},
  {field:'region',label:'Region / state',type:'string',desc:'State, province, or region',enabled:true,extractFrom:'region',
    keywords:['Baden-Württemberg','Bavaria','Rhineland','Saxony','Thuringia','Trentino','Alto Adige','Lombardy','Friuli','Veneto','Piedmont','Tuscany','Nagano','Yamanashi','Hokkaido','Aomori','California','Oregon','Washington','Michigan','British Columbia','Ontario','Quebec','Catalonia','Aragon','Navarra','Valencia','Andalusia','Occitanie','Provence','Alsace','Valais','Vaud','Ticino','Styria','Tyrol','Carinthia','Flanders','Wallonia','Silesia','Alentejo','Algarve']},
  {field:'locality',label:'Locality / site',type:'string',desc:'Exact site name',enabled:true,extractFrom:null},
  {field:'coordinates',label:'Coordinates',type:'string',desc:'Decimal lat/lon',enabled:true,extractFrom:null},
  {field:'sampling_year',label:'Sampling year',type:'string',desc:'Year of collection',enabled:true,extractFrom:null},
  {field:'host_plant',label:'Host / subject',type:'string',desc:'Host plant, organism, or subject',enabled:true,extractFrom:'host',
    keywords:['Prunus avium','Prunus cerasus','sweet cherry','sour cherry','cherry','Vaccinium corymbosum','Vaccinium myrtillus','blueberry','bilberry','Rubus idaeus','Rubus fruticosus','raspberry','blackberry','Fragaria','strawberry','Sambucus nigra','elderberry','Vitis vinifera','grape','Prunus persica','peach','nectarine','Ficus carica','fig','Rosa','Lonicera','Actinidia','kiwi','Morus','mulberry']},
  {field:'study_context',label:'Study context',type:'string',desc:'Brief study type description',enabled:true,extractFrom:null},
  {field:'evidence_type',label:'Evidence type',type:'enum',desc:'trap|morphology|DNA|observation|model',enabled:true,extractFrom:'evidence_type'},
  {field:'evidence_class',label:'Evidence class',type:'enum',desc:'primary|secondary|modelled|...',enabled:true,extractFrom:'evidence_class'},
  {field:'category',label:'Category',type:'enum',desc:'A|B|C|D|E|F',enabled:true,extractFrom:null},
  {field:'screening_decision',label:'Screening',type:'enum',desc:'include|exclude|maybe',enabled:true,extractFrom:null},
  {field:'screening_reason',label:'Screening reason',type:'string',desc:'Reason for decision',enabled:true,extractFrom:null},
  {field:'excerpt',label:'Excerpt',type:'string',desc:'Sentence mentioning topic/location',enabled:true,extractFrom:null},
  {field:'doi',label:'DOI',type:'string',desc:'DOI or "not reported"',enabled:true,extractFrom:null},
  {field:'url',label:'URL',type:'string',desc:'Access URL',enabled:true,extractFrom:null},
  {field:'pdf_available',label:'PDF available',type:'enum',desc:'yes|no|paywalled|unknown',enabled:true,extractFrom:null},
  {field:'verification_status',label:'Verification',type:'enum',desc:'Verified|Partly verified|...',enabled:true,extractFrom:null},
  {field:'notes',label:'Notes',type:'string',desc:'Caveats and flags',enabled:true,extractFrom:null},
  {field:'source_db',label:'Source database',type:'string',desc:'Database where record was found',enabled:true,extractFrom:null},
];
let customFields=[];
function getActiveSchema(){ return [...LIVE_SCHEMA,...customFields].filter(f=>f.enabled); }
function getKeywords(extractFrom){ const f=[...LIVE_SCHEMA,...customFields].find(s=>s.extractFrom===extractFrom); return f?(f.keywords||[]): []; }

const DB_LABELS={semanticscholar:'Semantic Scholar',openalex:'OpenAlex',europepmc:'Europe PMC',crossref:'Crossref',pubmed:'PubMed (via Europe PMC)',arxiv:'arXiv',biorxiv:'bioRxiv / medRxiv',zenodo:'Zenodo',unpaywall:'Unpaywall',base:'BASE',eppo:'EPPO Global DB',cabi:'CABI',usda:'USDA/NAL',jki:'JKI Germany',naro:'NARO Japan',caas:'CAAS China',rda:'RDA Korea',gbif:'GBIF',inat:'iNaturalist',bold:'BOLD',ncbi:'NCBI',lens:'Lens.org'};
const VERIF_CLASS={'Verified':'verif-verified','Partly verified':'verif-partly','Needs manual check':'verif-manual','Secondary citation only':'verif-secondary','No usable location':'verif-noloc'};
const SCREEN_CLASS={include:'screen-badge include',exclude:'screen-badge exclude',maybe:'screen-badge maybe'};

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════
function getSettings(){
  return {
    primaryTerms:lines('cfg-primary'),synonymTerms:lines('cfg-synonyms'),
    extraTerms:lines('cfg-extra'),excludeTerms:lines('cfg-exclude'),
    yearFrom:parseInt(document.getElementById('cfg-yr-from').value)||null,
    yearTo:parseInt(document.getElementById('cfg-yr-to').value)||null,
    maxPerQuery:parseInt(document.getElementById('cfg-max').value)||500,
    languages:document.getElementById('cfg-langs').value.split(',').map(s=>s.trim()).filter(Boolean),
    geoReq:parseInt(document.getElementById('cfg-geo-req').value)||0,
    databases:checked('#chips-academic input,#chips-gov input,#chips-bio input'),
    scope:checked('#chips-scope input'),
  };
}
function resetDefaults(){
  document.getElementById('cfg-yr-from').value='';
  document.getElementById('cfg-yr-to').value='';
  document.getElementById('cfg-max').value='500';
  document.getElementById('cfg-geo-req').value='0';
  document.getElementById('cfg-extra').value='';
  document.getElementById('cfg-exclude').value='';
  document.querySelectorAll('#chips-scope input').forEach(e=>e.checked=true);
}

// ═══════════════════════════════════════════════════════════════
// ENGINES
// ═══════════════════════════════════════════════════════════════
const DELAY=200,RETRY_WAIT=2000,MAX_RETRY=2;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function fetchJSON(url,signal,attempt=0){
  await sleep(DELAY);
  try{
    const res=await fetch(url,{headers:{'Accept':'application/json'},signal});
    if(res.status===429||res.status===503){if(attempt<MAX_RETRY){await sleep(RETRY_WAIT*(attempt+1));return fetchJSON(url,signal,attempt+1);}return null;}
    if(!res.ok)return null;
    return await res.json();
  }catch(e){if(e.name==='AbortError')throw e;return null;}
}

function reconstitute(inv){if(!inv)return '';const pos=[];for(const[w,idxs]of Object.entries(inv))for(const i of idxs)pos.push([i,w]);return pos.sort((a,b)=>a[0]-b[0]).map(p=>p[1]).join(' ');}
const mapOAType=t=>({'journal-article':'journal','dissertation':'thesis','report':'report','book-chapter':'book_chapter','proceedings-article':'conference','preprint':'grey'}[t]||'journal');
const mapCRType=t=>({'journal-article':'journal','book-chapter':'book_chapter','proceedings-article':'conference','dissertation':'thesis','report':'report','posted-content':'grey'}[t]||'journal');

let _gbifCache=null,_inatCache=null;
function resetEngineCache(){_gbifCache=null;_inatCache=null;}

async function queryOpenAlex(term,s,signal,label){
  const yr=s.yearFrom&&s.yearTo?`&filter=publication_year:${s.yearFrom}-${s.yearTo}`:'';
  const data=await fetchJSON(`https://api.openalex.org/works?search=${encodeURIComponent(term)}${yr}&per-page=100&mailto=sciwide-search@research.tool`,signal);
  if(!data)return null;
  return(data.results||[]).map(p=>({title:p.title||'',authors:(p.authorships||[]).map(a=>a.author?.display_name).filter(Boolean).join(', '),year:p.publication_year||null,abstract:reconstitute(p.abstract_inverted_index),doi:p.doi?p.doi.replace('https://doi.org/',''):'not reported',url:p.open_access?.oa_url||p.doi||'not reported',language:p.language||'',source_type:mapOAType(p.type),pdf_available:p.open_access?.is_oa?'yes':'paywalled',source_db:label||'OpenAlex'}));
}
async function queryEuropePMC(term,s,signal){
  const yr=s.yearFrom&&s.yearTo?` AND (PUB_YEAR:[${s.yearFrom} TO ${s.yearTo}])`:'';
  const data=await fetchJSON(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent('"'+term+'"'+yr)}&format=json&pageSize=100&resultType=core`,signal);
  if(!data)return null;
  return((data.resultList||{}).result||[]).map(p=>({title:p.title||'',authors:(p.authorList?.author||[]).map(a=>a.fullName).join(', '),year:parseInt(p.pubYear)||null,abstract:p.abstractText||'',doi:p.doi||'not reported',url:p.doi?`https://doi.org/${p.doi}`:'not reported',language:p.language||'',source_type:'journal',pdf_available:p.isOpenAccess==='Y'?'yes':'unknown',source_db:'Europe PMC'}));
}
async function queryPubMed(term,s,signal){
  const yr=s.yearFrom&&s.yearTo?` AND (PUB_YEAR:[${s.yearFrom} TO ${s.yearTo}])`:'';
  const data=await fetchJSON(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent('"'+term+'" AND (SRC:MED)'+yr)}&format=json&pageSize=100&resultType=core`,signal);
  if(!data)return null;
  return((data.resultList||{}).result||[]).map(p=>({title:p.title||'',authors:(p.authorList?.author||[]).map(a=>a.fullName).join(', '),year:parseInt(p.pubYear)||null,abstract:p.abstractText||'',doi:p.doi||'not reported',url:p.pmid?`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`:(p.doi?`https://doi.org/${p.doi}`:'not reported'),language:p.language||'',source_type:'journal',pdf_available:p.isOpenAccess==='Y'?'yes':'unknown',source_db:'PubMed (via Europe PMC)'}));
}
async function queryBiorxiv(term,s,signal){
  const yr=s.yearFrom&&s.yearTo?` AND (PUB_YEAR:[${s.yearFrom} TO ${s.yearTo}])`:'';
  const data=await fetchJSON(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent('"'+term+'" AND (SRC:PPR)'+yr)}&format=json&pageSize=100&resultType=core`,signal);
  if(!data)return null;
  return((data.resultList||{}).result||[]).map(p=>({title:p.title||'',authors:(p.authorList?.author||[]).map(a=>a.fullName).join(', '),year:parseInt(p.pubYear)||null,abstract:p.abstractText||'',doi:p.doi||'not reported',url:p.doi?`https://doi.org/${p.doi}`:'not reported',language:'en',source_type:'grey',pdf_available:'yes',source_db:'bioRxiv / medRxiv'}));
}
async function queryArxiv(term,s,signal){
  try{
    await sleep(DELAY);
    const res=await fetch(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(term)}&start=0&max_results=100`,{signal});
    if(!res.ok)return null;
    const xml=new DOMParser().parseFromString(await res.text(),'application/xml');
    return[...xml.querySelectorAll('entry')].map(e=>{
      const doi=(e.querySelector('doi')?.textContent||'').trim();
      const id=(e.querySelector('id')?.textContent||'').replace('http://arxiv.org/abs/','').trim();
      const yr=parseInt((e.querySelector('published')?.textContent||'').slice(0,4))||null;
      return{title:(e.querySelector('title')?.textContent||'').replace(/\s+/g,' ').trim(),authors:[...e.querySelectorAll('author name')].map(n=>n.textContent).join(', '),year:yr,abstract:(e.querySelector('summary')?.textContent||'').replace(/\s+/g,' ').trim(),doi:doi||'not reported',url:doi?`https://doi.org/${doi}`:`https://arxiv.org/abs/${id}`,language:'en',source_type:'grey',pdf_available:'yes',source_db:'arXiv'};
    }).filter(r=>(!s.yearFrom||!r.year||(r.year>=s.yearFrom))&&(!s.yearTo||!r.year||(r.year<=s.yearTo)));
  }catch(e){if(e.name==='AbortError')throw e;return null;}
}
async function queryCrossref(term,s,signal){
  const f=s.yearFrom&&s.yearTo?`&filter=from-pub-date:${s.yearFrom},until-pub-date:${s.yearTo}`:'';
  const data=await fetchJSON(`https://api.crossref.org/works?query=${encodeURIComponent(term)}${f}&rows=100&mailto=sciwide-search@research.tool`,signal);
  if(!data)return null;
  return((data.message||{}).items||[]).map(p=>({title:Array.isArray(p.title)?p.title[0]:(p.title||''),authors:(p.author||[]).map(a=>[a.family,a.given].filter(Boolean).join(' ')).join('; '),year:p.published?.['date-parts']?.[0]?.[0]||null,abstract:p.abstract?p.abstract.replace(/<[^>]+>/g,''):'',doi:p.DOI||'not reported',url:p.DOI?`https://doi.org/${p.DOI}`:'not reported',source_type:mapCRType(p.type),pdf_available:p.link?.find(l=>l['content-type']==='application/pdf')?'yes':'unknown',source_db:'Crossref'}));
}
async function queryZenodo(term,s,signal){
  const data=await fetchJSON(`https://zenodo.org/api/records?q=${encodeURIComponent(term)}&size=100&sort=mostrecent&type=publication`,signal);
  if(!data)return null;
  return((data.hits||{}).hits||[]).map(r=>({title:r.metadata?.title||'',authors:(r.metadata?.creators||[]).map(c=>c.name).join(', '),year:r.metadata?.publication_date?parseInt(r.metadata.publication_date.slice(0,4)):null,abstract:r.metadata?.description||'',doi:r.doi||r.metadata?.doi||'not reported',url:r.links?.html||'not reported',source_type:'grey',pdf_available:r.files?.length?'yes':'unknown',source_db:'Zenodo'}));
}
async function queryGBIF(signal){
  if(!_gbifCache){const data=await fetchJSON('https://api.gbif.org/v1/occurrence/search?limit=300',signal);_gbifCache=data?(data.results||[]): [];}
  return _gbifCache.map(o=>({title:`GBIF occurrence #${o.key}`,authors:o.institutionCode||o.datasetName||'GBIF',year:o.year||null,abstract:'',doi:'not reported',url:`https://www.gbif.org/occurrence/${o.key}`,country:o.country||'not reported',region:o.stateProvince||'not reported',locality:o.locality||'not reported',coordinates:(o.decimalLatitude&&o.decimalLongitude)?`${o.decimalLatitude}, ${o.decimalLongitude}`:'not reported',host_plant:o.associatedTaxa||'not reported',evidence_type:'observation',evidence_class:'primary',source_type:'occurrence',pdf_available:'unknown',source_db:'GBIF',_direct:true}));
}
async function queryINat(signal){
  if(!_inatCache){const data=await fetchJSON('https://api.inaturalist.org/v1/observations?quality_grade=research&per_page=200',signal);_inatCache=data?(data.results||[]): [];}
  return _inatCache.map(o=>({title:`iNaturalist #${o.id}`,authors:o.user?.login||'iNaturalist user',year:o.observed_on?parseInt(o.observed_on.slice(0,4)):null,abstract:o.description||'',doi:'not reported',url:`https://www.inaturalist.org/observations/${o.id}`,country:o.place_guess||'not reported',region:'not reported',locality:o.place_guess||'not reported',coordinates:o.location||'not reported',evidence_type:'observation',evidence_class:'primary',source_type:'occurrence',pdf_available:'unknown',source_db:'iNaturalist',_direct:true}));
}
async function engineQuery(db,term,s,signal){
  try{
    switch(db){
      case 'semanticscholar':return await queryOpenAlex(term,s,signal,'Semantic Scholar (via OpenAlex)');
      case 'openalex':return await queryOpenAlex(term,s,signal,'OpenAlex');
      case 'europepmc':return await queryEuropePMC(term,s,signal);
      case 'pubmed':return await queryPubMed(term,s,signal);
      case 'biorxiv':return await queryBiorxiv(term,s,signal);
      case 'arxiv':return await queryArxiv(term,s,signal);
      case 'crossref':return await queryCrossref(term,s,signal);
      case 'zenodo':return await queryZenodo(term,s,signal);
      case 'gbif':return await queryGBIF(signal);
      case 'inat':return await queryINat(signal);
      default:return[];
    }
  }catch(e){if(e.name==='AbortError')throw e;return null;}
}

// ═══════════════════════════════════════════════════════════════
// EXTRACTOR
// ═══════════════════════════════════════════════════════════════
const EV_TYPE_KW={trap:['trap','trapping','Droso-Trap','McPhail','sticky'],morphology:['morpholog','specimen','pinned','museum'],DNA:['DNA','COI','ITS','barcode','sequenc','haplotype'],model:['MaxEnt','BIOCLIM','SDM','niche'],review:['review','meta-analysis','synthesis'],lab_colony:['colony','laborator','strain','reared','isofemale']};
const EV_CLASS_KW={primary:['collect','trap','specimen','survey','monitor','field','wild','caught','detected','first record','first report'],secondary:['cited in','according to','as reported by','pers. comm'],modelled:['model','predict','project','MaxEnt'],'review-only':['review','meta-analysis','synthesis'],'lab-strain-origin':['colony origin','lab strain','lab population','reared from','isofemale']};
function extractFrom(text,list){if(!text)return 'not reported';for(const p of list){if(new RegExp('\\b'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(text))return p;}return 'not reported';}
function detectEvType(text){if(!text)return 'observation';for(const[t,kws]of Object.entries(EV_TYPE_KW))for(const k of kws)if(text.toLowerCase().includes(k.toLowerCase()))return t;return 'observation';}
function detectEvClass(text){if(!text)return 'primary';for(const[c,kws]of Object.entries(EV_CLASS_KW))for(const k of kws)if(text.toLowerCase().includes(k.toLowerCase()))return c;return 'primary';}
function extractCustomField(fd,text){return(!fd.keywords||!fd.keywords.length)?'not reported':extractFrom(text,fd.keywords);}
function assignCat(r){if(r.pub_year&&r.pub_year<1980)return 'F';if(!r.country||r.country==='not reported')return 'E';const ec=r.evidence_class||'';if(ec==='lab-strain-origin')return 'C';if(ec==='review-only'||ec==='modelled')return 'D';if(ec==='primary')return 'A';return 'B';}
function assignVerif(r){if(!r.country||r.country==='not reported')return 'No usable location';if(r.evidence_class==='secondary')return 'Secondary citation only';if(!r.locality||r.locality==='not reported')return 'Needs manual check';if(r.doi&&r.doi!=='not reported'&&r.evidence_class==='primary')return 'Verified';return 'Partly verified';}
function processHit(hit){
  const ft=[hit.title,hit.abstract].join(' ');
  const country=hit.country||extractFrom(ft,getKeywords('country'));
  const region=hit.region||extractFrom(ft,getKeywords('region'));
  const host=hit.host_plant||extractFrom(ft,getKeywords('host'));
  const evType=hit.evidence_type||detectEvType(ft);
  const evClass=hit.evidence_class||detectEvClass(ft);
  const doi=hit.doi||'not reported';
  const sentences=(hit.abstract||'').match(/[^.!?]+[.!?]+/g)||[];
  const excerpt=(sentences.find(s=>s.toLowerCase().includes((country||'').toLowerCase()))||sentences[0]||'').trim().slice(0,400)||'not reported';
  const r={
    full_citation:hit._direct?`${hit.authors} (${hit.year||'n.d.'}). ${hit.title}. ${hit.source_db}.`:`${hit.authors||''} (${hit.year||'n.d.'}). ${hit.title||'Untitled'}. DOI: ${doi}`,
    pub_year:hit.year,source_type:hit.source_type||'journal',language:hit.language||'en',
    country,region,locality:hit.locality||'not reported',coordinates:hit.coordinates||'not reported',
    sampling_year:hit.year||'not reported',host_plant:host,
    study_context:hit._direct?'Occurrence record':(evType==='lab_colony'?'Laboratory study':'Field study / survey'),
    evidence_type:evType,evidence_class:evClass,
    excerpt:hit._direct?'not reported':excerpt,
    doi,url:hit.url||(doi!=='not reported'?`https://doi.org/${doi}`:'not reported'),
    pdf_available:hit.pdf_available||'unknown',source_db:hit.source_db,
    notes:country==='not reported'?'No geographic term found — manual full-text check required.':'',
    screening_decision:'',screening_reason:'',
  };
  for(const f of customFields)r[f.field]=(f.extractFrom==='custom'&&f.keywords?.length)?extractCustomField(f,ft):'not reported';
  r.category=assignCat(r);r.verification_status=assignVerif(r);
  return[r];
}
const _seen=new Set();
function resetSeen(){_seen.clear();}
function isDuplicate(r){const key=r.doi&&r.doi!=='not reported'?r.doi:(r.full_citation||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,80);if(_seen.has(key))return true;_seen.add(key);return false;}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════
function exportCSV(cat){
  const data=(window._SWDRecords||[]).filter(r=>cat==='all'||r.category===cat);
  if(!data.length){alert('No records. Run a search first.');return;}
  const rows=data.map(r=>{const sc=getScreening(r);return{...r,screening_decision:sc.decision,screening_reason:sc.reason};});
  const active=getActiveSchema();
  const csvRows=rows.map(r=>active.map(s=>`"${String(r[s.field]||'').replace(/"/g,'""').replace(/\n/g,' ')}"`).join(','));
  dlFile([active.map(s=>s.label||s.field).join(','),...csvRows].join('\r\n'),`sciwide_records${cat!=='all'?'_cat'+cat:''}_${stamp()}.csv`,'text/csv;charset=utf-8;');
}
function exportJSON(){
  if(!(window._SWDRecords||[]).length){alert('No records.');return;}
  const out=(window._SWDRecords||[]).map(r=>{const sc=getScreening(r);return{...r,screening_decision:sc.decision,screening_reason:sc.reason};});
  dlFile(JSON.stringify(out,null,2),`sciwide_records_${stamp()}.json`,'application/json');
}
function exportBibtex(){
  const data=(window._SWDRecords||[]).filter(r=>r.doi&&r.doi!=='not reported');
  if(!data.length){alert('No records with DOIs.');return;}
  const entries=data.map((r,i)=>{const key=`record${r.pub_year||'nd'}_${i+1}`;const au=(r.full_citation||'').split('(')[0].trim().replace(/,\s*$/,'');const m=(r.full_citation||'').match(/\)\.\s+(.+?)\.\s+DOI:/);return `@article{${key},\n  author={${au}},\n  year={${r.pub_year||''}},\n  title={${m?m[1]:'Study'}},\n  doi={${r.doi}}\n}`;});
  dlFile(entries.join('\n\n'),`sciwide_${stamp()}.bib`,'text/plain;charset=utf-8;');
}
function exportRIS(){
  const data=window._SWDRecords||[];
  if(!data.length){alert('No records. Run a search first.');return;}
  const ris=data.map(r=>{
    const au=(r.full_citation||'').split('(')[0].trim().split(';').map(a=>a.trim()).filter(Boolean);
    const m=(r.full_citation||'').match(/\)\.\s+(.+?)\.\s+DOI:/);
    const title=m?m[1].trim():(r.full_citation||'').slice(0,120);
    const sc=getScreening(r);
    const ln=['TY  - JOUR'];
    au.forEach(a=>ln.push(`AU  - ${a}`));
    ln.push(`PY  - ${r.pub_year||''}`);
    ln.push(`TI  - ${title}`);
    if(r.doi&&r.doi!=='not reported')ln.push(`DO  - ${r.doi}`);
    if(r.url&&r.url!=='not reported')ln.push(`UR  - ${r.url}`);
    if(r.country&&r.country!=='not reported')ln.push(`CY  - ${r.country}`);
    ln.push(`N1  - Cat: ${r.category} | Verif: ${r.verification_status} | DB: ${r.source_db}`);
    if(r.notes)ln.push(`N2  - ${r.notes}`);
    if(sc.decision)ln.push(`KW  - screening:${sc.decision}`);
    if(sc.reason)ln.push(`KW  - reason:${sc.reason}`);
    ln.push('ER  - ');
    return ln.join('\r\n');
  });
  dlFile(ris.join('\r\n\r\n'),`sciwide_${stamp()}.ris`,'application/x-research-info-systems;charset=utf-8;');
}
function exportGeoJSON(){
  const data=(window._SWDRecords||[]).filter(r=>r.coordinates&&r.coordinates!=='not reported');
  if(!data.length){alert('No records with coordinates.');return;}
  const active=getActiveSchema();
  const features=data.map(r=>{const[lat,lon]=r.coordinates.split(',').map(s=>parseFloat(s.trim()));const props={};active.forEach(s=>props[s.label||s.field]=r[s.field]||'');return{type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:props};});
  dlFile(JSON.stringify({type:'FeatureCollection',features},null,2),`sciwide_geo_${stamp()}.geojson`,'application/json');
}
function exportSchema(){dlFile(JSON.stringify([...LIVE_SCHEMA,...customFields],null,2),`sciwide_schema_${stamp()}.json`,'application/json');}
function exportMissing(){
  const items=lines('cfg-missing');if(!items.length){alert('No known-gap sources listed yet.');return;}
  dlFile(['Known gaps / hard-to-access sources','═'.repeat(56),'Generated: '+new Date().toISOString(),'',...items.map((s,i)=>`${i+1}. ${s}`)].join('\n'),`missing_sources_${stamp()}.txt`,'text/plain;charset=utf-8;');
}
function exportSearchLog(){
  if(!_searchLog.length){alert('No search log yet. Run a search first.');return;}
  const s=getSettings();
  const terms=[...s.primaryTerms,...s.synonymTerms,...s.extraTerms];
  const dbs=[...new Set(_searchLog.map(l=>l.db))];
  const allRec=window._SWDRecords||[];
  const inc=allRec.filter(r=>getScreening(r).decision==='include').length;
  const exc=allRec.filter(r=>getScreening(r).decision==='exclude').length;
  const maybe=allRec.filter(r=>getScreening(r).decision==='maybe').length;
  const un=allRec.filter(r=>!getScreening(r).decision).length;
  const hdr=[
    'SciWide Search — PRISMA-style Search Report','═'.repeat(60),
    `Generated: ${new Date().toISOString()}`,'',
    '── SEARCH STRATEGY ───────────────────────────────────────────',
    `Primary terms (${terms.length}):`,
    ...terms.map(t=>`  • ${t}`),'',
    `Databases searched (${dbs.length}):`,
    ...dbs.map(d=>`  • ${DB_LABELS[d]||d}`),'',
    `Year range: ${s.yearFrom||'(all)'} – ${s.yearTo||'(all)'}`,
    `Total queries: ${_searchLog.length}`,
    `Total raw hits: ${_searchLog.reduce((a,l)=>a+l.hits,0)}`,
    `After deduplication: ${_searchLog.reduce((a,l)=>a+(l.new||0),0)}`,
    `Records in session: ${allRec.length}`,'',
    '── SCREENING SUMMARY ─────────────────────────────────────────',
    `Included: ${inc}  Excluded: ${exc}  Maybe: ${maybe}  Unscreened: ${un}`,'',
    '── QUERY-BY-QUERY LOG ─────────────────────────────────────────',
    'Timestamp                | Database                      | Term                          | Hits | New | Dupes',
    '─'.repeat(105),
  ];
  const rows=_searchLog.map(l=>`${l.ts.replace('T',' ').slice(0,19)} | ${(DB_LABELS[l.db]||l.db).padEnd(29)} | ${(l.term||'(occurrence)').slice(0,29).padEnd(29)} | ${String(l.hits).padStart(4)} | ${String(l.new||0).padStart(3)} | ${String(l.dupes||0).padStart(5)}`);
  dlFile([...hdr,...rows].join('\n'),`sciwide_search_log_${stamp()}.txt`,'text/plain;charset=utf-8;');
}
function exportScreened(decision){
  const data=(window._SWDRecords||[]).filter(r=>getScreening(r).decision===decision);
  if(!data.length){alert(`No records marked as "${decision}" yet.`);return;}
  const active=getActiveSchema();
  const headers=[...active.map(s=>s.label||s.field),'Screening','Reason'];
  const rows=data.map(r=>{const sc=getScreening(r);return[...active.map(s=>`"${String(r[s.field]||'').replace(/"/g,'""')}"`),`"${sc.decision}"`,`"${sc.reason.replace(/"/g,'""')}"`].join(',');});
  dlFile([headers.join(','),...rows].join('\r\n'),`sciwide_${decision}_${stamp()}.csv`,'text/csv;charset=utf-8;');
}
function getPaywalled(){return(window._SWDRecords||[]).filter(r=>r.doi&&r.doi!=='not reported'&&(r.pdf_available==='paywalled'||r.pdf_available==='no'||r.pdf_available==='unknown'));}
function exportDelimited(){
  const data=window._SWDRecords||[];
  if(!data.length){alert('No records. Run a search first.');return;}
  const delimEl=document.getElementById('custom-delim');
  const delimRaw=(delimEl?.value||'tab');
  const delim=delimRaw==='tab'?'\t':delimRaw==='semicolon'?';':delimRaw==='pipe'?'|':(delimRaw.slice(0,1)||',');
  const doQuote=document.getElementById('custom-quote')?.value!=='none';
  const includeHeader=document.getElementById('custom-header')?.value!=='no';
  const active=getActiveSchema();
  function cell(v){const s=String(v||'').replace(/\n/g,' ');if(doQuote)return '"'+s.replace(/"/g,'""')+'"';return s.replace(new RegExp('\\'+delim,'g'),' ');}
  const rows=data.map(r=>{const sc=getScreening(r);const full={...r,screening_decision:sc.decision,screening_reason:sc.reason};return active.map(s=>cell(full[s.field]||'')).join(delim);});
  const header=active.map(s=>cell(s.label||s.field)).join(delim);
  const ext=delim==='\t'?'tsv':'csv';
  dlFile([...(includeHeader?[header]:[]),...rows].join('\r\n'),`sciwide_records_${stamp()}.${ext}`,'text/plain;charset=utf-8;');
}
// Phase 4: EndNote XML
function exportEndNoteXML(){
  const data=window._SWDRecords||[];
  if(!data.length){alert('No records. Run a search first.');return;}
  function x(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  const records=data.map((r,i)=>{
    const au=(r.full_citation||'').split('(')[0].trim().split(';').map(a=>a.trim()).filter(Boolean);
    const m=(r.full_citation||'').match(/\)\.\s+(.+?)\.\s+DOI:/);
    const title=m?m[1].trim():(r.full_citation||'').slice(0,200);
    const sc=getScreening(r);
    const auXml=au.map(a=>`<author>${x(a)}</author>`).join('');
    return `  <record>\n    <ref-type name="Journal Article">17</ref-type>\n    <contributors><authors>${auXml}</authors></contributors>\n    <titles><title>${x(title)}</title></titles>\n    <dates><year>${x(String(r.pub_year||''))}</year></dates>\n    <place-published>${x(r.country||'')}</place-published>\n    <isbn>${x(r.doi&&r.doi!=='not reported'?r.doi:'')}</isbn>\n    <urls><related-urls><url>${x(r.url&&r.url!=='not reported'?r.url:'')}</url></related-urls></urls>\n    <electronic-resource-num>${x(r.doi&&r.doi!=='not reported'?r.doi:'')}</electronic-resource-num>\n    <abstract>${x(r.excerpt&&r.excerpt!=='not reported'?r.excerpt:'')}</abstract>\n    <notes>${x(`Cat: ${r.category} | DB: ${r.source_db}${sc.decision?' | Screen: '+sc.decision:''}`)}</notes>\n    <keywords>${sc.decision?`<keyword>screening:${x(sc.decision)}</keyword>`:''}</keywords>\n    <language>${x(r.language||'en')}</language>\n  </record>`;
  }).join('\n');
  dlFile(`<?xml version="1.0" encoding="UTF-8"?>\n<xml><records>\n${records}\n</records></xml>`,`sciwide_${stamp()}.xml`,'application/xml;charset=utf-8;');
}
// Phase 4: Markdown summary
function exportMarkdown(){
  const data=window._SWDRecords||[];
  if(!data.length){alert('No records. Run a search first.');return;}
  const s=getSettings();
  const terms=[...s.primaryTerms,...s.synonymTerms,...s.extraTerms];
  const inc=data.filter(r=>getScreening(r).decision==='include').length;
  const exc=data.filter(r=>getScreening(r).decision==='exclude').length;
  const catMap={A:0,B:0,C:0,D:0,E:0,F:0};data.forEach(r=>{if(catMap[r.category]!==undefined)catMap[r.category]++;});
  const countryMap={};data.forEach(r=>{if(r.country&&r.country!=='not reported')countryMap[r.country]=(countryMap[r.country]||0)+1;});
  const topC=Object.entries(countryMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const dbs=[...new Set(data.map(r=>r.source_db).filter(Boolean))];
  const out=[
    `# SciWide Search — Session Summary`,``,
    `**Generated:** ${new Date().toISOString()}  `,
    `**Citation:** Ebrahimi, M. (2026). *SciWide Search* [Software]. https://github.com/mehregan59/Sc_wide_Search`,``,
    `## Search strategy`,``,
    terms.length?`**Terms:** ${terms.map(t=>`\`${t}\``).join(', ')}`:'*No terms recorded.*',``,
    `**Year range:** ${s.yearFrom||'(all)'} – ${s.yearTo||'(all)'}`,``,
    `**Databases:** ${dbs.join(', ')||'(none recorded)'}`,``,
    `## Records overview`,``,
    `| Metric | Count |`,`|---|---|`,
    `| Total records | ${data.length} |`,
    `| Included (screening) | ${inc} |`,
    `| Excluded (screening) | ${exc} |`,``,
    `## Category breakdown`,``,
    `| Category | Label | Count |`,`|---|---|---|`,
    `| A | Primary location records | ${catMap.A} |`,
    `| B | Useful sampling locations | ${catMap.B} |`,
    `| C | Lab / strain origin | ${catMap.C} |`,
    `| D | Modelling / review | ${catMap.D} |`,
    `| E | No usable location | ${catMap.E} |`,
    `| F | Pre-1980 records | ${catMap.F} |`,``,
    `## Top countries`,``,`| Country | Records |`,`|---|---|`,
    ...topC.map(([c,n])=>`| ${c} | ${n} |`),``,
    `## Included records`,``,
  ];
  const incData=data.filter(r=>getScreening(r).decision==='include');
  if(incData.length){
    out.push(`| # | Authors | Year | Country | DOI |`,`|---|---|---|---|---|`);
    incData.forEach((r,i)=>{const au=(r.full_citation||'').split('(')[0].trim().slice(0,60);const doi=r.doi&&r.doi!=='not reported'?`[${r.doi}](https://doi.org/${r.doi})`:'—';out.push(`| ${i+1} | ${au} | ${r.pub_year||'—'} | ${r.country||'—'} | ${doi} |`);});
  } else { out.push('*No records marked as included yet.*'); }
  out.push('');
  dlFile(out.join('\n'),`sciwide_summary_${stamp()}.md`,'text/markdown;charset=utf-8;');
}
function exportPaywallTxt(){
  const data=getPaywalled();if(!data.length){alert('No paywalled records.');return;}
  dlFile(['Paywalled papers — DOI list','═'.repeat(40),`Generated: ${new Date().toISOString()}`,`Total: ${data.length}`,'','ACCESS OPTIONS:','  1. Email corresponding author (Google Scholar / ResearchGate)','  2. Interlibrary loan (ILL) — free, 24–48h','  3. https://unpaywall.org/<DOI>','  4. https://europepmc.org/search?query=<DOI>','','─'.repeat(60),'',...data.map((r,i)=>`[${i+1}] DOI: ${r.doi}\n    Authors: ${(r.full_citation||'').split('(')[0].trim().slice(0,100)}\n    Year: ${r.pub_year||'n.d.'} | Category: ${r.category}\n    Link: https://doi.org/${r.doi}\n    Unpaywall: https://unpaywall.org/${r.doi}\n`)].join('\n'),`paywalled_dois_${stamp()}.txt`,'text/plain;charset=utf-8;');
}
function exportPaywallCsv(){
  const data=getPaywalled();if(!data.length){alert('No paywalled records.');return;}
  const rows=data.map(r=>{const au=(r.full_citation||'').split('(')[0].trim().slice(0,120);return[`"${r.doi}"`,`"${r.pub_year||''}"`,`"${au.replace(/"/g,'""')}"`,`"${r.country}"`,`"${r.category}"`,`"https://doi.org/${r.doi}"`,`"https://unpaywall.org/${r.doi}"`].join(',');});
  dlFile(['doi,pub_year,authors,country,category,doi_url,unpaywall_url',...rows].join('\r\n'),`paywalled_dois_${stamp()}.csv`,'text/csv;charset=utf-8;');
}
function copyDOI(doi,codeId){navigator.clipboard.writeText(doi).then(()=>{const el=document.getElementById(codeId);if(el){el.style.background='var(--accent-lt)';setTimeout(()=>el.style.background='',1200);}});}
window.copyDOI=copyDOI;
function copyCitation(btn){navigator.clipboard.writeText('Ebrahimi, M. (2026). SciWide Search [Software]. https://github.com/mehregan59/Sc_wide_Search').then(()=>{if(btn){const o=btn.textContent;btn.textContent='Copied!';setTimeout(()=>btn.textContent=o,1500);}});}
window.copyCitation=copyCitation;
function renderPaywallPanel(){
  const el=document.getElementById('paywall-list'),countEl=document.getElementById('paywall-count');
  if(!el)return;
  const q=(document.getElementById('paywall-search')?.value||'').toLowerCase();
  let data=getPaywalled();
  if(q)data=data.filter(r=>[r.full_citation,r.country,String(r.pub_year||'')].join(' ').toLowerCase().includes(q));
  if(countEl)countEl.textContent=data.length?`${data.length} papers`:'';
  if(!data.length){el.innerHTML='<div class="paywall-empty">No paywalled papers found. Run a search first.</div>';return;}
  el.innerHTML=data.map((r,i)=>{
    const au=(r.full_citation||'').split('(')[0].trim().slice(0,80);
    const m=(r.full_citation||'').match(/\)\.\s+(.+?)\.\s+DOI:/);
    const title=m?m[1].slice(0,200):(r.full_citation||'').slice(0,120);
    return `<div class="paywall-row"><div class="paywall-index">${i+1}</div><div class="paywall-body"><div class="paywall-title">${esc(title)}</div><div class="paywall-meta">${esc(au)} &middot; ${r.pub_year||'n.d.'} &middot; ${esc(r.country||'—')}</div><div class="paywall-doi"><code class="doi-code" id="doi-code-${i}">${esc(r.doi)}</code><button class="btn btn-sm paywall-copy" onclick="copyDOI('${r.doi}','doi-code-${i}')">Copy DOI</button></div><div class="paywall-actions"><a class="paywall-action-link" href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">Publisher →</a> <a class="paywall-action-link" href="https://scholar.google.com/scholar?q=${encodeURIComponent(r.doi)}" target="_blank" rel="noopener">Google Scholar →</a> <a class="paywall-action-link" href="https://europepmc.org/search?query=${encodeURIComponent(r.doi)}" target="_blank" rel="noopener">Europe PMC →</a> <a class="paywall-action-link" href="https://unpaywall.org/${esc(r.doi)}" target="_blank" rel="noopener">Unpaywall →</a></div></div></div>`;
  }).join('');
}
window.SWDExportFn={csv:exportCSV,delimited:exportDelimited,json:exportJSON,bibtex:exportBibtex,ris:exportRIS,endnotexml:exportEndNoteXML,markdown:exportMarkdown,geojson:exportGeoJSON,missing:exportMissing,schema:exportSchema,searchLog:exportSearchLog,screened:exportScreened,paywallTxt:exportPaywallTxt,paywallCsv:exportPaywallCsv};

// ═══════════════════════════════════════════════════════════════
// SCHEMA EDITOR
// ═══════════════════════════════════════════════════════════════
function renderSchemaEditor(){
  const tbody=document.getElementById('schema-editor-tbody');if(!tbody)return;
  const all=[...LIVE_SCHEMA,...customFields];
  tbody.innerHTML=all.map((f,i)=>{
    const isCustom=i>=LIVE_SCHEMA.length,kwCount=f.keywords?f.keywords.length:0;
    return `<tr class="${f.enabled?'':'schema-row-disabled'}"><td><label class="schema-toggle"><input type="checkbox" ${f.enabled?'checked':''} onchange="SWDSchema.toggle('${f.field}',this.checked)"></label></td><td><code class="field-name" style="font-size:11px">${f.field}</code></td><td><input type="text" value="${esc(f.label||f.field)}" class="schema-label-input" onchange="SWDSchema.rename('${f.field}',this.value)" placeholder="Column label" /></td><td style="font-size:11px;color:var(--ink-3)">${f.type}</td><td>${f.extractFrom?`<button class="btn btn-sm btn-ghost schema-kw-btn" onclick="SWDSchema.editKeywords('${f.field}')">${kwCount} keywords</button>`:'<span style="font-size:11px;color:var(--ink-3)">—</span>'}</td><td>${isCustom?`<button class="btn btn-sm btn-ghost" onclick="SWDSchema.removeCustom('${f.field}')" style="color:var(--red)">Remove</button>`:'<span style="font-size:11px;color:var(--ink-3)">core</span>'}</td></tr>`;
  }).join('');
}
function renderSchemaPreview(){const tbody=document.getElementById('schema-tbody');if(!tbody)return;tbody.innerHTML=getActiveSchema().map(s=>`<tr><td class="field-name">${s.field}</td><td class="field-type">${s.type}</td><td style="font-size:12.5px;color:var(--ink-2)">${s.label||s.field} — ${s.desc||''}</td></tr>`).join('');}
window.SWDSchema={
  toggle(field,enabled){const f=[...LIVE_SCHEMA,...customFields].find(s=>s.field===field);if(f){f.enabled=enabled;renderSchemaEditor();renderSchemaPreview();renderTable();}},
  rename(field,label){const f=[...LIVE_SCHEMA,...customFields].find(s=>s.field===field);if(f){f.label=label;renderSchemaPreview();renderTable();}},
  editKeywords(field){
    const f=[...LIVE_SCHEMA,...customFields].find(s=>s.field===field);if(!f)return;
    document.getElementById('kw-modal-title').textContent=`Keywords for "${f.label||f.field}"`;
    document.getElementById('kw-modal-ta').value=(f.keywords||[]).join('\n');
    document.getElementById('kw-modal').style.display='flex';
    document.getElementById('kw-modal-save').onclick=()=>{f.keywords=document.getElementById('kw-modal-ta').value.split('\n').map(s=>s.trim()).filter(Boolean);document.getElementById('kw-modal').style.display='none';renderSchemaEditor();};
  },
  addCustomField(){
    const name=(document.getElementById('new-field-name').value||'').trim().replace(/[^a-z0-9_]/gi,'_').toLowerCase();
    const label=(document.getElementById('new-field-label').value||'').trim()||name;
    const kws=document.getElementById('new-field-kw').value.split('\n').map(s=>s.trim()).filter(Boolean);
    if(!name){alert('Field name required.');return;}
    if([...LIVE_SCHEMA,...customFields].find(f=>f.field===name)){alert('Name already exists.');return;}
    customFields.push({field:name,label,type:'string',desc:'Custom field',enabled:true,extractFrom:'custom',keywords:kws});
    document.getElementById('new-field-name').value='';document.getElementById('new-field-label').value='';document.getElementById('new-field-kw').value='';
    renderSchemaEditor();renderSchemaPreview();
  },
  removeCustom(field){customFields=customFields.filter(f=>f.field!==field);renderSchemaEditor();renderSchemaPreview();renderTable();},
  loadJSON(){
    const inp=document.createElement('input');inp.type='file';inp.accept='.json';
    inp.onchange=e=>{
      const file=e.target.files[0];if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>{
        try{
          const loaded=JSON.parse(ev.target.result);if(!Array.isArray(loaded)){alert('Invalid schema file.');return;}
          loaded.forEach(lf=>{const target=LIVE_SCHEMA.find(s=>s.field===lf.field);if(target){if(lf.label!=null)target.label=lf.label;if(typeof lf.enabled==='boolean')target.enabled=lf.enabled;if(lf.keywords)target.keywords=lf.keywords;}else if(lf.field&&!customFields.find(c=>c.field===lf.field)){customFields.push({field:lf.field,label:lf.label||lf.field,type:lf.type||'string',desc:lf.desc||'',enabled:lf.enabled!==false,extractFrom:'custom',keywords:lf.keywords||[]});}});
          renderSchemaEditor();renderSchemaPreview();renderTable();alert('Schema loaded.');
        }catch(err){alert('Could not parse schema: '+err.message);}
      };reader.readAsText(file);
    };inp.click();
  },
};

// ═══════════════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════════════
function serializePreset(name){
  return {presetName:name||'Untitled preset',version:1,terms:{primary:lines('cfg-primary'),synonyms:lines('cfg-synonyms'),extra:lines('cfg-extra'),exclude:lines('cfg-exclude')},filters:{yearFrom:parseInt(document.getElementById('cfg-yr-from').value)||null,yearTo:parseInt(document.getElementById('cfg-yr-to').value)||null,maxPerQuery:parseInt(document.getElementById('cfg-max').value)||500,languages:document.getElementById('cfg-langs').value,geoReq:parseInt(document.getElementById('cfg-geo-req').value)||0},databases:checked('#chips-academic input,#chips-gov input,#chips-bio input'),scope:checked('#chips-scope input'),missingSources:lines('cfg-missing'),schema:{fields:LIVE_SCHEMA.map(f=>({field:f.field,label:f.label,enabled:f.enabled,keywords:f.keywords})),customFields:customFields.map(f=>({field:f.field,label:f.label,type:f.type,desc:f.desc,enabled:f.enabled,keywords:f.keywords}))}};
}
function applyPreset(data){
  if(!data||typeof data!=='object'){alert('That file does not look like a SciWide Search preset.');return;}
  const t=data.terms||{};setLines('cfg-primary',t.primary);setLines('cfg-synonyms',t.synonyms);setLines('cfg-extra',t.extra);setLines('cfg-exclude',t.exclude);
  const f=data.filters||{};if(f.yearFrom!=null)document.getElementById('cfg-yr-from').value=f.yearFrom;if(f.yearTo!=null)document.getElementById('cfg-yr-to').value=f.yearTo;if(f.maxPerQuery!=null)document.getElementById('cfg-max').value=f.maxPerQuery;if(f.languages!=null)document.getElementById('cfg-langs').value=f.languages;if(f.geoReq!=null)document.getElementById('cfg-geo-req').value=f.geoReq;
  setChecked('#chips-academic input,#chips-gov input,#chips-bio input',data.databases);setChecked('#chips-scope input',data.scope);setLines('cfg-missing',data.missingSources);renderMissingSources();
  if(data.schema){(data.schema.fields||[]).forEach(fdef=>{const target=LIVE_SCHEMA.find(s=>s.field===fdef.field);if(target){if(fdef.label!=null)target.label=fdef.label;if(fdef.enabled!=null)target.enabled=fdef.enabled;if(fdef.keywords)target.keywords=fdef.keywords;}});if(Array.isArray(data.schema.customFields))customFields=data.schema.customFields.map(cf=>({field:cf.field,label:cf.label||cf.field,type:cf.type||'string',desc:cf.desc||'Custom field',enabled:cf.enabled!==false,extractFrom:'custom',keywords:cf.keywords||[]}));}
  if(data.presetName){const el=document.getElementById('preset-name');if(el)el.value=data.presetName;}
  renderSchemaEditor();renderSchemaPreview();renderTable();logMsg(`Preset "${esc(data.presetName||'Untitled')}" loaded.`,'ok');
}
function savePreset(){const name=(document.getElementById('preset-name')?.value||'').trim();if(!name){alert('Give this preset a name first.');return;}const safe=name.replace(/[^a-z0-9_\- ]/gi,'').trim().replace(/\s+/g,'_')||'preset';dlFile(JSON.stringify(serializePreset(name),null,2),`${safe}.json`,'application/json');}
function loadPresetFile(){document.getElementById('preset-file-input').click();}
function handlePresetFile(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{try{applyPreset(JSON.parse(ev.target.result));}catch(err){alert('Could not read preset: '+err.message);}};reader.readAsText(file);e.target.value='';}
async function loadPresetFromUrl(){const url=(document.getElementById('preset-url')?.value||'').trim();if(!url){alert('Enter a URL to a preset .json file.');return;}try{const res=await fetch(url);if(!res.ok)throw new Error(`HTTP ${res.status}`);applyPreset(await res.json());}catch(err){alert('Could not load preset from URL (likely CORS). Download and use "Load from file" instead.\n\n'+err.message);}}
async function loadBundledPreset(){const path=document.getElementById('bundled-preset-select')?.value;if(!path)return;try{const res=await fetch(path);if(!res.ok)throw new Error(`HTTP ${res.status}`);applyPreset(await res.json());}catch(err){alert('Could not load preset: '+err.message);}}
function renderMissingSources(){const el=document.getElementById('missing-list');if(!el)return;const items=lines('cfg-missing');el.innerHTML=items.length?items.map(s=>`<div class="missing-item">${esc(s)}</div>`).join(''):'<div class="missing-item" style="opacity:.65">No known gaps listed yet.</div>';}

// ═══════════════════════════════════════════════════════════════
// SCREENING UI
// ═══════════════════════════════════════════════════════════════
function renderScreeningCounts(){
  const all=window._SWDRecords||[];
  const inc=all.filter(r=>getScreening(r).decision==='include').length;
  const exc=all.filter(r=>getScreening(r).decision==='exclude').length;
  const maybe=all.filter(r=>getScreening(r).decision==='maybe').length;
  const un=all.filter(r=>!getScreening(r).decision).length;
  const el=document.getElementById('screening-counts');
  if(el)el.innerHTML=`<span class="screen-badge include">${inc} included</span> <span class="screen-badge exclude">${exc} excluded</span> <span class="screen-badge maybe">${maybe} maybe</span> <span class="screen-badge unscreened">${un} unscreened</span>`;
}
window.applyScreening=function(key,decision,reasonId){
  const reason=(document.getElementById(reasonId)?.value||'').trim();
  const r=(window._SWDRecords||[]).find(rec=>screeningKey(rec)===key);
  if(r)setScreening(r,decision,reason);
  renderTable();renderScreeningCounts();
};

// ═══════════════════════════════════════════════════════════════
// APP / UI
// ═══════════════════════════════════════════════════════════════
window._SWDRecords=[];
let isRunning=false,abortCtrl=null,midTerms=[],currentCat='all',screenFilter='';
let stats={queries:0,raw:0,dedup:0,records:0,noloc:0,errors:0,skipped:0};
const catCounts={A:0,B:0,C:0,D:0,E:0,F:0};
const STUB_DBS=new Set(['unpaywall','base','eppo','cabi','usda','jki','naro','caas','rda','bold','ncbi','lens']);
const ONCE_DBS=new Set(['gbif','inat']);

document.querySelectorAll('.nav-tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
document.getElementById('btn-start-from-config').addEventListener('click',()=>{switchTab('run');startSearch();});
document.getElementById('btn-reset-config').addEventListener('click',resetDefaults);
document.getElementById('btn-run').addEventListener('click',startSearch);
document.getElementById('btn-stop').addEventListener('click',()=>{if(abortCtrl)abortCtrl.abort();});
document.getElementById('btn-add-term').addEventListener('click',addMidTerm);
document.getElementById('mid-term').addEventListener('keydown',e=>{if(e.key==='Enter')addMidTerm();});
document.getElementById('btn-apply-yr').addEventListener('click',()=>{const f=document.getElementById('mid-yr-from').value,t=document.getElementById('mid-yr-to').value;if(f)document.getElementById('cfg-yr-from').value=f;if(t)document.getElementById('cfg-yr-to').value=t;logMsg(`Year range updated: ${f||'—'}–${t||'—'}`,'warn');});
document.getElementById('btn-add-db').addEventListener('click',()=>{const db=document.getElementById('mid-db-select').value;if(!db)return;logMsg(`Database queued: ${DB_LABELS[db]||db}`,'ok');const el=document.querySelector(`input[value="${db}"]`);if(el)el.checked=true;});
document.getElementById('res-search').addEventListener('input',renderTable);
document.getElementById('res-verif').addEventListener('change',renderTable);
document.getElementById('res-sort').addEventListener('change',renderTable);
document.getElementById('res-screen-filter')?.addEventListener('change',e=>{screenFilter=e.target.value;renderTable();});
document.querySelectorAll('.cat-filter-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.cat-filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');currentCat=btn.dataset.cat;renderTable();}));
const pwSearch=document.getElementById('paywall-search');
if(pwSearch)pwSearch.addEventListener('input',renderPaywallPanel);
document.getElementById('kw-modal-cancel').addEventListener('click',()=>{document.getElementById('kw-modal').style.display='none';});
document.getElementById('kw-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.style.display='none';});
document.getElementById('btn-add-custom-field').addEventListener('click',()=>SWDSchema.addCustomField());
document.getElementById('btn-save-preset').addEventListener('click',savePreset);
document.getElementById('btn-load-preset-file').addEventListener('click',loadPresetFile);
document.getElementById('preset-file-input').addEventListener('change',handlePresetFile);
document.getElementById('btn-load-preset-url').addEventListener('click',loadPresetFromUrl);
document.getElementById('btn-load-bundled-preset').addEventListener('click',loadBundledPreset);
const missingTa=document.getElementById('cfg-missing');
if(missingTa)missingTa.addEventListener('input',renderMissingSources);

renderSchemaEditor();renderSchemaPreview();renderMissingSources();

// ── Search ──────────────────────────────────────────────────
async function startSearch(){
  if(isRunning)return;
  isRunning=true;abortCtrl=new AbortController();
  window._SWDRecords=[];resetSeen();resetEngineCache();clearSearchLog();_screening.clear();
  stats={queries:0,raw:0,dedup:0,records:0,noloc:0,errors:0,skipped:0};
  Object.keys(catCounts).forEach(k=>catCounts[k]=0);
  document.getElementById('log-box').innerHTML='';
  setProgress(0,'Initialising…');setStatus('running','Running');
  document.getElementById('btn-run').disabled=true;
  document.getElementById('btn-stop').disabled=false;

  const s=getSettings();
  const allTerms=[...s.primaryTerms,...s.synonymTerms,...s.extraTerms,...midTerms].filter(Boolean);
  const signal=abortCtrl.signal;
  if(!allTerms.length){logMsg('No search terms entered. Add terms in Configure, or load a preset.','err');setStatus('stopped','No terms');setProgress(null,'No terms');isRunning=false;document.getElementById('btn-run').disabled=false;document.getElementById('btn-stop').disabled=true;return;}

  const searchDBs=s.databases.filter(db=>!STUB_DBS.has(db)&&!ONCE_DBS.has(db));
  const occDBs=s.databases.filter(db=>ONCE_DBS.has(db));
  const stubDBs=s.databases.filter(db=>STUB_DBS.has(db));
  const total=(searchDBs.length*allTerms.length)+occDBs.length;
  let done=0;

  logMsg(`Search started — ${searchDBs.length} search DBs × ${allTerms.length} terms + ${occDBs.length} occurrence DBs`);
  if(stubDBs.length)logMsg(`Stubs (not yet wired): ${stubDBs.map(d=>DB_LABELS[d]||d).join(', ')}`,'warn');
  if(s.yearFrom||s.yearTo)logMsg(`Year range: ${s.yearFrom||'open'}–${s.yearTo||'open'}`);

  for(const db of occDBs){
    if(signal.aborted)break;
    const label=DB_LABELS[db]||db;logMsg(`Fetching ${label}…`);stats.queries++;
    try{
      const hits=await engineQuery(db,'',s,signal);
      if(hits===null){logMsg(`  ⚠ ${label} unreachable`,'warn');stats.skipped++;}
      else{stats.raw+=hits.length;let n=0,dupes=0;for(const h of hits)for(const r of processHit(h)){if(isDuplicate(r)){dupes++;continue;}window._SWDRecords.push(r);n++;stats.dedup++;if(r.category==='E')stats.noloc++;else{stats.records++;catCounts[r.category]=(catCounts[r.category]||0)+1;}}logSearch(db,'',hits.length,n,dupes);logMsg(`  → ${hits.length} occurrences · ${n} new`,hits.length?'ok':'warn');}
    }catch(e){if(e.name==='AbortError')break;stats.errors++;logMsg(`  ✖ ${label}: ${e.message}`,'err');}
    updateStats();done++;setProgress((done/total)*100,label);
  }

  for(const db of searchDBs){
    if(signal.aborted)break;
    const label=DB_LABELS[db]||db;
    for(const term of allTerms){
      if(signal.aborted)break;
      logMsg(`${label} ← "${term.slice(0,55)}${term.length>55?'…':''}"`);stats.queries++;updateStats();
      try{
        const hits=await engineQuery(db,term,s,signal);
        if(hits===null){logMsg(`  ⚠ ${label} unreachable — skipped`,'warn');stats.skipped++;}
        else{stats.raw+=hits.length;let n=0,dupes=0;for(const h of hits)for(const r of processHit(h)){if(isDuplicate(r)){dupes++;continue;}window._SWDRecords.push(r);n++;stats.dedup++;if(r.category==='E')stats.noloc++;else{stats.records++;catCounts[r.category]=(catCounts[r.category]||0)+1;}}logSearch(db,term,hits.length,n,dupes);if(hits.length===0)logMsg(`  → 0 results`,'warn');else logMsg(`  → ${hits.length} hits · ${n} new · ${dupes} dupes`,'ok');}
      }catch(e){if(e.name==='AbortError')break;stats.errors++;logMsg(`  ✖ ${label}: ${e.message}`,'err');}
      updateStats();done++;setProgress((done/total)*100,`${label} · "${term.slice(0,28)}"`);
    }
  }

  const stopped=signal.aborted;
  setProgress(stopped?null:100,stopped?'Stopped':'Complete');
  setStatus(stopped?'stopped':'done',stopped?'Stopped':'Done');
  logMsg(stopped?`Stopped. ${window._SWDRecords.length} records.`:`Complete — ${window._SWDRecords.length} records · ${stats.errors} errors · ${stats.skipped} skipped`,stopped?'warn':'ok');
  isRunning=false;document.getElementById('btn-run').disabled=false;document.getElementById('btn-stop').disabled=true;
  const badge=document.getElementById('badge-results');badge.textContent=window._SWDRecords.length;badge.hidden=!window._SWDRecords.length;
  const pwBadge=document.getElementById('badge-paywall');if(pwBadge){const n=getPaywalled().length;pwBadge.textContent=n;pwBadge.hidden=!n;}
  renderTable();renderPaywallPanel();renderScreeningCounts();
  if(!stopped)switchTab('results');
}

function addMidTerm(){const inp=document.getElementById('mid-term'),t=inp.value.trim();if(!t)return;midTerms.push(t);inp.value='';const chip=document.createElement('label');chip.className='chip';chip.style.cursor='pointer';chip.innerHTML=`${esc(t)} <span style="opacity:.5;margin-left:4px">×</span>`;chip.addEventListener('click',()=>{midTerms=midTerms.filter(x=>x!==t);chip.remove();});document.getElementById('mid-term-list').appendChild(chip);logMsg(`Added term: "${t}"`);}

function renderTable(){
  const active=getActiveSchema();
  const q=(document.getElementById('res-search').value||'').toLowerCase();
  const v=document.getElementById('res-verif').value;
  const sort=document.getElementById('res-sort').value;
  let data=(window._SWDRecords||[]).filter(r=>{
    if(currentCat!=='all'&&r.category!==currentCat)return false;
    if(v&&r.verification_status!==v)return false;
    if(screenFilter){const sc=getScreening(r).decision;if(screenFilter==='unscreened'&&sc)return false;if(screenFilter!=='unscreened'&&sc!==screenFilter)return false;}
    if(q){const h=active.map(s=>String(r[s.field]||'')).join(' ').toLowerCase();if(!h.includes(q))return false;}
    return true;
  });
  if(sort==='year_desc')data.sort((a,b)=>(b.pub_year||0)-(a.pub_year||0));
  if(sort==='year_asc')data.sort((a,b)=>(a.pub_year||0)-(b.pub_year||0));
  if(sort==='country_asc')data.sort((a,b)=>(a.country||'').localeCompare(b.country||''));
  if(sort==='verif')data.sort((a,b)=>(a.verification_status||'').localeCompare(b.verification_status||''));

  const thead=document.getElementById('results-thead');
  if(thead)thead.innerHTML='<tr>'+active.map(s=>`<th>${esc(s.label||s.field)}</th>`).join('')+'<th>Screen</th></tr>';

  const tbody=document.getElementById('results-tbody');
  if(!data.length){tbody.innerHTML=`<tr class="empty-row"><td colspan="${active.length+1}">${window._SWDRecords.length===0?'Run a search to see results.':'No records match the filter.'}</td></tr>`;document.getElementById('table-footer').textContent='';return;}

  const MAX=500;
  tbody.innerHTML=data.slice(0,MAX).map(r=>{
    const sc=getScreening(r);
    const key=screeningKey(r);
    const rId=`sr-${key.slice(-8)}-${Math.random().toString(36).slice(2,6)}`;
    const screenCell=`<td class="screen-cell"><div class="screen-btns"><button class="screen-btn ${sc.decision==='include'?'active-include':''}" onclick="applyScreening('${esc(key)}','include','${rId}')">✓</button><button class="screen-btn ${sc.decision==='maybe'?'active-maybe':''}" onclick="applyScreening('${esc(key)}','maybe','${rId}')">?</button><button class="screen-btn ${sc.decision==='exclude'?'active-exclude':''}" onclick="applyScreening('${esc(key)}','exclude','${rId}')">✗</button></div><input type="text" id="${rId}" class="screen-reason-input" value="${esc(sc.reason)}" placeholder="reason" /></td>`;
    return `<tr class="${sc.decision?'row-'+sc.decision:''}">`+active.map(s=>{
      const val=r[s.field];
      if(s.field==='category')return `<td><span class="cat-pill cat-${(val||'e').toLowerCase()}">${val||'?'}</span></td>`;
      if(s.field==='verification_status')return `<td><span class="verif-badge ${VERIF_CLASS[val]||'verif-secondary'}" style="font-size:10px">${esc(val||'')}</span></td>`;
      if(s.field==='screening_decision'){const sc2=getScreening(r);return `<td><span class="${SCREEN_CLASS[sc2.decision]||'screen-badge unscreened'}">${esc(sc2.decision||'—')}</span></td>`;}
      if(s.field==='screening_reason'){const sc2=getScreening(r);return `<td style="font-size:11px;color:var(--ink-3)">${esc(sc2.reason||'')}</td>`;}
      if(s.field==='doi'&&val&&val!=='not reported')return `<td><a class="doi-link" href="https://doi.org/${val}" target="_blank" rel="noopener">DOI →</a></td>`;
      if(s.field==='url'&&val&&val!=='not reported')return `<td><a class="doi-link" href="${esc(val)}" target="_blank" rel="noopener">URL →</a></td>`;
      if(s.field==='full_citation')return `<td class="truncate" title="${esc(String(val||''))}">${esc(String(val||'').split('(')[0].trim().slice(0,40))}</td>`;
      return `<td class="truncate">${esc(String(val||'—'))}</td>`;
    }).join('')+screenCell+'</tr>';
  }).join('');
  document.getElementById('table-footer').textContent=`Showing ${Math.min(data.length,MAX)} of ${data.length} records${data.length>MAX?` (first ${MAX} shown)`:''}`;
}

function logMsg(msg,cls=''){const box=document.getElementById('log-box'),p=document.createElement('p');if(cls)p.className=`log-${cls}`;p.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`;box.appendChild(p);box.scrollTop=box.scrollHeight;}
function setProgress(pct,label){if(pct!==null)document.getElementById('prog-fill').style.width=Math.min(100,pct)+'%';document.getElementById('prog-label').textContent=label||'';document.getElementById('prog-pct').textContent=pct!==null?Math.round(pct)+'%':'';}
function setStatus(state,text){const el=document.getElementById('run-status-label');el.className=`run-status ${state}`;el.textContent=text;}
function updateStats(){document.getElementById('s-queries').textContent=stats.queries;document.getElementById('s-raw').textContent=stats.raw;document.getElementById('s-dedup').textContent=stats.dedup;document.getElementById('s-records').textContent=stats.records;document.getElementById('s-noloc').textContent=stats.noloc;document.getElementById('s-errors').textContent=stats.errors;for(const k of Object.keys(catCounts)){const el=document.getElementById(`cat-${k.toLowerCase()}`);if(el)el.textContent=catCounts[k]||0;}}
function switchTab(id){document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));const btn=document.querySelector(`.nav-tab[data-tab="${id}"]`);if(btn)btn.classList.add('active');const panel=document.getElementById(`panel-${id}`);if(panel)panel.classList.add('active');if(id==='paywall')renderPaywallPanel();if(id==='schema')renderSchemaEditor();}

// ─── REPLACE the last line "}); // end DOMContentLoaded" with everything below ───

// ═══════════════════════════════════════════════════════════════
// PHASE 5 — BRIDGE: expose internals + capture settings on run
// ═══════════════════════════════════════════════════════════════
window._SWDLiveSchema = LIVE_SCHEMA;
window._SWDCustomFieldsRef = ()=>customFields;
window.getScreeningGlobal = getScreening;

// Capture settings each time search starts (for score computation)
document.getElementById('btn-run')?.addEventListener('click', ()=>{ window._lastSWDSettings=getSettings(); }, true);
document.getElementById('btn-start-from-config')?.addEventListener('click', ()=>{ window._lastSWDSettings=getSettings(); }, true);

// ═══════════════════════════════════════════════════════════════
// PHASE 5 — FEATURE 1: EXTRACTION SLOTS
// ═══════════════════════════════════════════════════════════════
const MAX_SLOTS=10, WARN_SLOTS=8;
window._SWDSlots=[];
let _slotId=0;

const SLOT_TIPS=[
  {tip:'Geographic location',ex:'Place names, regions, countries.\nExample:\nPacific Ocean\nSouth-East Asia\nSub-Saharan Africa'},
  {tip:'Methodology / study design',ex:'Study design or method terms.\nExample:\nrandomised controlled trial\ncase-control\nmeta-analysis'},
  {tip:'Species / organism',ex:'Taxon or common names.\nExample:\nDrosophila suzukii\nspotted wing drosophila'},
  {tip:'Chemical / compound',ex:'Compound names or classes.\nExample:\npolystyrene\nPET\nbisphenol A'},
  {tip:'Health endpoint',ex:'Clinical or toxicological outcomes.\nExample:\noxidative stress\ngenotoxicity\nfertility'},
];

function renderSlots(){
  const container=document.getElementById('slot-list'); if(!container)return;
  container.innerHTML=window._SWDSlots.map((sl,idx)=>{
    const tip=SLOT_TIPS[idx%SLOT_TIPS.length];
    return `<div class="slot-card" id="slot-card-${sl.id}">
      <div class="slot-card-header">
        <span class="slot-number">Slot ${idx+1}</span>
        <input type="text" class="slot-label-input" value="${esc(sl.label)}" placeholder="Label (e.g. Study location)" onchange="SWDSlots.rename(${sl.id},this.value)" />
        <label class="slot-partial-toggle"><input type="checkbox" ${sl.partial?'checked':''} onchange="SWDSlots.setPartial(${sl.id},this.checked)" /> Partial match</label>
        <span class="slot-tip"><span class="slot-tip-icon">? guide</span><span class="slot-tip-box"><strong>${esc(tip.tip)}</strong><br><br>${esc(tip.ex).replace(/\n/g,'<br>')}</span></span>
        <button class="slot-remove" onclick="SWDSlots.remove(${sl.id})">✕ Remove</button>
      </div>
      <textarea class="slot-phrases" placeholder="One phrase per line…" onchange="SWDSlots.setPhrases(${sl.id},this.value)">${esc(sl.phrases.join('\n'))}</textarea>
      <div class="slot-hint">One phrase per line. ${sl.partial?'<em>Partial match</em> — finds substrings.':'<em>Whole-word match</em> — safer for short terms.'}</div>
    </div>`;
  }).join('');
  const warnEl=document.getElementById('slot-warn');
  const capEl=document.getElementById('slot-cap');
  if(warnEl)warnEl.classList.toggle('visible',window._SWDSlots.length>=WARN_SLOTS&&window._SWDSlots.length<MAX_SLOTS);
  if(capEl)capEl.classList.toggle('visible',window._SWDSlots.length>=MAX_SLOTS);
  const addBtn=document.getElementById('btn-add-slot');
  if(addBtn)addBtn.disabled=window._SWDSlots.length>=MAX_SLOTS;
}

function applySlots(records){
  if(!records||!records.length||!window._SWDSlots.length)return;
  records.forEach(r=>{
    const hay=[r.full_citation||'',r._abstract||r.excerpt||'',r.notes||''].join(' ');
    window._SWDSlots.forEach(sl=>{
      if(!sl.phrases.length){r[`slot_${sl.id}`]='[No phrases defined]';return;}
      const hits=sl.phrases.filter(p=>sl.partial?hay.toLowerCase().includes(p.toLowerCase()):new RegExp('\\b'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(hay));
      r[`slot_${sl.id}`]=hits.length?hits.join('; '):'not found';
    });
  });
}

window.SWDSlots={
  add(){if(window._SWDSlots.length>=MAX_SLOTS)return;window._SWDSlots.push({id:++_slotId,label:`Extraction slot ${_slotId}`,phrases:[],partial:false});renderSlots();},
  remove(id){window._SWDSlots=window._SWDSlots.filter(s=>s.id!==id);renderSlots();},
  rename(id,label){const sl=window._SWDSlots.find(s=>s.id===id);if(sl)sl.label=label;},
  setPhrases(id,text){const sl=window._SWDSlots.find(s=>s.id===id);if(sl)sl.phrases=text.split('\n').map(p=>p.trim()).filter(Boolean);},
  setPartial(id,val){const sl=window._SWDSlots.find(s=>s.id===id);if(sl){sl.partial=val;renderSlots();}},
  exportSlot(id){
    const sl=window._SWDSlots.find(s=>s.id===id);if(!sl){alert('Slot not found.');return;}
    const records=window._SWDRecords||[];if(!records.length){alert('No records. Run a search first.');return;}
    const field=`slot_${sl.id}`;
    const rows=records.map(r=>[`"${String(r.full_citation||'').replace(/"/g,'""')}"`,`"${r.pub_year||''}"`,`"${r.country||''}"`,`"${r.doi||''}"`,`"${String(r[field]||'not found').replace(/"/g,'""')}"`].join(','));
    const name=sl.label.replace(/[^a-z0-9]/gi,'_').toLowerCase().slice(0,30)||`slot${sl.id}`;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+[`Full citation,Year,Country,DOI,${sl.label}`,...rows].join('\r\n')],{type:'text/csv;charset=utf-8;'}));a.download=`sciwide_extraction_${name}_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);
  },
  exportAll(){
    const records=window._SWDRecords||[];if(!records.length){alert('No records.');return;}
    const slots=window._SWDSlots;if(!slots.length){alert('No extraction slots defined.');return;}
    const rows=records.map(r=>[`"${String(r.full_citation||'').replace(/"/g,'""')}"`,`"${r.pub_year||''}"`,`"${r.country||''}"`,`"${r.doi||''}"`, ...slots.map(sl=>`"${String(r[`slot_${sl.id}`]||'not found').replace(/"/g,'""')}"`).join(',')].join(','));
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+[['Full citation','Year','Country','DOI',...slots.map(sl=>sl.label)].join(','),...rows].join('\r\n')],{type:'text/csv;charset=utf-8;'}));a.download=`sciwide_all_extractions_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);
  },
  renderExportPanel(){
    const el=document.getElementById('acc-slots-export');if(!el)return;
    const slots=window._SWDSlots;
    if(!slots.length){el.innerHTML='<p style="font-size:12.5px;color:var(--ink-3);padding:.5rem 0">No extraction slots defined. Add slots in the Schema tab, then run a search.</p>';return;}
    el.innerHTML=`<div class="accordion-grid">${slots.map(sl=>`<div class="acc-card"><div class="acc-card-icon">⬇</div><div class="acc-card-name">${esc(sl.label)}</div><div class="acc-card-desc">Matched phrases across all records.</div><button class="btn btn-ghost" onclick="SWDSlots.exportSlot(${sl.id})">Download CSV</button></div>`).join('')}<div class="acc-card acc-card-featured"><div class="acc-card-icon">⬇</div><div class="acc-card-name">All slots combined</div><div class="acc-card-desc">All ${slots.length} slot${slots.length>1?'s':''} as columns in one CSV.</div><button class="btn btn-primary" onclick="SWDSlots.exportAll()">Download all slots CSV</button></div></div>`;
  },
  serialize(){return window._SWDSlots.map(sl=>({label:sl.label,phrases:sl.phrases,partial:sl.partial}));},
  restore(arr){if(!Array.isArray(arr))return;window._SWDSlots=arr.map(sl=>({id:++_slotId,label:sl.label||'Slot',phrases:sl.phrases||[],partial:!!sl.partial}));renderSlots();},
};
document.getElementById('btn-add-slot')?.addEventListener('click',()=>window.SWDSlots.add());
renderSlots();

// ═══════════════════════════════════════════════════════════════
// PHASE 5 — FEATURE 2: RELEVANCE SCORES + ABSTRACT EXPORT
// ═══════════════════════════════════════════════════════════════
function scoreSchemaFit(r){
  const active=([...LIVE_SCHEMA,...customFields]).filter(f=>f.enabled);
  if(!active.length)return 0;
  const filled=active.filter(f=>{const v=r[f.field];return v&&v!=='not reported'&&v!==''&&v!=='not found';}).length;
  return Math.round((filled/active.length)*100);
}
function scoreTermRelevance(r){
  const s=window._lastSWDSettings;if(!s)return 0;
  const terms=[...(s.primaryTerms||[]),...(s.synonymTerms||[]),...(s.extraTerms||[])].filter(Boolean);
  if(!terms.length)return 0;
  const hay=[(r.full_citation||''),(r._abstract||''),(r.excerpt||'')].join(' ').toLowerCase();
  const matched=terms.filter(t=>hay.includes(t.toLowerCase())).length;
  return Math.round((matched/terms.length)*100);
}
function getExportOptions(){
  return {
    includeAbstract:!!(document.getElementById('opt-abstract')?.checked),
    includeSchemaFit:!!(document.getElementById('opt-schema-fit')?.checked),
    includeTermRelevance:!!(document.getElementById('opt-term-rel')?.checked),
  };
}
function updateSizeWarning(){
  const opts=getExportOptions();
  const n=(window._SWDRecords||[]).length;
  const est=n*300+(opts.includeAbstract?n*1500:0);
  const el=document.getElementById('csv-size-warn');if(!el)return;
  if(opts.includeAbstract&&est>2097152){
    el.classList.add('visible');
    el.innerHTML=`⚠ Estimated CSV size: <strong>${(est/1048576).toFixed(1)} MB</strong> — may be slow in Excel. <button class="btn btn-sm btn-ghost" style="margin-left:8px" onclick="SWDScores.exportSplit()">Download split (500/file)</button>`;
  } else {el.classList.remove('visible');}
}
['opt-abstract','opt-schema-fit','opt-term-rel'].forEach(id=>{
  const el=document.getElementById(id);
  if(el)el.addEventListener('change',updateSizeWarning);
});
window.SWDScores={
  scoreSchemaFit,scoreTermRelevance,
  exportSplit(){
    const records=window._SWDRecords||[];if(!records.length){alert('No records.');return;}
    const CHUNK=500;const active=([...LIVE_SCHEMA,...customFields]).filter(f=>f.enabled);
    const hdr=[...active.map(s=>s.label||s.field),'Schema fit %','Term relevance %','Abstract'].join(',');
    const st=new Date().toISOString().slice(0,10);
    for(let i=0;i<records.length;i+=CHUNK){
      const chunk=records.slice(i,i+CHUNK);
      const rows=chunk.map(r=>{const sc2=getScreening(r);const full={...r,screening_decision:sc2.decision,screening_reason:sc2.reason};const base=active.map(s=>`"${String(full[s.field]||'').replace(/"/g,'""').replace(/\n/g,' ')}"`);const abstr=(r._abstract||'[No abstract available]').replace(/"/g,'""').replace(/\n/g,' ');return[...base,`"${scoreSchemaFit(r)}"`,`"${scoreTermRelevance(r)}"`,`"${abstr}"`].join(',');});
      const part=Math.floor(i/CHUNK)+1;
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+[hdr,...rows].join('\r\n')],{type:'text/csv;charset=utf-8;'}));a.download=`sciwide_records_part${part}_${st}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);
    }
  },
  updateSizeWarning,
};

// Patch exportCSV to include optional score + abstract columns
const _origCSV=window.SWDExportFn?.csv;
if(window.SWDExportFn){
  window.SWDExportFn.csv=function(cat){
    const opts=getExportOptions();
    if(!opts.includeAbstract&&!opts.includeSchemaFit&&!opts.includeTermRelevance){if(_origCSV)return _origCSV(cat);return;}
    const data=(window._SWDRecords||[]).filter(r=>cat==='all'||r.category===cat);
    if(!data.length){alert('No records. Run a search first.');return;}
    const active=([...LIVE_SCHEMA,...customFields]).filter(f=>f.enabled);
    const extraH=[];
    if(opts.includeSchemaFit)extraH.push('Schema fit %');
    if(opts.includeTermRelevance)extraH.push('Term relevance %');
    if(opts.includeAbstract)extraH.push('Abstract');
    const headers=[...active.map(s=>s.label||s.field),...extraH];
    const rows=data.map(r=>{const sc2=getScreening(r);const full={...r,screening_decision:sc2.decision,screening_reason:sc2.reason};const base=active.map(s=>`"${String(full[s.field]||'').replace(/"/g,'""').replace(/\n/g,' ')}"`);const extra=[];if(opts.includeSchemaFit)extra.push(`"${scoreSchemaFit(r)}"`);if(opts.includeTermRelevance)extra.push(`"${scoreTermRelevance(r)}"`);if(opts.includeAbstract)extra.push(`"${(r._abstract||'[No abstract available]').replace(/"/g,'""').replace(/\n/g,' ')}"`);return[...base,...extra].join(',');});
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+[headers.join(','),...rows].join('\r\n')],{type:'text/csv;charset=utf-8;'}));a.download=`sciwide_records${cat!=='all'?'_cat'+cat:''}_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);
  };
  // Patch JSON to always include abstract + scores
  window.SWDExportFn.json=function(){
    if(!(window._SWDRecords||[]).length){alert('No records.');return;}
    const out=(window._SWDRecords||[]).map(r=>{const sc2=getScreening(r);return{...r,screening_decision:sc2.decision,screening_reason:sc2.reason,abstract:r._abstract||null,schema_fit_pct:scoreSchemaFit(r),term_relevance_pct:scoreTermRelevance(r)};});
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download=`sciwide_records_${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);
  };
}

// Show score columns in results table if toggled
['opt-schema-fit','opt-term-rel'].forEach(id=>{
  const el=document.getElementById(id);
  if(el)el.addEventListener('change',()=>{ if((window._SWDRecords||[]).length) renderTable(); });
});

// ═══════════════════════════════════════════════════════════════
// PHASE 5 — FEATURE 3: ACCORDION WIRING
// ═══════════════════════════════════════════════════════════════
let _lastOpenAccordion=null;
function toggleAccordion(groupId){
  const group=document.getElementById(groupId);if(!group)return;
  const wasOpen=group.classList.contains('open');
  document.querySelectorAll('.accordion-group').forEach(g=>g.classList.remove('open'));
  if(!wasOpen){group.classList.add('open');_lastOpenAccordion=groupId;}
  else{_lastOpenAccordion=null;}
}
window.SWDAccordion={toggle:toggleAccordion};
document.querySelectorAll('.accordion-header').forEach(h=>h.addEventListener('click',()=>{const g=h.closest('.accordion-group');if(g)toggleAccordion(g.id);}));

// Patch switchTab to restore last open accordion group
const _origSwitchTab=switchTab;
// Override switchTab globally
window._SWDSwitchTab=function(id){
  _origSwitchTab(id);
  if(id==='export'&&_lastOpenAccordion){
    const g=document.getElementById(_lastOpenAccordion);
    if(g)g.classList.add('open');
  }
};
// Re-wire all nav-tab clicks to use patched version
document.querySelectorAll('.nav-tab').forEach(btn=>{
  btn.onclick=null;
  btn.addEventListener('click',()=>window._SWDSwitchTab(btn.dataset.tab));
});

// Also wire search-complete: apply slots + update size warning
const _origEndObserver=document.getElementById('btn-run');
if(_origEndObserver){
  new MutationObserver(()=>{
    if(!_origEndObserver.disabled&&(window._SWDRecords||[]).length){
      applySlots(window._SWDRecords);
      window.SWDSlots.renderExportPanel();
      updateSizeWarning();
    }
  }).observe(_origEndObserver,{attributes:true,attributeFilter:['disabled']});
}

// ─── REPLACE the last line "}); // end DOMContentLoaded" with everything below ───

// ═══════════════════════════════════════════════════════════════
// PHASE 6 — ROW SELECTION + PAGINATION + EXPORT SCOPE MODAL
// ═══════════════════════════════════════════════════════════════

// Selection state: Set of screeningKey() strings
window._SWDSelection = new Set();
let _paginationSize = 50; // default
let _paginationPage = 1;

function getSelectedRecords(){
  return (window._SWDRecords||[]).filter(r => window._SWDSelection.has(screeningKey(r)));
}

function renderSelectionBar(){
  const bar = document.getElementById('selection-bar');
  const countEl = document.getElementById('sel-count');
  if(!bar) return;
  const n = window._SWDSelection.size;
  if(countEl) countEl.textContent = n;
  bar.classList.toggle('visible', n > 0);
}

window.SWDSelection = {
  toggle(key){
    if(window._SWDSelection.has(key)) window._SWDSelection.delete(key);
    else window._SWDSelection.add(key);
    renderSelectionBar();
    renderTable();
  },
  clear(){
    window._SWDSelection.clear();
    renderSelectionBar();
    renderTable();
  },
  selectAllFiltered(filteredRecords){
    filteredRecords.forEach(r => window._SWDSelection.add(screeningKey(r)));
    renderSelectionBar();
    renderTable();
  },
  deselectAllFiltered(filteredRecords){
    filteredRecords.forEach(r => window._SWDSelection.delete(screeningKey(r)));
    renderSelectionBar();
    renderTable();
  },
};

document.getElementById('btn-clear-selection')?.addEventListener('click', () => window.SWDSelection.clear());

// ── Pagination ──────────────────────────────────────────────
document.getElementById('pagination-size')?.addEventListener('change', (e) => {
  const val = e.target.value;
  _paginationSize = val === 'all' ? Infinity : parseInt(val);
  _paginationPage = 1;
  const warnEl = document.getElementById('pagination-allwarn');
  const total = (window._SWDRecords||[]).length;
  if(warnEl) warnEl.style.display = (val === 'all' && total > 1000) ? 'inline' : 'none';
  renderTable();
});

function renderPaginationControls(totalFiltered){
  const container = document.getElementById('pagination-controls');
  if(!container) return;
  const totalPages = _paginationSize === Infinity ? 1 : Math.max(1, Math.ceil(totalFiltered / _paginationSize));
  if(_paginationPage > totalPages) _paginationPage = totalPages;

  if(totalPages <= 1){ container.innerHTML = ''; return; }

  let html = `<button id="pg-prev" ${_paginationPage<=1?'disabled':''}>&laquo; Prev</button>`;
  const maxButtons = 7;
  let start = Math.max(1, _paginationPage - 3);
  let end = Math.min(totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  if(start > 1) html += `<button data-pg="1">1</button>${start>2?'<span style="padding:0 4px;color:var(--ink-3)">…</span>':''}`;
  for(let p=start; p<=end; p++){
    html += `<button data-pg="${p}" class="${p===_paginationPage?'current-page':''}">${p}</button>`;
  }
  if(end < totalPages) html += `${end<totalPages-1?'<span style="padding:0 4px;color:var(--ink-3)">…</span>':''}<button data-pg="${totalPages}">${totalPages}</button>`;
  html += `<button id="pg-next" ${_paginationPage>=totalPages?'disabled':''}>Next &raquo;</button>`;
  container.innerHTML = html;

  container.querySelectorAll('button[data-pg]').forEach(btn => {
    btn.addEventListener('click', () => { _paginationPage = parseInt(btn.dataset.pg); renderTable(); });
  });
  document.getElementById('pg-prev')?.addEventListener('click', () => { if(_paginationPage>1){_paginationPage--;renderTable();} });
  document.getElementById('pg-next')?.addEventListener('click', () => { if(_paginationPage<totalPages){_paginationPage++;renderTable();} });
}

// ── Patch renderTable to add checkbox column + pagination ──
const _origRenderTable = renderTable;
renderTable = function(){
  const active = getActiveSchema();
  const slotCols = (window._SWDSlots||[]).map(sl=>({field:`slot_${sl.id}`,label:sl.label}));
  const opts = (typeof getExportOptions === 'function') ? getExportOptions() : {includeSchemaFit:false,includeTermRelevance:false};
  const scoreCols = [];
  if(opts.includeSchemaFit) scoreCols.push({field:'_schemaFit',label:'Schema fit %'});
  if(opts.includeTermRelevance) scoreCols.push({field:'_termRel',label:'Term relevance %'});
  const allCols = [...active, ...slotCols, ...scoreCols];

  const q = (document.getElementById('res-search').value||'').toLowerCase();
  const v = document.getElementById('res-verif').value;
  const sort = document.getElementById('res-sort').value;

  let data = (window._SWDRecords||[]).filter(r => {
    if(currentCat!=='all' && r.category!==currentCat) return false;
    if(v && r.verification_status!==v) return false;
    if(screenFilter){ const sc=getScreening(r).decision; if(screenFilter==='unscreened'&&sc) return false; if(screenFilter!=='unscreened'&&sc!==screenFilter) return false; }
    if(q){ const h=allCols.map(s=>String(r[s.field]||'')).join(' ').toLowerCase(); if(!h.includes(q)) return false; }
    return true;
  });
  if(sort==='year_desc') data.sort((a,b)=>(b.pub_year||0)-(a.pub_year||0));
  if(sort==='year_asc') data.sort((a,b)=>(a.pub_year||0)-(b.pub_year||0));
  if(sort==='country_asc') data.sort((a,b)=>(a.country||'').localeCompare(b.country||''));
  if(sort==='verif') data.sort((a,b)=>(a.verification_status||'').localeCompare(b.verification_status||''));

  // store filtered set globally for select-all-filtered
  window._SWDFilteredView = data;

  const thead = document.getElementById('results-thead');
  const allFilteredSelected = data.length>0 && data.every(r=>window._SWDSelection.has(screeningKey(r)));
  if(thead) thead.innerHTML = '<tr><th class="row-select-cell"><input type="checkbox" class="select-all-checkbox" id="select-all-cb" ' + (allFilteredSelected?'checked':'') + ' /></th>' +
    allCols.map(s=>`<th>${esc(s.label||s.field)}</th>`).join('') + '<th>Screen</th></tr>';

  const selectAllCb = document.getElementById('select-all-cb');
  if(selectAllCb) selectAllCb.addEventListener('change', (e) => {
    if(e.target.checked) window.SWDSelection.selectAllFiltered(data);
    else window.SWDSelection.deselectAllFiltered(data);
  });

  const tbody = document.getElementById('results-tbody');
  const totalCols = allCols.length + 2;
  if(!data.length){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${totalCols}">${(window._SWDRecords||[]).length===0?'Run a search to see results.':'No records match the filter.'}</td></tr>`;
    document.getElementById('table-footer').textContent='';
    renderPaginationControls(0);
    return;
  }

  // Pagination slice
  const totalFiltered = data.length;
  const pageSize = _paginationSize===Infinity ? totalFiltered : _paginationSize;
  const startIdx = (_paginationPage-1)*pageSize;
  const pageData = data.slice(startIdx, startIdx+pageSize);

  tbody.innerHTML = pageData.map(r => {
    const sc2 = getScreening(r);
    const key = screeningKey(r);
    const rId = `sr-${key.slice(-8)}-${Math.random().toString(36).slice(2,6)}`;
    const isSelected = window._SWDSelection.has(key);
    const selCell = `<td class="row-select-cell"><input type="checkbox" ${isSelected?'checked':''} onchange="SWDSelection.toggle('${esc(key)}')" /></td>`;
    const screenCell = `<td class="screen-cell"><div class="screen-btns"><button class="screen-btn ${sc2.decision==='include'?'active-include':''}" onclick="applyScreening('${esc(key)}','include','${rId}')">✓</button><button class="screen-btn ${sc2.decision==='maybe'?'active-maybe':''}" onclick="applyScreening('${esc(key)}','maybe','${rId}')">?</button><button class="screen-btn ${sc2.decision==='exclude'?'active-exclude':''}" onclick="applyScreening('${esc(key)}','exclude','${rId}')">✗</button></div><input type="text" id="${rId}" class="screen-reason-input" value="${esc(sc2.reason)}" placeholder="reason" /></td>`;
    const rowClasses = [sc2.decision?'row-'+sc2.decision:'', isSelected?'row-selected':''].filter(Boolean).join(' ');
    return `<tr class="${rowClasses}">` + selCell + allCols.map(s=>{
      if(s.field==='_schemaFit') return `<td style="font-family:var(--mono);font-size:11px;color:var(--accent)">${(window.SWDScores?SWDScores.scoreSchemaFit(r):0)}%</td>`;
      if(s.field==='_termRel') return `<td style="font-family:var(--mono);font-size:11px;color:var(--blue)">${(window.SWDScores?SWDScores.scoreTermRelevance(r):0)}%</td>`;
      const val = r[s.field];
      if(s.field==='category') return `<td><span class="cat-pill cat-${(val||'e').toLowerCase()}">${val||'?'}</span></td>`;
      if(s.field==='verification_status') return `<td><span class="verif-badge ${VERIF_CLASS[val]||'verif-secondary'}" style="font-size:10px">${esc(val||'')}</span></td>`;
      if(s.field==='screening_decision'){ const sc3=getScreening(r); return `<td><span class="${SCREEN_CLASS[sc3.decision]||'screen-badge unscreened'}">${esc(sc3.decision||'—')}</span></td>`; }
      if(s.field==='screening_reason'){ const sc3=getScreening(r); return `<td style="font-size:11px;color:var(--ink-3)">${esc(sc3.reason||'')}</td>`; }
      if(s.field==='doi' && val && val!=='not reported') return `<td><a class="doi-link" href="https://doi.org/${val}" target="_blank" rel="noopener">DOI →</a></td>`;
      if(s.field==='url' && val && val!=='not reported') return `<td><a class="doi-link" href="${esc(val)}" target="_blank" rel="noopener">URL →</a></td>`;
      if(s.field==='full_citation') return `<td class="truncate" title="${esc(String(val||''))}">${esc(String(val||'').split('(')[0].trim().slice(0,40))}</td>`;
      if(s.field.startsWith('slot_')){ const sv=val||''; return `<td class="truncate" title="${esc(sv)}" style="font-size:11px;color:${sv==='not found'?'var(--ink-3)':'var(--accent)'}">${esc(sv.slice(0,50))}</td>`; }
      return `<td class="truncate">${esc(String(val||'—'))}</td>`;
    }).join('') + screenCell + '</tr>';
  }).join('');

  document.getElementById('table-footer').textContent = `Showing ${startIdx+1}\u2013${Math.min(startIdx+pageSize, totalFiltered)} of ${totalFiltered} records${totalFiltered!==(window._SWDRecords||[]).length?` (filtered from ${(window._SWDRecords||[]).length})`:''}`;
  renderPaginationControls(totalFiltered);
};

// ═══════════════════════════════════════════════════════════════
// EXPORT SCOPE MODAL — wraps every SWDExportFn.* call
// ═══════════════════════════════════════════════════════════════
let _pendingExportCall = null;

function withScopeCheck(fn, args){
  const n = window._SWDSelection.size;
  if(n === 0){
    fn(...args);
    return;
  }
  // Show modal
  const modal = document.getElementById('scope-modal');
  const countEl = document.getElementById('scope-modal-count');
  if(countEl) countEl.textContent = n;
  if(modal) modal.classList.add('visible');
  _pendingExportCall = { fn, args };
}

document.getElementById('scope-modal-all')?.addEventListener('click', () => {
  document.getElementById('scope-modal')?.classList.remove('visible');
  if(_pendingExportCall) _pendingExportCall.fn(..._pendingExportCall.args);
  _pendingExportCall = null;
});
document.getElementById('scope-modal-selected')?.addEventListener('click', () => {
  document.getElementById('scope-modal')?.classList.remove('visible');
  if(_pendingExportCall){
    const selected = getSelectedRecords();
    if(!selected.length){ alert('No selected records match this export type.'); _pendingExportCall=null; return; }
    // Temporarily swap window._SWDRecords to the selection, run export, restore
    const original = window._SWDRecords;
    window._SWDRecords = selected;
    try{ _pendingExportCall.fn(..._pendingExportCall.args); }
    finally{ window._SWDRecords = original; }
  }
  _pendingExportCall = null;
});
document.getElementById('scope-modal-cancel')?.addEventListener('click', () => {
  document.getElementById('scope-modal')?.classList.remove('visible');
  _pendingExportCall = null;
});
document.getElementById('scope-modal')?.addEventListener('click', (e) => {
  if(e.target === e.currentTarget){ e.currentTarget.classList.remove('visible'); _pendingExportCall=null; }
});

// Wrap every function in SWDExportFn with the scope check
(function wrapExportFns(){
  if(!window.SWDExportFn) return;
  const original = {...window.SWDExportFn};
  Object.keys(original).forEach(key => {
    window.SWDExportFn[key] = function(...args){
      withScopeCheck(original[key], args);
    };
  });
})();

// Also wrap slot exports
if(window.SWDSlots){
  const origExportSlot = window.SWDSlots.exportSlot.bind(window.SWDSlots);
  const origExportAll = window.SWDSlots.exportAll.bind(window.SWDSlots);
  window.SWDSlots.exportSlot = function(id){ withScopeCheck(origExportSlot, [id]); };
  window.SWDSlots.exportAll = function(){ withScopeCheck(origExportAll, []); };
}

// ═══════════════════════════════════════════════════════════════
// CLEAR-SELECTION CONFIRMATION ON NEW SEARCH
// ═══════════════════════════════════════════════════════════════
let _pendingSearchStart = null;

function guardedStartSearch(){
  if(window._SWDSelection.size > 0){
    const modal = document.getElementById('clear-sel-modal');
    const countEl = document.getElementById('clear-sel-count');
    if(countEl) countEl.textContent = window._SWDSelection.size;
    if(modal) modal.classList.add('visible');
    _pendingSearchStart = true;
    return;
  }
  startSearch();
}

document.getElementById('clear-sel-confirm')?.addEventListener('click', () => {
  document.getElementById('clear-sel-modal')?.classList.remove('visible');
  window._SWDSelection.clear();
  renderSelectionBar();
  _pendingSearchStart = null;
  startSearch();
});
document.getElementById('clear-sel-cancel')?.addEventListener('click', () => {
  document.getElementById('clear-sel-modal')?.classList.remove('visible');
  _pendingSearchStart = null;
});
document.getElementById('clear-sel-modal')?.addEventListener('click', (e) => {
  if(e.target === e.currentTarget){ e.currentTarget.classList.remove('visible'); _pendingSearchStart=null; }
});

// Re-wire the run buttons to go through the guard instead of calling startSearch directly
const btnRun = document.getElementById('btn-run');
const btnStartFromConfig = document.getElementById('btn-start-from-config');
if(btnRun){
  const newBtnRun = btnRun.cloneNode(true);
  btnRun.parentNode.replaceChild(newBtnRun, btnRun);
  newBtnRun.addEventListener('click', guardedStartSearch);
}
if(btnStartFromConfig){
  const newBtnStart = btnStartFromConfig.cloneNode(true);
  btnStartFromConfig.parentNode.replaceChild(newBtnStart, btnStartFromConfig);
  newBtnStart.addEventListener('click', () => { switchTab('run'); guardedStartSearch(); });
}

// Clear selection automatically once a NEW search actually completes (data replaced)
document.addEventListener('DOMContentLoaded', () => {}); // no-op guard
const _selResetObserver = document.getElementById('btn-run');
// Selection is cleared explicitly in the confirm handler above (before startSearch runs),
// so no further action needed here — window._SWDRecords gets replaced inside startSearch()
// and stale keys in _SWDSelection simply won't match any record going forward.

// Initial render of selection bar (in case of preset-restored state)
renderSelectionBar();

// ─── REPLACE the last line "}); // end DOMContentLoaded" with everything below ───

// ═══════════════════════════════════════════════════════════════
// PHASE 7 — DISCIPLINE DATABASE MAP
// ═══════════════════════════════════════════════════════════════
const DISCIPLINE_DB_MAP = {
  general: {
    label: 'General / All disciplines',
    defaultOn: ['semanticscholar','openalex','europepmc','crossref','zenodo','gbif','inat'],
    available: [
      {id:'semanticscholar', label:'Semantic Scholar', status:'live', note:'200M+ papers, all fields'},
      {id:'openalex',        label:'OpenAlex',         status:'live', note:'250M+ works, CC0'},
      {id:'europepmc',       label:'Europe PMC',       status:'live', note:'Life sciences & general'},
      {id:'crossref',        label:'Crossref',         status:'live', note:'180M+ DOI records'},
      {id:'zenodo',          label:'Zenodo',           status:'live', note:'Open access, all fields'},
      {id:'base',            label:'BASE',             status:'stub', note:'240M+ open access docs'},
      {id:'unpaywall',       label:'Unpaywall',        status:'stub', note:'Open access resolver'},
      {id:'researchgate',    label:'ResearchGate',     status:'noapl', note:'No public API — manual search only'},
    ]
  },
  biology: {
    label: 'Biology & Life Sciences',
    defaultOn: ['europepmc','pubmed','biorxiv','openalex','gbif','inat','ncbi'],
    available: [
      {id:'europepmc',  label:'Europe PMC',        status:'live', note:'Primary biology/life sci DB'},
      {id:'pubmed',     label:'PubMed (via EPMC)', status:'live', note:'36M+ biomedical citations'},
      {id:'biorxiv',    label:'bioRxiv / medRxiv', status:'live', note:'Life science preprints'},
      {id:'openalex',   label:'OpenAlex',          status:'live', note:'Broad coverage incl. biology'},
      {id:'gbif',       label:'GBIF',              status:'live', note:'Species occurrence data'},
      {id:'inat',       label:'iNaturalist',       status:'live', note:'Biodiversity observations'},
      {id:'ncbi',       label:'NCBI / GenBank',    status:'stub', note:'Genomics, sequences, taxonomy'},
      {id:'bold',       label:'BOLD Systems',      status:'stub', note:'Barcode of Life data'},
      {id:'plos',       label:'PLOS ONE',          status:'stub', note:'Open-access biology journals'},
      {id:'zenodo',     label:'Zenodo',            status:'live', note:'Research data & preprints'},
    ]
  },
  ecology: {
    label: 'Ecology & Environmental Science',
    defaultOn: ['openalex','europepmc','gbif','inat','zenodo'],
    available: [
      {id:'openalex',     label:'OpenAlex',          status:'live', note:'Strong ecology coverage'},
      {id:'europepmc',    label:'Europe PMC',        status:'live', note:'Environmental journals'},
      {id:'gbif',         label:'GBIF',              status:'live', note:'Species distributions'},
      {id:'inat',         label:'iNaturalist',       status:'live', note:'Field observations'},
      {id:'zenodo',       label:'Zenodo',            status:'live', note:'Environmental datasets'},
      {id:'eartharxiv',   label:'EarthArXiv',        status:'stub', note:'Earth & environ. science preprints (via Zenodo)'},
      {id:'crossref',     label:'Crossref',          status:'live', note:'Journal metadata'},
      {id:'eppo',         label:'EPPO Global DB',    status:'stub', note:'Pest & plant health data'},
      {id:'bold',         label:'BOLD Systems',      status:'stub', note:'Barcode ecology studies'},
    ]
  },
  medicine: {
    label: 'Medicine & Health Sciences',
    defaultOn: ['pubmed','europepmc','biorxiv','openalex','crossref'],
    available: [
      {id:'pubmed',     label:'PubMed (via EPMC)', status:'live', note:'Gold standard for medicine'},
      {id:'europepmc',  label:'Europe PMC',        status:'live', note:'Open access medical papers'},
      {id:'biorxiv',    label:'medRxiv',           status:'live', note:'Medical preprints'},
      {id:'openalex',   label:'OpenAlex',          status:'live', note:'Broad medical coverage'},
      {id:'crossref',   label:'Crossref',          status:'live', note:'Clinical trial registrations'},
      {id:'zenodo',     label:'Zenodo',            status:'live', note:'Health datasets & grey lit.'},
      {id:'plos',       label:'PLOS Medicine',     status:'stub', note:'Open-access medical journals'},
      {id:'ncbi',       label:'NCBI / PubMed Central', status:'stub', note:'Full-text medical articles'},
    ]
  },
  physics: {
    label: 'Physics & Astronomy',
    defaultOn: ['arxiv','openalex','crossref','zenodo'],
    available: [
      {id:'arxiv',      label:'arXiv',             status:'live', note:'Primary physics preprint server'},
      {id:'openalex',   label:'OpenAlex',          status:'live', note:'Broad physics literature'},
      {id:'crossref',   label:'Crossref',          status:'live', note:'Published journal articles'},
      {id:'zenodo',     label:'Zenodo',            status:'live', note:'CERN-hosted open data'},
      {id:'nasaads',    label:'NASA ADS',           status:'stub', note:'Astronomy & astrophysics — requires free API key'},
      {id:'inspire',    label:'INSPIRE-HEP',       status:'stub', note:'High-energy physics literature'},
    ]
  },
  mathematics: {
    label: 'Mathematics & Statistics',
    defaultOn: ['arxiv','openalex','crossref','zenodo'],
    available: [
      {id:'arxiv',      label:'arXiv (math)',      status:'live', note:'Primary math preprint server'},
      {id:'openalex',   label:'OpenAlex',          status:'live', note:'Covers pure & applied math'},
      {id:'crossref',   label:'Crossref',          status:'live', note:'Mathematical journals'},
      {id:'zenodo',     label:'Zenodo',            status:'live', note:'Math software & datasets'},
      {id:'zbmath',     label:'zbMATH Open',       status:'stub', note:'Mathematics literature database'},
      {id:'semanticscholar', label:'Semantic Scholar', status:'live', note:'Good math & CS coverage'},
    ]
  },
  cs: {
    label: 'Computer Science & Engineering',
    defaultOn: ['arxiv','semanticscholar','openalex','crossref','zenodo'],
    available: [
      {id:'arxiv',         label:'arXiv (cs)',         status:'live', note:'Primary CS preprint server'},
      {id:'semanticscholar', label:'Semantic Scholar', status:'live', note:'Strong AI/ML/CS coverage'},
      {id:'openalex',      label:'OpenAlex',           status:'live', note:'Broad CS literature'},
      {id:'crossref',      label:'Crossref',           status:'live', note:'IEEE, ACM proceedings'},
      {id:'zenodo',        label:'Zenodo',             status:'live', note:'Code, datasets, preprints'},
      {id:'biorxiv',       label:'bioRxiv (bioinf.)',  status:'live', note:'Bioinformatics preprints'},
      {id:'engrxiv',       label:'engrXiv',            status:'stub', note:'Engineering preprints'},
    ]
  },
  chemistry: {
    label: 'Chemistry & Materials Science',
    defaultOn: ['openalex','crossref','zenodo','arxiv'],
    available: [
      {id:'openalex',   label:'OpenAlex',          status:'live', note:'Chemistry journal coverage'},
      {id:'crossref',   label:'Crossref',          status:'live', note:'ACS, RSC, Wiley journals'},
      {id:'zenodo',     label:'Zenodo',            status:'live', note:'Chemistry datasets'},
      {id:'arxiv',      label:'arXiv (chem-ph)',   status:'live', note:'Chemical physics preprints'},
      {id:'chemrxiv',   label:'ChemRxiv',          status:'stub', note:'Chemistry preprints — via Crossref filter'},
      {id:'pubchem',    label:'PubChem',           status:'stub', note:'Chemical compound database (NCBI)'},
    ]
  },
  social: {
    label: 'Social Sciences & Humanities',
    defaultOn: ['openalex','crossref','zenodo','semanticscholar'],
    available: [
      {id:'openalex',    label:'OpenAlex',          status:'live', note:'Growing social sciences coverage'},
      {id:'crossref',    label:'Crossref',          status:'live', note:'Social science journals'},
      {id:'zenodo',      label:'Zenodo',            status:'live', note:'Social data & grey lit.'},
      {id:'semanticscholar', label:'Semantic Scholar', status:'live', note:'Social science papers'},
      {id:'ssrn',        label:'SSRN',              status:'stub', note:'Economics, law, social working papers (via Crossref)'},
      {id:'socarxiv',    label:'SocArXiv',          status:'stub', note:'Social sciences preprints'},
      {id:'psyarxiv',    label:'PsyArXiv',          status:'stub', note:'Psychology preprints (OSF API)'},
    ]
  },
  economics: {
    label: 'Economics & Business',
    defaultOn: ['openalex','crossref','zenodo','arxiv'],
    available: [
      {id:'openalex',   label:'OpenAlex',           status:'live', note:'Economics journal coverage'},
      {id:'crossref',   label:'Crossref',           status:'live', note:'Economics journals & books'},
      {id:'zenodo',     label:'Zenodo',             status:'live', note:'Economic datasets'},
      {id:'arxiv',      label:'arXiv (econ)',       status:'live', note:'Economics preprints since 2017'},
      {id:'ssrn',       label:'SSRN',               status:'stub', note:'Working papers (via Crossref)'},
      {id:'repec',      label:'EconPapers / RePEC', status:'stub', note:'Economics working papers (OAI-PMH, CORS issues)'},
    ]
  },
  geosciences: {
    label: 'Geosciences & Earth Sciences',
    defaultOn: ['openalex','crossref','zenodo','gbif'],
    available: [
      {id:'openalex',    label:'OpenAlex',           status:'live', note:'Geoscience journal coverage'},
      {id:'crossref',    label:'Crossref',           status:'live', note:'Earth science journals'},
      {id:'zenodo',      label:'Zenodo',             status:'live', note:'Geo datasets & models'},
      {id:'gbif',        label:'GBIF',               status:'live', note:'Species / geo occurrence'},
      {id:'eartharxiv',  label:'EarthArXiv',         status:'stub', note:'Earth science preprints'},
      {id:'nasaads',     label:'NASA ADS',           status:'stub', note:'Space & atmospheric science'},
      {id:'pangaea',     label:'PANGAEA',            status:'stub', note:'Earth & environmental data — API available'},
    ]
  },
};

window.DISCIPLINE_DB_MAP = DISCIPLINE_DB_MAP;

// All known DB IDs and labels (superset)
const ALL_DB_LABELS_EXT = {
  semanticscholar:'Semantic Scholar', openalex:'OpenAlex', europepmc:'Europe PMC',
  pubmed:'PubMed (via Europe PMC)', arxiv:'arXiv', biorxiv:'bioRxiv / medRxiv',
  zenodo:'Zenodo', crossref:'Crossref', unpaywall:'Unpaywall', base:'BASE',
  gbif:'GBIF', inat:'iNaturalist', bold:'BOLD', ncbi:'NCBI',
  eppo:'EPPO Global DB', cabi:'CABI', usda:'USDA/NAL', jki:'JKI Germany',
  naro:'NARO Japan', caas:'CAAS China', rda:'RDA Korea',
  plos:'PLOS', chemrxiv:'ChemRxiv', eartharxiv:'EarthArXiv', psyarxiv:'PsyArXiv',
  socarxiv:'SocArXiv', ssrn:'SSRN', repec:'EconPapers/RePEC', engrxiv:'engrXiv',
  nasaads:'NASA ADS', inspire:'INSPIRE-HEP', zbmath:'zbMATH Open',
  pubchem:'PubChem', pangaea:'PANGAEA', researchgate:'ResearchGate',
};
Object.assign(DB_LABELS, ALL_DB_LABELS_EXT);

function renderDisciplineSelector(){
  const container = document.getElementById('discipline-db-panel');
  if(!container) return;
  const disc = document.getElementById('db-discipline-select')?.value || 'general';
  const map = DISCIPLINE_DB_MAP[disc];
  if(!map) return;

  const rgNote = document.getElementById('db-resgate-note');
  const hasRG = map.available.some(db => db.id === 'researchgate');
  if(rgNote) rgNote.classList.toggle('visible', hasRG);

  container.innerHTML = map.available.map(db => {
    const isChecked = window._currentDisciplineChecked?.has(db.id) ?? map.defaultOn.includes(db.id);
    const statusNote = db.status === 'stub' ? ' <span class="db-stub-note">(stub — connector planned)</span>' :
                       db.status === 'noapl' ? ' <span class="db-stub-note">(no public API)</span>' : '';
    const isDisabled = db.status === 'noapl';
    return `<label class="chip ${isDisabled ? 'chip-disabled' : ''}" style="${isDisabled?'opacity:.4;cursor:not-allowed':''}">
      <input type="checkbox" value="${db.id}" ${isChecked?'checked':''} ${isDisabled?'disabled':''} onchange="SWDDiscipline.onChipChange()" />
      ${db.label}${statusNote}
    </label>`;
  }).join('');
}

window.SWDDiscipline = {
  onDisciplineChange(){
    const disc = document.getElementById('db-discipline-select')?.value || 'general';
    const map = DISCIPLINE_DB_MAP[disc];
    // Set checked state to discipline defaults
    window._currentDisciplineChecked = new Set(map.defaultOn);
    renderDisciplineSelector();
    // Sync to the underlying hidden chips so getSettings() still works
    SWDDiscipline.syncToSettings();
  },
  onChipChange(){
    const chips = document.querySelectorAll('#discipline-db-panel input[type="checkbox"]');
    window._currentDisciplineChecked = new Set([...chips].filter(c=>c.checked).map(c=>c.value));
    SWDDiscipline.syncToSettings();
  },
  syncToSettings(){
    // Update the underlying chip inputs (kept hidden) for backwards compatibility with getSettings()
    const allChips = document.querySelectorAll('#chips-academic input, #chips-gov input, #chips-bio input');
    allChips.forEach(c => {
      c.checked = window._currentDisciplineChecked?.has(c.value) ?? c.checked;
    });
  },
  requestNewDB(){
    const body = `Hi Mehregan,\n\nI would like to request a new database connector for SciWide Search.\n\nDatabase name: [Your database name]\nURL / API docs: [API documentation URL]\nFree public API: [Yes / No]\nDiscipline(s): [Which fields it covers]\nWhy it would be useful: [Brief explanation]\n\nThank you!`;
    window.open(`mailto:?subject=${encodeURIComponent('SciWide Search — Database connector request')}&body=${encodeURIComponent(body)}`);
  },
};

// Wire discipline dropdown
const discSelect = document.getElementById('db-discipline-select');
if(discSelect) {
  discSelect.addEventListener('change', () => window.SWDDiscipline.onDisciplineChange());
  // Init
  window._currentDisciplineChecked = new Set(DISCIPLINE_DB_MAP.general.defaultOn);
  renderDisciplineSelector();
}

// ═══════════════════════════════════════════════════════════════
// PHASE 7 — CUSTOM REQUIREMENTS ENGINE
// ═══════════════════════════════════════════════════════════════
window._SWDRequirements = [];
let _reqId = 0;

const REQ_TYPES = [
  { value: 'abstract_contains',  label: 'Abstract contains phrase' },
  { value: 'title_contains',     label: 'Title contains phrase' },
  { value: 'any_field_contains', label: 'Any field contains phrase' },
  { value: 'has_doi',            label: 'Has DOI' },
  { value: 'has_coordinates',    label: 'Has coordinates' },
  { value: 'has_country',        label: 'Has country extracted' },
  { value: 'has_abstract',       label: 'Has abstract text' },
  { value: 'year_from',          label: 'Year ≥ value' },
  { value: 'year_to',            label: 'Year ≤ value' },
  { value: 'source_type_is',     label: 'Source type equals' },
  { value: 'language_is',        label: 'Language code equals' },
  { value: 'category_is',        label: 'Category equals (A/B/C/D/E/F)' },
  { value: 'custom_text',        label: 'Custom rule (text description)' },
];

const REQ_SUGGESTIONS = [
  { type: 'has_country',        label: 'Must have country',    value: '' },
  { type: 'has_doi',            label: 'Must have DOI',        value: '' },
  { type: 'has_coordinates',    label: 'Must have coordinates',value: '' },
  { type: 'has_abstract',       label: 'Must have abstract',   value: '' },
  { type: 'year_from',          label: 'Year from 2000',       value: '2000' },
  { type: 'abstract_contains',  label: 'Abstract: location',   value: 'location' },
  { type: 'title_contains',     label: 'Title: keyword',       value: '' },
  { type: 'source_type_is',     label: 'Journals only',        value: 'journal' },
  { type: 'custom_text',        label: '+ Custom rule',        value: '' },
];

function testRequirement(r, req) {
  if(!req.enabled) return true; // disabled reqs always pass
  const ft = [r.full_citation||'', r._abstract||'', r.excerpt||'', r.notes||''].join(' ').toLowerCase();
  const val = (req.value||'').trim().toLowerCase();
  switch(req.type){
    case 'abstract_contains':    return val ? (r._abstract||'').toLowerCase().includes(val) : true;
    case 'title_contains':       return val ? (r.full_citation||'').toLowerCase().includes(val) : true;
    case 'any_field_contains':   return val ? ft.includes(val) : true;
    case 'has_doi':              return !!(r.doi && r.doi !== 'not reported' && r.doi !== '');
    case 'has_coordinates':      return !!(r.coordinates && r.coordinates !== 'not reported');
    case 'has_country':          return !!(r.country && r.country !== 'not reported');
    case 'has_abstract':         return !!(r._abstract && r._abstract.trim().length > 10);
    case 'year_from':            return val ? (!r.pub_year || r.pub_year >= parseInt(val)) : true;
    case 'year_to':              return val ? (!r.pub_year || r.pub_year <= parseInt(val)) : true;
    case 'source_type_is':       return val ? (r.source_type||'').toLowerCase() === val : true;
    case 'language_is':          return val ? (r.language||'').toLowerCase().startsWith(val) : true;
    case 'category_is':          return val ? (r.category||'').toUpperCase() === val.toUpperCase() : true;
    case 'custom_text':          return true; // custom rules are descriptive only — always pass in code
    default:                     return true;
  }
}

function applyRequirements(records) {
  const enabledReqs = window._SWDRequirements.filter(r => r.enabled && r.type !== 'custom_text');
  if(!enabledReqs.length) return;
  records.forEach(r => {
    const failedReqs = enabledReqs.filter(req => !testRequirement(r, req));
    r._req_fail = failedReqs.length > 0;
    r._req_fail_labels = failedReqs.map(req => req.label || req.type).join('; ');
  });
}

function renderRequirements() {
  const list = document.getElementById('req-list');
  if(!list) return;
  const reqs = window._SWDRequirements;
  if(!reqs.length){
    list.innerHTML = '<p style="font-size:12.5px;color:var(--ink-3)">No requirements set. All records will pass. Add a requirement below or click a suggestion.</p>';
    return;
  }
  list.innerHTML = reqs.map(req => {
    const typeOpts = REQ_TYPES.map(t => `<option value="${t.value}" ${req.type===t.value?'selected':''}>${t.label}</option>`).join('');
    const needsValue = !['has_doi','has_coordinates','has_country','has_abstract'].includes(req.type);
    return `<div class="req-row ${req.enabled?'req-enabled':'req-disabled'}" id="req-row-${req.id}">
      <input type="checkbox" class="req-enable-toggle" ${req.enabled?'checked':''} title="Enable/disable" onchange="SWDReq.toggle(${req.id},this.checked)" />
      <input type="text" class="req-label" value="${esc(req.label)}" placeholder="Requirement label" onchange="SWDReq.rename(${req.id},this.value)" />
      <select class="req-type-select" onchange="SWDReq.setType(${req.id},this.value)">${typeOpts}</select>
      ${needsValue ? `<input type="text" class="req-value" value="${esc(req.value||'')}" placeholder="value" onchange="SWDReq.setValue(${req.id},this.value)" />` : ''}
      <button class="req-remove" onclick="SWDReq.remove(${req.id})">✕</button>
    </div>`;
  }).join('');
}

window.SWDReq = {
  add(type, label, value){
    const t = type || 'abstract_contains';
    const tDef = REQ_TYPES.find(x=>x.value===t);
    window._SWDRequirements.push({ id:++_reqId, type:t, label:label||(tDef?.label||'New requirement'), value:value||'', enabled:true });
    renderRequirements();
  },
  remove(id){ window._SWDRequirements = window._SWDRequirements.filter(r=>r.id!==id); renderRequirements(); },
  toggle(id, val){ const r=window._SWDRequirements.find(r=>r.id===id); if(r){r.enabled=val; renderRequirements();} },
  rename(id, label){ const r=window._SWDRequirements.find(r=>r.id===id); if(r) r.label=label; },
  setType(id, type){ const r=window._SWDRequirements.find(r=>r.id===id); if(r){r.type=type; renderRequirements();} },
  setValue(id, val){ const r=window._SWDRequirements.find(r=>r.id===id); if(r) r.value=val; },
  serialize(){ return window._SWDRequirements.map(r=>({type:r.type,label:r.label,value:r.value,enabled:r.enabled})); },
  restore(arr){ if(!Array.isArray(arr)) return; window._SWDRequirements=arr.map(r=>({id:++_reqId,type:r.type||'custom_text',label:r.label||'',value:r.value||'',enabled:r.enabled!==false})); renderRequirements(); },
};

document.getElementById('btn-add-req')?.addEventListener('click', () => window.SWDReq.add());
document.querySelectorAll('.req-suggestion-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const type = chip.dataset.type;
    const label = chip.dataset.label;
    const value = chip.dataset.value || '';
    window.SWDReq.add(type, label, value);
  });
});

renderRequirements();

// Hook into search completion: apply requirements to records
const _origEndObs2 = document.getElementById('btn-run');
if(_origEndObs2){
  new MutationObserver(()=>{
    if(!_origEndObs2.disabled && (window._SWDRecords||[]).length){
      applyRequirements(window._SWDRecords);
    }
  }).observe(_origEndObs2,{attributes:true,attributeFilter:['disabled']});
}

// Patch preset serialization to include requirements + discipline
const _origSerializePreset = serializePreset;
serializePreset = function(name){
  const base = _origSerializePreset(name);
  base.requirements = window.SWDReq.serialize();
  base.discipline = document.getElementById('db-discipline-select')?.value || 'general';
  return base;
};
const _origApplyPreset = applyPreset;
applyPreset = function(data){
  _origApplyPreset(data);
  if(data.requirements) window.SWDReq.restore(data.requirements);
  if(data.discipline){
    const sel = document.getElementById('db-discipline-select');
    if(sel){ sel.value = data.discipline; window.SWDDiscipline.onDisciplineChange(); }
  }
};

// Patch renderTable to show req_fail column and filter option
// Add req_fail filter to the search-filter-row dropdown
const reqFilterSel = document.getElementById('res-req-filter');
if(reqFilterSel){
  reqFilterSel.addEventListener('change', () => renderTable && renderTable());
}

// Extend existing renderTable with req-fail row class and badge
// We patch at the end by overriding the tbody injection
const _patchForReqFail = function(){
  const tbody = document.getElementById('results-tbody');
  if(!tbody) return;
  const reqFilter = document.getElementById('res-req-filter')?.value || '';
  if(!reqFilter) return; // no filter active — no change needed
  const rows = [...tbody.querySelectorAll('tr:not(.empty-row)')];
  rows.forEach(row => {
    const key = row.querySelector('input[type="checkbox"]')?.getAttribute('onchange')?.match(/'([^']+)'/)?.[1];
    if(!key) return;
    const r = (window._SWDRecords||[]).find(rec => screeningKey(rec) === key);
    if(!r) return;
    if(reqFilter === 'fail' && !r._req_fail) row.style.display = 'none';
    if(reqFilter === 'pass' && r._req_fail) row.style.display = 'none';
  });
};

// Re-wire renderTable to apply req filter after render
const _origRTForReq = window.renderTable || renderTable;
if(typeof renderTable === 'function'){
  const _patchedRT = function(){
    _origRTForReq();
    setTimeout(_patchForReqFail, 0);
  };
  // assign to global renderTable if accessible
  try { renderTable = _patchedRT; } catch(e){}
}

}); // end DOMContentLoaded
