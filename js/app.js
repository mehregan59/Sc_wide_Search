/**
 * SWD Search — single-file bundle with live schema editor
 * All modules inlined in dependency order inside DOMContentLoaded.
 */
document.addEventListener('DOMContentLoaded', () => {

// ═══════════════════════════════════════════════════════════════
// LIVE SCHEMA — user-editable, drives table + all exports
// ═══════════════════════════════════════════════════════════════

// Each field: { field, label, type, desc, enabled, extractFrom, keywords }
// extractFrom: 'country'|'region'|'host'|'evidence_type'|'evidence_class'|'text'|'fixed'|null
// keywords: array of strings used for pattern extraction (user can edit)
let LIVE_SCHEMA = [
  { field:'full_citation',       label:'Full citation',        type:'string',  desc:'Full reference (APA)',                  enabled:true,  extractFrom:null },
  { field:'pub_year',            label:'Publication year',     type:'integer', desc:'Year of publication',                   enabled:true,  extractFrom:null },
  { field:'source_type',         label:'Source type',          type:'enum',    desc:'journal|thesis|report|conference|grey', enabled:true,  extractFrom:null },
  { field:'language',            label:'Language',             type:'string',  desc:'ISO 639-1 code',                        enabled:true,  extractFrom:null },
  { field:'country',             label:'Country',              type:'string',  desc:'Country of record origin',              enabled:true,  extractFrom:'country',
    keywords:['Japan','China','Korea','Taiwan','United States','USA','Canada','Mexico','Germany','France','Italy','Spain','Portugal','Switzerland','Austria','Belgium','Netherlands','United Kingdom','UK','Poland','Czech Republic','Hungary','Slovenia','Croatia','Serbia','Romania','Bulgaria','Greece','Turkey','Chile','Brazil','Argentina','Uruguay','Colombia','Peru','Australia','New Zealand','South Africa','Morocco','Tunisia','Israel','India','Thailand','Vietnam','Malaysia','Indonesia','Philippines','Finland','Sweden','Norway','Denmark','Ireland','Scotland'] },
  { field:'region',              label:'Region / state',       type:'string',  desc:'State, province, or region',            enabled:true,  extractFrom:'region',
    keywords:['Baden-Württemberg','Bavaria','Rhineland','Saxony','Thuringia','Trentino','Alto Adige','Lombardy','Friuli','Veneto','Piedmont','Tuscany','Nagano','Yamanashi','Hokkaido','Aomori','California','Oregon','Washington','Michigan','British Columbia','Ontario','Quebec','Catalonia','Aragon','Navarra','Valencia','Andalusia','Occitanie','Provence','Alsace','Valais','Vaud','Ticino','Styria','Tyrol','Carinthia','Flanders','Wallonia','Silesia','Alentejo','Algarve'] },
  { field:'locality',            label:'Locality / site',      type:'string',  desc:'Exact site name',                       enabled:true,  extractFrom:null },
  { field:'coordinates',         label:'Coordinates',          type:'string',  desc:'Decimal lat/lon',                       enabled:true,  extractFrom:null },
  { field:'sampling_year',       label:'Sampling year',        type:'string',  desc:'Year of collection',                    enabled:true,  extractFrom:null },
  { field:'host_plant',          label:'Host plant / crop',    type:'string',  desc:'Host plant if stated',                  enabled:true,  extractFrom:'host',
    keywords:['Prunus avium','Prunus cerasus','sweet cherry','sour cherry','cherry','Vaccinium corymbosum','Vaccinium myrtillus','blueberry','bilberry','Rubus idaeus','Rubus fruticosus','raspberry','blackberry','Fragaria','strawberry','Sambucus nigra','elderberry','Vitis vinifera','grape','Prunus persica','peach','nectarine','Ficus carica','fig','Rosa','Lonicera','Actinidia','kiwi','Morus','mulberry'] },
  { field:'study_context',       label:'Study context',        type:'string',  desc:'Brief study type description',          enabled:true,  extractFrom:null },
  { field:'evidence_type',       label:'Evidence type',        type:'enum',    desc:'trap|morphology|DNA|observation|model', enabled:true,  extractFrom:'evidence_type' },
  { field:'evidence_class',      label:'Evidence class',       type:'enum',    desc:'primary|secondary|modelled|...',        enabled:true,  extractFrom:'evidence_class' },
  { field:'category',            label:'Category',             type:'enum',    desc:'A|B|C|D|E|F',                           enabled:true,  extractFrom:null },
  { field:'excerpt',             label:'Excerpt',              type:'string',  desc:'Sentence mentioning location',          enabled:true,  extractFrom:null },
  { field:'doi',                 label:'DOI',                  type:'string',  desc:'DOI or "not reported"',                 enabled:true,  extractFrom:null },
  { field:'url',                 label:'URL',                  type:'string',  desc:'Access URL',                            enabled:true,  extractFrom:null },
  { field:'pdf_available',       label:'PDF available',        type:'enum',    desc:'yes|no|paywalled|unknown',              enabled:true,  extractFrom:null },
  { field:'verification_status', label:'Verification',         type:'enum',    desc:'Verified|Partly verified|...',          enabled:true,  extractFrom:null },
  { field:'notes',               label:'Notes',                type:'string',  desc:'Caveats and flags',                     enabled:true,  extractFrom:null },
  { field:'source_db',           label:'Source database',      type:'string',  desc:'Database where record was found',       enabled:true,  extractFrom:null },
];

// Custom user-added fields beyond the defaults
let customFields = [];

function getActiveSchema() {
  return [...LIVE_SCHEMA, ...customFields].filter(f => f.enabled);
}

function getKeywords(extractFrom) {
  const f = [...LIVE_SCHEMA, ...customFields].find(s => s.extractFrom === extractFrom);
  return f ? (f.keywords || []) : [];
}

// ═══════════════════════════════════════════════════════════════
// MISSING SOURCES
// ═══════════════════════════════════════════════════════════════
const MISSING_SOURCES = [
  'Pre-1990 Japanese agricultural bulletins (NARO series)',
  'Chinese provincial plant protection station annual reports (植保站年报)',
  'Korean RDA research bulletins on fruit flies (농촌진흥청 연구보고서)',
  'Regional Italian "Bollettino di Zoologia Agraria e di Bachicoltura" older issues',
  'FAO/IAEA technical reports on fruit fly control (grey literature)',
  'Swiss Agroscope technical bulletins on Kirschessigfliege (2008–2012)',
  'Austrian Laimburg Research Centre internal reports',
  'Taiwanese BAPHIQ quarantine interception records',
  'Slovenian and Croatian phytosanitary authority field reports',
  'Canadian CFIA first-detection internal dossiers',
  'Chilean SAG phytosanitary bulletins',
  'IOBC-WPRS fruit fly working group conference proceedings',
  'EPPO Panel on Phytosanitary Measures meeting minutes',
  'Portuguese DGAV phytosanitary surveillance reports',
  'Turkish GKGM plant protection directorate bulletins',
  'Serbian and Hungarian agricultural extension first-detection reports',
  'Older Taiwanese and South Korean university dissertations (pre-2005)',
  'Regional French DRAAF annual phytosanitary reports',
];

const DB_LABELS = {
  semanticscholar:'Semantic Scholar', openalex:'OpenAlex', europepmc:'Europe PMC',
  crossref:'Crossref', unpaywall:'Unpaywall', base:'BASE', zenodo:'Zenodo',
  eppo:'EPPO Global DB', cabi:'CABI', usda:'USDA/NAL',
  jki:'JKI Germany', naro:'NARO Japan', caas:'CAAS China', rda:'RDA Korea',
  gbif:'GBIF', inat:'iNaturalist', bold:'BOLD', ncbi:'NCBI', lens:'Lens.org',
};

const VERIF_CLASS = {
  'Verified':'verif-verified','Partly verified':'verif-partly',
  'Needs manual check':'verif-manual','Secondary citation only':'verif-secondary',
  'No usable location':'verif-noloc',
};

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════
function getSettings() {
  const lines = id => (document.getElementById(id).value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const checked = sel => [...document.querySelectorAll(sel)].filter(e=>e.checked).map(e=>e.value);
  return {
    speciesTerms: lines('cfg-species'), commonTerms: lines('cfg-common'),
    extraTerms:   lines('cfg-extra'),   excludeTerms: lines('cfg-exclude'),
    yearFrom: parseInt(document.getElementById('cfg-yr-from').value)||1900,
    yearTo:   parseInt(document.getElementById('cfg-yr-to').value)||2025,
    maxPerQuery: parseInt(document.getElementById('cfg-max').value)||500,
    languages: document.getElementById('cfg-langs').value.split(',').map(s=>s.trim()).filter(Boolean),
    geoReq: parseInt(document.getElementById('cfg-geo-req').value)||0,
    databases: checked('#chips-academic input,#chips-gov input,#chips-bio input'),
    scope: checked('#chips-scope input'),
  };
}

function resetDefaults() {
  document.getElementById('cfg-yr-from').value='1900';
  document.getElementById('cfg-yr-to').value='2025';
  document.getElementById('cfg-max').value='500';
  document.getElementById('cfg-geo-req').value='0';
  document.getElementById('cfg-extra').value='';
  document.getElementById('cfg-exclude').value='';
  document.querySelectorAll('#chips-scope input').forEach(e=>e.checked=true);
}

// ═══════════════════════════════════════════════════════════════
// ENGINES
// ═══════════════════════════════════════════════════════════════
const DELAY=200, RETRY_WAIT=2000, MAX_RETRY=2;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function fetchJSON(url,signal,attempt=0){
  await sleep(DELAY);
  try{
    const res=await fetch(url,{headers:{'Accept':'application/json'},signal});
    if(res.status===429||res.status===503){
      if(attempt<MAX_RETRY){await sleep(RETRY_WAIT*(attempt+1));return fetchJSON(url,signal,attempt+1);}
      return null;
    }
    if(!res.ok)return null;
    return await res.json();
  }catch(e){if(e.name==='AbortError')throw e;return null;}
}

function reconstitute(inv){
  if(!inv)return '';
  const pos=[];
  for(const[w,idxs]of Object.entries(inv))for(const i of idxs)pos.push([i,w]);
  return pos.sort((a,b)=>a[0]-b[0]).map(p=>p[1]).join(' ');
}
const mapOAType=t=>({'journal-article':'journal','dissertation':'thesis','report':'report','book-chapter':'book_chapter','proceedings-article':'conference','preprint':'grey'}[t]||'journal');
const mapCRType=t=>({'journal-article':'journal','book-chapter':'book_chapter','proceedings-article':'conference','dissertation':'thesis','report':'report','posted-content':'grey'}[t]||'journal');

let _gbifCache=null,_inatCache=null;
function resetEngineCache(){_gbifCache=null;_inatCache=null;}

async function queryOpenAlex(term,s,signal,label){
  const url=`https://api.openalex.org/works?search=${encodeURIComponent(term)}&filter=publication_year:${s.yearFrom}-${s.yearTo}&per-page=100&mailto=swd-search@research.tool`;
  const data=await fetchJSON(url,signal);
  if(!data)return null;
  return(data.results||[]).map(p=>({title:p.title||'',authors:(p.authorships||[]).map(a=>a.author?.display_name).filter(Boolean).join(', '),year:p.publication_year||null,abstract:reconstitute(p.abstract_inverted_index),doi:p.doi?p.doi.replace('https://doi.org/',''):'not reported',url:p.open_access?.oa_url||p.doi||'not reported',language:p.language||'',source_type:mapOAType(p.type),pdf_available:p.open_access?.is_oa?'yes':'paywalled',source_db:label||'OpenAlex'}));
}
async function queryEuropePMC(term,s,signal){
  const q=encodeURIComponent(`"${term}" AND (PUB_YEAR:[${s.yearFrom} TO ${s.yearTo}])`);
  const data=await fetchJSON(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&pageSize=100&resultType=core`,signal);
  if(!data)return null;
  return((data.resultList||{}).result||[]).map(p=>({title:p.title||'',authors:(p.authorList?.author||[]).map(a=>a.fullName).join(', '),year:parseInt(p.pubYear)||null,abstract:p.abstractText||'',doi:p.doi||'not reported',url:p.doi?`https://doi.org/${p.doi}`:'not reported',language:p.language||'',source_type:'journal',pdf_available:p.isOpenAccess==='Y'?'yes':'unknown',source_db:'Europe PMC'}));
}
async function queryCrossref(term,s,signal){
  const url=`https://api.crossref.org/works?query=${encodeURIComponent(term)}&filter=from-pub-date:${s.yearFrom},until-pub-date:${s.yearTo}&rows=100&mailto=swd-search@research.tool`;
  const data=await fetchJSON(url,signal);
  if(!data)return null;
  return((data.message||{}).items||[]).map(p=>({title:Array.isArray(p.title)?p.title[0]:(p.title||''),authors:(p.author||[]).map(a=>[a.family,a.given].filter(Boolean).join(' ')).join('; '),year:p.published?.['date-parts']?.[0]?.[0]||null,abstract:p.abstract?p.abstract.replace(/<[^>]+>/g,''):'',doi:p.DOI||'not reported',url:p.DOI?`https://doi.org/${p.DOI}`:'not reported',source_type:mapCRType(p.type),pdf_available:p.link?.find(l=>l['content-type']==='application/pdf')?'yes':'unknown',source_db:'Crossref'}));
}
async function queryZenodo(term,s,signal){
  const data=await fetchJSON(`https://zenodo.org/api/records?q=${encodeURIComponent(term)}&size=100&sort=mostrecent&type=publication`,signal);
  if(!data)return null;
  return((data.hits||{}).hits||[]).map(r=>({title:r.metadata?.title||'',authors:(r.metadata?.creators||[]).map(c=>c.name).join(', '),year:r.metadata?.publication_date?parseInt(r.metadata.publication_date.slice(0,4)):null,abstract:r.metadata?.description||'',doi:r.doi||r.metadata?.doi||'not reported',url:r.links?.html||'not reported',source_type:'grey',pdf_available:r.files?.length?'yes':'unknown',source_db:'Zenodo'}));
}
async function queryGBIF(signal){
  if(!_gbifCache){const data=await fetchJSON('https://api.gbif.org/v1/occurrence/search?taxonKey=1455379&limit=300',signal);_gbifCache=data?(data.results||[]):[];}
  return _gbifCache.map(o=>({title:`GBIF occurrence #${o.key}`,authors:o.institutionCode||o.datasetName||'GBIF',year:o.year||null,abstract:'',doi:'not reported',url:`https://www.gbif.org/occurrence/${o.key}`,country:o.country||'not reported',region:o.stateProvince||'not reported',locality:o.locality||'not reported',coordinates:(o.decimalLatitude&&o.decimalLongitude)?`${o.decimalLatitude}, ${o.decimalLongitude}`:'not reported',host_plant:o.associatedTaxa||'not reported',evidence_type:'observation',evidence_class:'primary',source_type:'occurrence',pdf_available:'unknown',source_db:'GBIF',_direct:true}));
}
async function queryINat(signal){
  if(!_inatCache){const data=await fetchJSON('https://api.inaturalist.org/v1/observations?taxon_name=Drosophila+suzukii&quality_grade=research&per_page=200',signal);_inatCache=data?(data.results||[]):[];}
  return _inatCache.map(o=>({title:`iNaturalist #${o.id}`,authors:o.user?.login||'iNaturalist user',year:o.observed_on?parseInt(o.observed_on.slice(0,4)):null,abstract:o.description||'',doi:'not reported',url:`https://www.inaturalist.org/observations/${o.id}`,country:o.place_guess||'not reported',region:'not reported',locality:o.place_guess||'not reported',coordinates:o.location||'not reported',evidence_type:'observation',evidence_class:'primary',source_type:'occurrence',pdf_available:'unknown',source_db:'iNaturalist',_direct:true}));
}
async function engineQuery(db,term,s,signal){
  try{
    switch(db){
      case 'semanticscholar':return await queryOpenAlex(term,s,signal,'Semantic Scholar (via OpenAlex)');
      case 'openalex':return await queryOpenAlex(term,s,signal,'OpenAlex');
      case 'europepmc':return await queryEuropePMC(term,s,signal);
      case 'crossref':return await queryCrossref(term,s,signal);
      case 'zenodo':return await queryZenodo(term,s,signal);
      case 'gbif':return await queryGBIF(signal);
      case 'inat':return await queryINat(signal);
      default:return[];
    }
  }catch(e){if(e.name==='AbortError')throw e;return null;}
}

// ═══════════════════════════════════════════════════════════════
// EXTRACTOR — uses LIVE_SCHEMA keywords dynamically
// ═══════════════════════════════════════════════════════════════
const EV_TYPE_KW={trap:['trap','trapping','Droso-Trap','McPhail','sticky'],morphology:['morpholog','specimen','pinned','museum'],DNA:['DNA','COI','ITS','barcode','sequenc','haplotype'],model:['MaxEnt','BIOCLIM','SDM','niche'],review:['review','meta-analysis','synthesis'],lab_colony:['colony','laborator','strain','reared','isofemale']};
const EV_CLASS_KW={primary:['collect','trap','specimen','survey','monitor','field','wild','caught','detected','first record','first report'],secondary:['cited in','according to','as reported by','pers. comm'],modelled:['model','predict','project','MaxEnt'],'review-only':['review','meta-analysis','synthesis'],'lab-strain-origin':['colony origin','lab strain','lab population','reared from','isofemale']};

function extractFrom(text,list){
  if(!text)return 'not reported';
  for(const p of list){if(new RegExp('\\b'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(text))return p;}
  return 'not reported';
}
function detectEvType(text){
  if(!text)return 'observation';
  for(const[t,kws]of Object.entries(EV_TYPE_KW))for(const k of kws)if(text.toLowerCase().includes(k.toLowerCase()))return t;
  return 'observation';
}
function detectEvClass(text){
  if(!text)return 'primary';
  for(const[c,kws]of Object.entries(EV_CLASS_KW))for(const k of kws)if(text.toLowerCase().includes(k.toLowerCase()))return c;
  return 'primary';
}

// Extract value for any custom field from full text using its keywords
function extractCustomField(fieldDef, text){
  if(!fieldDef.keywords||!fieldDef.keywords.length)return 'not reported';
  return extractFrom(text, fieldDef.keywords);
}

function assignCat(r){
  if(r.pub_year&&r.pub_year<1980)return 'F';
  if(!r.country||r.country==='not reported')return 'E';
  const ec=r.evidence_class||'';
  if(ec==='lab-strain-origin')return 'C';
  if(ec==='review-only'||ec==='modelled')return 'D';
  if(ec==='primary')return 'A';
  return 'B';
}
function assignVerif(r){
  if(!r.country||r.country==='not reported')return 'No usable location';
  if(r.evidence_class==='secondary')return 'Secondary citation only';
  if(!r.locality||r.locality==='not reported')return 'Needs manual check';
  if(r.doi&&r.doi!=='not reported'&&r.evidence_class==='primary')return 'Verified';
  return 'Partly verified';
}

function processHit(hit){
  const ft=[hit.title,hit.abstract].join(' ');
  const allFields=[...LIVE_SCHEMA,...customFields];

  // Base record from API hit
  const country=hit.country||extractFrom(ft,getKeywords('country'));
  const region=hit.region||extractFrom(ft,getKeywords('region'));
  const host=hit.host_plant||extractFrom(ft,getKeywords('host'));
  const evType=hit.evidence_type||detectEvType(ft);
  const evClass=hit.evidence_class||detectEvClass(ft);
  const doi=hit.doi||'not reported';
  const sentences=(hit.abstract||'').match(/[^.!?]+[.!?]+/g)||[];
  const excerpt=(sentences.find(s=>s.toLowerCase().includes((country||'').toLowerCase())||s.includes('suzukii'))||sentences[0]||'').trim().slice(0,400)||'not reported';

  const r={
    full_citation:hit._direct?`${hit.authors} (${hit.year||'n.d.'}). ${hit.title}. ${hit.source_db}.`:`${hit.authors||''} (${hit.year||'n.d.'}). ${hit.title||'Untitled'}. DOI: ${doi}`,
    pub_year:hit.year, source_type:hit.source_type||'journal', language:hit.language||'en',
    country, region,
    locality:hit.locality||'not reported',
    coordinates:hit.coordinates||'not reported',
    sampling_year:hit.year||'not reported',
    host_plant:host,
    study_context:hit._direct?'Occurrence record':(evType==='lab_colony'?'Laboratory study':'Field study / survey'),
    evidence_type:evType, evidence_class:evClass,
    excerpt:hit._direct?'not reported':excerpt,
    doi, url:hit.url||(doi!=='not reported'?`https://doi.org/${doi}`:'not reported'),
    pdf_available:hit.pdf_available||'unknown',
    source_db:hit.source_db,
    notes:country==='not reported'?'No geographic term found — manual full-text check required.':'',
  };

  // Populate any custom fields
  for(const f of customFields){
    if(f.extractFrom==='custom'&&f.keywords?.length){
      r[f.field]=extractCustomField(f,ft);
    } else {
      r[f.field]='not reported';
    }
  }

  r.category=assignCat(r);
  r.verification_status=assignVerif(r);
  return[r];
}

const _seen=new Set();
function resetSeen(){_seen.clear();}
function isDuplicate(r){
  const key=r.doi&&r.doi!=='not reported'?r.doi:(r.full_citation||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,80);
  if(_seen.has(key))return true;
  _seen.add(key);return false;
}

// ═══════════════════════════════════════════════════════════════
// EXPORT — all use active schema
// ═══════════════════════════════════════════════════════════════
const stamp=()=>new Date().toISOString().slice(0,10);
function dlFile(content,name,mime){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:mime}));
  a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function exportCSV(cat){
  const data=(window._SWDRecords||[]).filter(r=>cat==='all'||r.category===cat);
  if(!data.length){alert('No records. Run a search first.');return;}
  const active=getActiveSchema();
  const headers=active.map(s=>s.label||s.field);
  const rows=data.map(r=>active.map(s=>`"${String(r[s.field]||'').replace(/"/g,'""').replace(/\n/g,' ')}"`).join(','));
  dlFile([headers.join(','),...rows].join('\r\n'),`swd_records${cat!=='all'?'_cat'+cat:''}_${stamp()}.csv`,'text/csv;charset=utf-8;');
}
function exportJSON(){
  const data=window._SWDRecords||[];
  if(!data.length){alert('No records.');return;}
  dlFile(JSON.stringify(data,null,2),`swd_records_${stamp()}.json`,'application/json');
}
function exportBibtex(){
  const data=(window._SWDRecords||[]).filter(r=>r.doi&&r.doi!=='not reported');
  if(!data.length){alert('No records with DOIs.');return;}
  const entries=data.map((r,i)=>{
    const key=`record${r.pub_year||'nd'}_${i+1}`;
    const au=(r.full_citation||'').split('(')[0].trim().replace(/,\s*$/,'');
    const m=(r.full_citation||'').match(/\)\.\s+(.+?)\.\s+DOI:/);
    return `@article{${key},\n  author={${au}},\n  year={${r.pub_year||''}},\n  title={${m?m[1]:'Study'}},\n  doi={${r.doi}}\n}`;
  });
  dlFile(entries.join('\n\n'),`swd_${stamp()}.bib`,'text/plain;charset=utf-8;');
}
function exportGeoJSON(){
  const data=(window._SWDRecords||[]).filter(r=>r.coordinates&&r.coordinates!=='not reported');
  if(!data.length){alert('No records with coordinates.');return;}
  const active=getActiveSchema();
  const features=data.map(r=>{
    const[lat,lon]=r.coordinates.split(',').map(s=>parseFloat(s.trim()));
    const props={};active.forEach(s=>props[s.label||s.field]=r[s.field]||'');
    return{type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:props};
  });
  dlFile(JSON.stringify({type:'FeatureCollection',features},null,2),`swd_geo_${stamp()}.geojson`,'application/json');
}
function exportMissing(){
  const lines=['Missing / hard-to-access sources','═'.repeat(56),'Generated: '+new Date().toISOString(),'',...MISSING_SOURCES.map((s,i)=>`${i+1}. ${s}`)];
  dlFile(lines.join('\n'),`swd_missing_sources_${stamp()}.txt`,'text/plain;charset=utf-8;');
}
function exportSchema(){
  const all=[...LIVE_SCHEMA,...customFields];
  dlFile(JSON.stringify(all,null,2),`swd_schema_${stamp()}.json`,'application/json');
}

function getPaywalled(){return(window._SWDRecords||[]).filter(r=>r.doi&&r.doi!=='not reported'&&(r.pdf_available==='paywalled'||r.pdf_available==='no'||r.pdf_available==='unknown'));}
function exportPaywallTxt(){
  const data=getPaywalled();
  if(!data.length){alert('No paywalled records.');return;}
  const lines=['Paywalled papers — DOI list','═'.repeat(40),`Generated: ${new Date().toISOString()}`,`Total: ${data.length} papers`,'','HOW TO ACCESS:','  1. Email the corresponding author (Google Scholar / ResearchGate)','  2. Interlibrary loan (ILL) — free at most institutions, 24–48h','  3. Unpaywall: https://unpaywall.org/<DOI>','  4. Europe PMC: https://europepmc.org/search?query=<DOI>','','─'.repeat(60),'',
    ...data.map((r,i)=>[`[${i+1}] DOI: ${r.doi}`,`    Authors: ${(r.full_citation||'').split('(')[0].trim().slice(0,100)}`,`    Year: ${r.pub_year||'n.d.'} | Country: ${r.country} | Category: ${r.category}`,`    Link: https://doi.org/${r.doi}`,`    Unpaywall: https://unpaywall.org/${r.doi}`,``].join('\n'))];
  dlFile(lines.join('\n'),`swd_paywalled_dois_${stamp()}.txt`,'text/plain;charset=utf-8;');
}
function exportPaywallCsv(){
  const data=getPaywalled();
  if(!data.length){alert('No paywalled records.');return;}
  const cols=['doi','pub_year','authors','country','category','doi_url','unpaywall_url'];
  const rows=data.map(r=>{const au=(r.full_citation||'').split('(')[0].trim().slice(0,120);return[`"${r.doi}"`,`"${r.pub_year||''}"`,`"${au.replace(/"/g,'""')}"`,`"${r.country}"`,`"${r.category}"`,`"https://doi.org/${r.doi}"`,`"https://unpaywall.org/${r.doi}"`].join(',');});
  dlFile([cols.join(','),...rows].join('\r\n'),`swd_paywalled_dois_${stamp()}.csv`,'text/csv;charset=utf-8;');
}

function copyDOI(doi,codeId){
  navigator.clipboard.writeText(doi).then(()=>{const el=document.getElementById(codeId);if(el){el.style.background='var(--accent-lt)';setTimeout(()=>el.style.background='',1200);}});
}
window.copyDOI=copyDOI;

function renderPaywallPanel(){
  const el=document.getElementById('paywall-list');
  const countEl=document.getElementById('paywall-count');
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

window.SWDExportFn={csv:exportCSV,json:exportJSON,bibtex:exportBibtex,geojson:exportGeoJSON,missing:exportMissing,schema:exportSchema,paywallTxt:exportPaywallTxt,paywallCsv:exportPaywallCsv};

// ═══════════════════════════════════════════════════════════════
// SCHEMA EDITOR UI
// ═══════════════════════════════════════════════════════════════
function renderSchemaEditor(){
  const tbody=document.getElementById('schema-editor-tbody');
  if(!tbody)return;
  const all=[...LIVE_SCHEMA,...customFields];
  tbody.innerHTML=all.map((f,i)=>{
    const isCustom=i>=LIVE_SCHEMA.length;
    const kwCount=f.keywords?f.keywords.length:0;
    return `<tr class="${f.enabled?'':'schema-row-disabled'}" id="srow-${f.field}">
      <td><label class="schema-toggle"><input type="checkbox" ${f.enabled?'checked':''} onchange="SWDSchema.toggle('${f.field}',this.checked)"></label></td>
      <td><code class="field-name" style="font-size:11px">${f.field}</code></td>
      <td><input type="text" value="${esc(f.label||f.field)}" class="schema-label-input" onchange="SWDSchema.rename('${f.field}',this.value)" placeholder="Column label" /></td>
      <td style="font-size:11px;color:var(--ink-3)">${f.type}</td>
      <td>${f.extractFrom?`<button class="btn btn-sm btn-ghost schema-kw-btn" onclick="SWDSchema.editKeywords('${f.field}')">${kwCount} keywords</button>`:'<span style="font-size:11px;color:var(--ink-3)">—</span>'}</td>
      <td>${isCustom?`<button class="btn btn-sm btn-ghost" onclick="SWDSchema.removeCustom('${f.field}')" style="color:var(--red)">Remove</button>`:'<span style="font-size:11px;color:var(--ink-3)">core</span>'}</td>
    </tr>`;
  }).join('');
}

function renderSchemaPreview(){
  // Update the export schema table
  const tbody=document.getElementById('schema-tbody');
  if(!tbody)return;
  const active=getActiveSchema();
  tbody.innerHTML=active.map(s=>`<tr><td class="field-name">${s.field}</td><td class="field-type">${s.type}</td><td style="font-size:12.5px;color:var(--ink-2)">${s.label||s.field} — ${s.desc||''}</td></tr>`).join('');
}

window.SWDSchema={
  toggle(field,enabled){
    const f=[...LIVE_SCHEMA,...customFields].find(s=>s.field===field);
    if(f){f.enabled=enabled;renderSchemaEditor();renderSchemaPreview();renderTable();}
  },
  rename(field,label){
    const f=[...LIVE_SCHEMA,...customFields].find(s=>s.field===field);
    if(f){f.label=label;renderSchemaPreview();renderTable();}
  },
  editKeywords(field){
    const f=[...LIVE_SCHEMA,...customFields].find(s=>s.field===field);
    if(!f)return;
    const current=(f.keywords||[]).join('\n');
    const modal=document.getElementById('kw-modal');
    const title=document.getElementById('kw-modal-title');
    const ta=document.getElementById('kw-modal-ta');
    const saveBtn=document.getElementById('kw-modal-save');
    title.textContent=`Keywords for "${f.label||f.field}"`;
    ta.value=current;
    modal.style.display='flex';
    saveBtn.onclick=()=>{
      f.keywords=ta.value.split('\n').map(s=>s.trim()).filter(Boolean);
      modal.style.display='none';
      renderSchemaEditor();
    };
  },
  addCustomField(){
    const nameEl=document.getElementById('new-field-name');
    const labelEl=document.getElementById('new-field-label');
    const kwEl=document.getElementById('new-field-kw');
    const name=(nameEl.value||'').trim().replace(/[^a-z0-9_]/gi,'_').toLowerCase();
    const label=(labelEl.value||'').trim()||name;
    const kws=kwEl.value.split('\n').map(s=>s.trim()).filter(Boolean);
    if(!name){alert('Field name required.');return;}
    if([...LIVE_SCHEMA,...customFields].find(f=>f.field===name)){alert('A field with that name already exists.');return;}
    customFields.push({field:name,label,type:'string',desc:'Custom field',enabled:true,extractFrom:'custom',keywords:kws});
    nameEl.value='';labelEl.value='';kwEl.value='';
    renderSchemaEditor();renderSchemaPreview();
  },
  removeCustom(field){
    customFields=customFields.filter(f=>f.field!==field);
    renderSchemaEditor();renderSchemaPreview();renderTable();
  },
  loadJSON(){
    const inp=document.createElement('input');inp.type='file';inp.accept='.json';
    inp.onchange=e=>{
      const file=e.target.files[0];if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>{
        try{
          const loaded=JSON.parse(ev.target.result);
          if(!Array.isArray(loaded)){alert('Invalid schema file.');return;}
          // Apply labels and enabled states to matching fields
          loaded.forEach(lf=>{
            const f=LIVE_SCHEMA.find(s=>s.field===lf.field);
            if(f){if(lf.label)f.label=lf.label;if(typeof lf.enabled==='boolean')f.enabled=lf.enabled;if(lf.keywords)f.keywords=lf.keywords;}
            else if(lf.field&&!customFields.find(c=>c.field===lf.field)){
              customFields.push({field:lf.field,label:lf.label||lf.field,type:lf.type||'string',desc:lf.desc||'',enabled:lf.enabled!==false,extractFrom:'custom',keywords:lf.keywords||[]});
            }
          });
          renderSchemaEditor();renderSchemaPreview();renderTable();
          alert('Schema loaded successfully.');
        }catch(err){alert('Could not parse schema file: '+err.message);}
      };
      reader.readAsText(file);
    };
    inp.click();
  },
};

// ═══════════════════════════════════════════════════════════════
// APP / UI
// ═══════════════════════════════════════════════════════════════
window._SWDRecords=[];
let isRunning=false,abortCtrl=null,midTerms=[],currentCat='all';
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
document.getElementById('btn-apply-yr').addEventListener('click',()=>{
  const f=document.getElementById('mid-yr-from').value,t=document.getElementById('mid-yr-to').value;
  if(f)document.getElementById('cfg-yr-from').value=f;
  if(t)document.getElementById('cfg-yr-to').value=t;
  logMsg(`Year range updated: ${f||'—'}–${t||'—'}`,'warn');
});
document.getElementById('btn-add-db').addEventListener('click',()=>{
  const db=document.getElementById('mid-db-select').value;if(!db)return;
  logMsg(`Database queued: ${DB_LABELS[db]||db}`,'ok');
  const el=document.querySelector(`input[value="${db}"]`);if(el)el.checked=true;
});
document.getElementById('res-search').addEventListener('input',renderTable);
document.getElementById('res-verif').addEventListener('change',renderTable);
document.getElementById('res-sort').addEventListener('change',renderTable);
document.querySelectorAll('.cat-filter-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.cat-filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');currentCat=btn.dataset.cat;renderTable();
}));
const pwSearch=document.getElementById('paywall-search');
if(pwSearch)pwSearch.addEventListener('input',renderPaywallPanel);

// Close keyword modal
document.getElementById('kw-modal-cancel').addEventListener('click',()=>{document.getElementById('kw-modal').style.display='none';});
document.getElementById('kw-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.style.display='none';});

// Add custom field button
document.getElementById('btn-add-custom-field').addEventListener('click',()=>SWDSchema.addCustomField());

// Missing sources
document.getElementById('missing-list').innerHTML=MISSING_SOURCES.map(s=>`<div class="missing-item">${s}</div>`).join('');

// Init schema UI
renderSchemaEditor();
renderSchemaPreview();

// ── Search ────────────────────────────────────────────────────
async function startSearch(){
  if(isRunning)return;
  isRunning=true;abortCtrl=new AbortController();
  window._SWDRecords=[];resetSeen();resetEngineCache();
  stats={queries:0,raw:0,dedup:0,records:0,noloc:0,errors:0,skipped:0};
  Object.keys(catCounts).forEach(k=>catCounts[k]=0);
  document.getElementById('log-box').innerHTML='';
  setProgress(0,'Initialising…');setStatus('running','Running');
  document.getElementById('btn-run').disabled=true;
  document.getElementById('btn-stop').disabled=false;

  const s=getSettings();
  const allTerms=[...s.speciesTerms,...s.commonTerms,...s.extraTerms,...midTerms].filter(Boolean);
  const signal=abortCtrl.signal;
  const searchDBs=s.databases.filter(db=>!STUB_DBS.has(db)&&!ONCE_DBS.has(db));
  const occDBs=s.databases.filter(db=>ONCE_DBS.has(db));
  const stubDBs=s.databases.filter(db=>STUB_DBS.has(db));
  const total=(searchDBs.length*allTerms.length)+occDBs.length;
  let done=0;

  logMsg(`Search started — ${searchDBs.length} search DBs × ${allTerms.length} terms + ${occDBs.length} occurrence DBs`);
  if(stubDBs.length)logMsg(`${stubDBs.length} institutional DBs (stub): ${stubDBs.map(d=>DB_LABELS[d]||d).join(', ')}`,'warn');
  logMsg(`Year range: ${s.yearFrom}–${s.yearTo}`);

  for(const db of occDBs){
    if(signal.aborted)break;
    const label=DB_LABELS[db]||db;logMsg(`Fetching ${label}…`);stats.queries++;
    try{
      const hits=await engineQuery(db,'',s,signal);
      if(hits===null){logMsg(`  ⚠ ${label} unreachable`,'warn');stats.skipped++;}
      else{stats.raw+=hits.length;let n=0;for(const h of hits)for(const r of processHit(h)){if(isDuplicate(r))continue;window._SWDRecords.push(r);n++;stats.dedup++;if(r.category==='E')stats.noloc++;else{stats.records++;catCounts[r.category]=(catCounts[r.category]||0)+1;}}logMsg(`  → ${hits.length} occurrences · ${n} new`,hits.length?'ok':'warn');}
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
        else{stats.raw+=hits.length;let n=0;for(const h of hits)for(const r of processHit(h)){if(isDuplicate(r))continue;window._SWDRecords.push(r);n++;stats.dedup++;if(r.category==='E')stats.noloc++;else{stats.records++;catCounts[r.category]=(catCounts[r.category]||0)+1;}}if(hits.length===0)logMsg(`  → 0 results`,'warn');else logMsg(`  → ${hits.length} hits · ${n} new · ${hits.length-n} dupes`,'ok');}
      }catch(e){if(e.name==='AbortError')break;stats.errors++;logMsg(`  ✖ ${label}: ${e.message}`,'err');}
      updateStats();done++;setProgress((done/total)*100,`${label} · "${term.slice(0,28)}"`);
    }
  }

  const stopped=signal.aborted;
  setProgress(stopped?null:100,stopped?'Stopped':'Complete');
  setStatus(stopped?'stopped':'done',stopped?'Stopped':'Done');
  logMsg(stopped?`Stopped. ${window._SWDRecords.length} records.`:`Complete — ${window._SWDRecords.length} records · ${stats.errors} errors · ${stats.skipped} skipped`,stopped?'warn':'ok');
  isRunning=false;
  document.getElementById('btn-run').disabled=false;
  document.getElementById('btn-stop').disabled=true;
  const badge=document.getElementById('badge-results');badge.textContent=window._SWDRecords.length;badge.hidden=!window._SWDRecords.length;
  const pwBadge=document.getElementById('badge-paywall');if(pwBadge){const n=getPaywalled().length;pwBadge.textContent=n;pwBadge.hidden=!n;}
  renderTable();renderPaywallPanel();
  if(!stopped)switchTab('results');
}

function addMidTerm(){
  const inp=document.getElementById('mid-term'),t=inp.value.trim();if(!t)return;
  midTerms.push(t);inp.value='';
  const chip=document.createElement('label');chip.className='chip';chip.style.cursor='pointer';
  chip.innerHTML=`${esc(t)} <span style="opacity:.5;margin-left:4px">×</span>`;
  chip.addEventListener('click',()=>{midTerms=midTerms.filter(x=>x!==t);chip.remove();});
  document.getElementById('mid-term-list').appendChild(chip);
  logMsg(`Added term: "${t}"`);
}

function renderTable(){
  const active=getActiveSchema();
  const q=(document.getElementById('res-search').value||'').toLowerCase();
  const v=document.getElementById('res-verif').value;
  const sort=document.getElementById('res-sort').value;
  let data=(window._SWDRecords||[]).filter(r=>{
    if(currentCat!=='all'&&r.category!==currentCat)return false;
    if(v&&r.verification_status!==v)return false;
    if(q){const h=active.map(s=>String(r[s.field]||'')).join(' ').toLowerCase();if(!h.includes(q))return false;}
    return true;
  });
  if(sort==='year_desc')data.sort((a,b)=>(b.pub_year||0)-(a.pub_year||0));
  if(sort==='year_asc')data.sort((a,b)=>(a.pub_year||0)-(b.pub_year||0));
  if(sort==='country_asc')data.sort((a,b)=>(a.country||'').localeCompare(b.country||''));
  if(sort==='verif')data.sort((a,b)=>(a.verification_status||'').localeCompare(b.verification_status||''));

  // Rebuild table header dynamically from active schema
  const thead=document.getElementById('results-thead');
  if(thead)thead.innerHTML='<tr>'+active.map(s=>`<th>${esc(s.label||s.field)}</th>`).join('')+'</tr>';

  const tbody=document.getElementById('results-tbody');
  if(!data.length){
    const cols=active.length||1;
    tbody.innerHTML=`<tr class="empty-row"><td colspan="${cols}">${window._SWDRecords.length===0?'Run a search to see results.':'No records match the filter.'}</td></tr>`;
    document.getElementById('table-footer').textContent='';return;
  }
  const MAX=500;
  tbody.innerHTML=data.slice(0,MAX).map(r=>{
    return '<tr>'+active.map(s=>{
      const val=r[s.field];
      // Special rendering for known fields
      if(s.field==='category')return `<td><span class="cat-pill cat-${(val||'e').toLowerCase()}">${val||'?'}</span></td>`;
      if(s.field==='verification_status')return `<td><span class="verif-badge ${VERIF_CLASS[val]||'verif-secondary'}" style="font-size:10px">${esc(val||'')}</span></td>`;
      if(s.field==='doi'&&val&&val!=='not reported')return `<td><a class="doi-link" href="https://doi.org/${val}" target="_blank" rel="noopener">DOI →</a></td>`;
      if(s.field==='url'&&val&&val!=='not reported')return `<td><a class="doi-link" href="${esc(val)}" target="_blank" rel="noopener">URL →</a></td>`;
      if(s.field==='full_citation')return `<td class="truncate" title="${esc(String(val||''))}">${esc(String(val||'').split('(')[0].trim().slice(0,40))}</td>`;
      return `<td class="truncate">${esc(String(val||'—'))}</td>`;
    }).join('')+'</tr>';
  }).join('');
  document.getElementById('table-footer').textContent=`Showing ${Math.min(data.length,MAX)} of ${data.length} records${data.length>MAX?` (first ${MAX} shown)`:''}`;
}

function logMsg(msg,cls=''){const box=document.getElementById('log-box'),p=document.createElement('p');if(cls)p.className=`log-${cls}`;p.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`;box.appendChild(p);box.scrollTop=box.scrollHeight;}
function setProgress(pct,label){if(pct!==null)document.getElementById('prog-fill').style.width=Math.min(100,pct)+'%';document.getElementById('prog-label').textContent=label||'';document.getElementById('prog-pct').textContent=pct!==null?Math.round(pct)+'%':'';}
function setStatus(state,text){const el=document.getElementById('run-status-label');el.className=`run-status ${state}`;el.textContent=text;}
function updateStats(){document.getElementById('s-queries').textContent=stats.queries;document.getElementById('s-raw').textContent=stats.raw;document.getElementById('s-dedup').textContent=stats.dedup;document.getElementById('s-records').textContent=stats.records;document.getElementById('s-noloc').textContent=stats.noloc;document.getElementById('s-errors').textContent=stats.errors;for(const k of Object.keys(catCounts)){const el=document.getElementById(`cat-${k.toLowerCase()}`);if(el)el.textContent=catCounts[k]||0;}}
function switchTab(id){document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));const btn=document.querySelector(`.nav-tab[data-tab="${id}"]`);if(btn)btn.classList.add('active');const panel=document.getElementById(`panel-${id}`);if(panel)panel.classList.add('active');if(id==='paywall')renderPaywallPanel();if(id==='schema')renderSchemaEditor();}

}); // end DOMContentLoaded
