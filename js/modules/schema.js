// ═══════════════════════════════════════════════════════════════
// SCHEMA.JS — live schema, custom fields, schema editor
// ═══════════════════════════════════════════════════════════════
import { esc } from './state.js';

export let LIVE_SCHEMA = [
  { field: 'full_citation',      label: 'Full citation',      type: 'string',  desc: 'Full reference (APA)',                   enabled: true, extractFrom: null },
  { field: 'pub_year',           label: 'Publication year',   type: 'integer', desc: 'Year of publication',                   enabled: true, extractFrom: null },
  { field: 'source_type',        label: 'Source type',        type: 'enum',    desc: 'journal|thesis|report|conference|grey', enabled: true, extractFrom: null },
  { field: 'language',           label: 'Language',           type: 'string',  desc: 'ISO 639-1 code',                        enabled: true, extractFrom: null },
  { field: 'country',            label: 'Country',            type: 'string',  desc: 'Country of record origin',              enabled: true, extractFrom: 'country',
    keywords: ['Japan','China','Korea','Taiwan','United States','USA','Canada','Mexico','Germany','France','Italy','Spain','Portugal','Switzerland','Austria','Belgium','Netherlands','United Kingdom','UK','Poland','Czech Republic','Hungary','Slovenia','Croatia','Serbia','Romania','Bulgaria','Greece','Turkey','Chile','Brazil','Argentina','Uruguay','Colombia','Peru','Australia','New Zealand','South Africa','Morocco','Tunisia','Israel','India','Thailand','Vietnam','Malaysia','Indonesia','Philippines','Finland','Sweden','Norway','Denmark','Ireland','Scotland'] },
  { field: 'region',             label: 'Region / state',     type: 'string',  desc: 'State, province, or region',           enabled: true, extractFrom: 'region',
    keywords: ['Baden-Württemberg','Bavaria','Rhineland','Saxony','Thuringia','Trentino','Alto Adige','Lombardy','Friuli','Veneto','Piedmont','Tuscany','Nagano','Yamanashi','Hokkaido','Aomori','California','Oregon','Washington','Michigan','British Columbia','Ontario','Quebec','Catalonia','Aragon','Navarra','Valencia','Andalusia','Occitanie','Provence','Alsace','Valais','Vaud','Ticino','Styria','Tyrol','Carinthia','Flanders','Wallonia','Silesia','Alentejo','Algarve'] },
  { field: 'locality',           label: 'Locality / site',    type: 'string',  desc: 'Exact site name',                       enabled: true, extractFrom: null },
  { field: 'coordinates',        label: 'Coordinates',        type: 'string',  desc: 'Decimal lat/lon',                       enabled: true, extractFrom: null },
  { field: 'sampling_year',      label: 'Sampling year',      type: 'string',  desc: 'Year of collection',                    enabled: true, extractFrom: null },
  { field: 'host_plant',         label: 'Host / subject',     type: 'string',  desc: 'Host plant, organism, or subject',      enabled: true, extractFrom: 'host',
    keywords: ['Prunus avium','Prunus cerasus','sweet cherry','sour cherry','cherry','Vaccinium corymbosum','Vaccinium myrtillus','blueberry','bilberry','Rubus idaeus','Rubus fruticosus','raspberry','blackberry','Fragaria','strawberry','Sambucus nigra','elderberry','Vitis vinifera','grape','Prunus persica','peach','nectarine','Ficus carica','fig','Rosa','Lonicera','Actinidia','kiwi','Morus','mulberry'] },
  { field: 'study_context',      label: 'Study context',      type: 'string',  desc: 'Brief study type description',          enabled: true, extractFrom: null },
  { field: 'evidence_type',      label: 'Evidence type',      type: 'enum',    desc: 'trap|morphology|DNA|observation|model', enabled: true, extractFrom: 'evidence_type' },
  { field: 'evidence_class',     label: 'Evidence class',     type: 'enum',    desc: 'primary|secondary|modelled|...',        enabled: true, extractFrom: 'evidence_class' },
  { field: 'category',           label: 'Category',           type: 'enum',    desc: 'A|B|C|D|E|F',                          enabled: true, extractFrom: null },
  { field: 'screening_decision', label: 'Screening',          type: 'enum',    desc: 'include|exclude|maybe',                 enabled: true, extractFrom: null },
  { field: 'screening_reason',   label: 'Screening reason',   type: 'string',  desc: 'Reason for decision',                   enabled: true, extractFrom: null },
  { field: 'excerpt',            label: 'Excerpt',            type: 'string',  desc: 'Sentence mentioning topic/location',    enabled: true, extractFrom: null },
  { field: 'doi',                label: 'DOI',                type: 'string',  desc: 'DOI or "not reported"',                enabled: true, extractFrom: null },
  { field: 'url',                label: 'URL',                type: 'string',  desc: 'Access URL',                            enabled: true, extractFrom: null },
  { field: 'pdf_available',      label: 'PDF available',      type: 'enum',    desc: 'yes|no|paywalled|unknown',              enabled: true, extractFrom: null },
  { field: 'verification_status',label: 'Verification',       type: 'enum',    desc: 'Verified|Partly verified|...',          enabled: true, extractFrom: null },
  { field: 'notes',              label: 'Notes',              type: 'string',  desc: 'Caveats and flags',                     enabled: true, extractFrom: null },
  { field: 'source_db',          label: 'Source database',    type: 'string',  desc: 'Database where record was found',       enabled: true, extractFrom: null },
];

export let customFields = [];

export function getActiveSchema() {
  return [...LIVE_SCHEMA, ...customFields].filter(f => f.enabled);
}
export function getKeywords(extractFrom) {
  const f = [...LIVE_SCHEMA, ...customFields].find(s => s.extractFrom === extractFrom);
  return f ? (f.keywords || []) : [];
}

// ── Schema Editor ───────────────────────────────────────────────
export function renderSchemaEditor() {
  const tbody = document.getElementById('schema-editor-tbody');
  if (!tbody) return;
  const all = [...LIVE_SCHEMA, ...customFields];
  tbody.innerHTML = all.map((f, i) => {
    const isCustom = i >= LIVE_SCHEMA.length;
    const kwCount = f.keywords ? f.keywords.length : 0;
    return `<tr class="${f.enabled ? '' : 'schema-row-disabled'}">
      <td><label class="schema-toggle"><input type="checkbox" ${f.enabled ? 'checked' : ''} onchange="SWDSchema.toggle('${f.field}',this.checked)"></label></td>
      <td><code class="field-name" style="font-size:11px">${f.field}</code></td>
      <td><input type="text" value="${esc(f.label || f.field)}" class="schema-label-input" onchange="SWDSchema.rename('${f.field}',this.value)" placeholder="Column label" /></td>
      <td style="font-size:11px;color:var(--ink-3)">${f.type}</td>
      <td>${f.extractFrom ? `<button class="btn btn-sm btn-ghost schema-kw-btn" onclick="SWDSchema.editKeywords('${f.field}')">${kwCount} keywords</button>` : '<span style="font-size:11px;color:var(--ink-3)">—</span>'}</td>
      <td>${isCustom ? `<button class="btn btn-sm btn-ghost" onclick="SWDSchema.removeCustom('${f.field}')" style="color:var(--red)">Remove</button>` : '<span style="font-size:11px;color:var(--ink-3)">core</span>'}</td>
    </tr>`;
  }).join('');
}

export function renderSchemaPreview() {
  const tbody = document.getElementById('schema-tbody');
  if (!tbody) return;
  tbody.innerHTML = getActiveSchema().map(s =>
    `<tr><td class="field-name">${s.field}</td><td class="field-type">${s.type}</td><td style="font-size:12.5px;color:var(--ink-2)">${s.label || s.field} — ${s.desc || ''}</td></tr>`
  ).join('');
}

export const SWDSchema = {
  toggle(field, enabled) {
    const f = [...LIVE_SCHEMA, ...customFields].find(s => s.field === field);
    if (f) { f.enabled = enabled; renderSchemaEditor(); renderSchemaPreview(); }
  },
  rename(field, label) {
    const f = [...LIVE_SCHEMA, ...customFields].find(s => s.field === field);
    if (f) { f.label = label; renderSchemaPreview(); }
  },
  editKeywords(field) {
    const f = [...LIVE_SCHEMA, ...customFields].find(s => s.field === field);
    if (!f) return;
    document.getElementById('kw-modal-title').textContent = `Keywords for "${f.label || f.field}"`;
    document.getElementById('kw-modal-ta').value = (f.keywords || []).join('\n');
    document.getElementById('kw-modal').style.display = 'flex';
    document.getElementById('kw-modal-save').onclick = () => {
      f.keywords = document.getElementById('kw-modal-ta').value.split('\n').map(s => s.trim()).filter(Boolean);
      document.getElementById('kw-modal').style.display = 'none';
      renderSchemaEditor();
    };
  },
  addCustomField() {
    const name = (document.getElementById('new-field-name').value || '').trim().replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    const label = (document.getElementById('new-field-label').value || '').trim() || name;
    const kws = document.getElementById('new-field-kw').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!name) { alert('Field name required.'); return; }
    if ([...LIVE_SCHEMA, ...customFields].find(f => f.field === name)) { alert('Name already exists.'); return; }
    customFields.push({ field: name, label, type: 'string', desc: 'Custom field', enabled: true, extractFrom: 'custom', keywords: kws });
    document.getElementById('new-field-name').value = '';
    document.getElementById('new-field-label').value = '';
    document.getElementById('new-field-kw').value = '';
    renderSchemaEditor(); renderSchemaPreview();
  },
  removeCustom(field) {
    customFields = customFields.filter(f => f.field !== field);
    renderSchemaEditor(); renderSchemaPreview();
  },
  loadJSON() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const loaded = JSON.parse(ev.target.result);
          if (!Array.isArray(loaded)) { alert('Invalid schema file.'); return; }
          loaded.forEach(lf => {
            const target = LIVE_SCHEMA.find(s => s.field === lf.field);
            if (target) {
              if (lf.label != null) target.label = lf.label;
              if (typeof lf.enabled === 'boolean') target.enabled = lf.enabled;
              if (lf.keywords) target.keywords = lf.keywords;
            } else if (lf.field && !customFields.find(c => c.field === lf.field)) {
              customFields.push({ field: lf.field, label: lf.label || lf.field, type: lf.type || 'string', desc: lf.desc || '', enabled: lf.enabled !== false, extractFrom: 'custom', keywords: lf.keywords || [] });
            }
          });
          renderSchemaEditor(); renderSchemaPreview();
          alert('Schema loaded.');
        } catch (err) { alert('Could not parse schema: ' + err.message); }
      };
      reader.readAsText(file);
    };
    inp.click();
  },
};
