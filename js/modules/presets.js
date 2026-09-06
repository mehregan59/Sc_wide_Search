// ═══════════════════════════════════════════════════════════════
// PRESETS.JS — save / load / apply presets
// ═══════════════════════════════════════════════════════════════
import { lines, setLines, checked, setChecked, dlFile, state } from './state.js';
import { LIVE_SCHEMA, customFields, renderSchemaEditor, renderSchemaPreview } from './schema.js';
import { SWDSlots } from './slots.js';
import { SWDReq } from './requirements.js';
import { SWDDiscipline } from './databases.js';
import { SWDScope } from './databases.js';

let _renderMissingSources;
let _renderTable;
let _logMsg;

export function connectPresetDeps(deps) {
  _renderMissingSources = deps.renderMissingSources;
  _renderTable = deps.renderTable;
  _logMsg = deps.logMsg;
}

export function serializePreset(name) {
  return {
    presetName: name || 'Untitled preset',
    version: 2,
    terms: { primary: lines('cfg-primary'), synonyms: lines('cfg-synonyms'), extra: lines('cfg-extra'), exclude: lines('cfg-exclude') },
    filters: {
      yearFrom: parseInt(document.getElementById('cfg-yr-from').value) || null,
      yearTo: parseInt(document.getElementById('cfg-yr-to').value) || null,
      maxPerQuery: parseInt(document.getElementById('cfg-max').value) || 500,
      languages: document.getElementById('cfg-langs').value,
      geoReq: 0,
      minTermRelevance: parseInt(document.getElementById('cfg-min-relevance')?.value) || 0,
    },
    // FIX (this save): the old "discipline" field read a DOM element (db-discipline-select)
    // that hasn't existed since disciplines became multi-select checkboxes — it always
    // saved/restored as 'general' regardless of what was actually checked. "disciplines"
    // (plural) now captures the real checked set via the correct API.
    disciplines: SWDDiscipline.getCheckedDisciplines(),
    databases: SWDDiscipline.getChecked(),
    scopeTerms: SWDScope.getTerms(),
    missingSources: lines('cfg-missing'),
    requirements: SWDReq.serialize(),
    slots: SWDSlots.serialize(),
    schema: {
      fields: LIVE_SCHEMA.map(f => ({ field: f.field, label: f.label, enabled: f.enabled, keywords: f.keywords })),
      customFields: customFields.map(f => ({ field: f.field, label: f.label, type: f.type, desc: f.desc, enabled: f.enabled, keywords: f.keywords })),
    },
  };
}

export function applyPreset(data) {
  if (!data || typeof data !== 'object') { alert('That file does not look like a SciWide Search preset.'); return; }
  const t = data.terms || {};
  setLines('cfg-primary', t.primary); setLines('cfg-synonyms', t.synonyms);
  setLines('cfg-extra', t.extra); setLines('cfg-exclude', t.exclude);
  const f = data.filters || {};
  if (f.yearFrom != null) document.getElementById('cfg-yr-from').value = f.yearFrom;
  if (f.yearTo != null) document.getElementById('cfg-yr-to').value = f.yearTo;
  if (f.maxPerQuery != null) document.getElementById('cfg-max').value = f.maxPerQuery;
  if (f.languages != null) document.getElementById('cfg-langs').value = f.languages;
  const minRelEl = document.getElementById('cfg-min-relevance');
  const minRel = f.minTermRelevance || 0;
  if (minRelEl) minRelEl.value = minRel;
  state.minTermRelevance = minRel;
  setLines('cfg-missing', data.missingSources);
  if (_renderMissingSources) _renderMissingSources();

  // Disciplines FIRST (rebuilds the available-databases panel and its default-on set),
  // THEN the exact saved database selection overrides those defaults. Order matters —
  // setDisciplines resets the checked set to defaults, so it must run before this.
  if (Array.isArray(data.disciplines) && data.disciplines.length) {
    SWDDiscipline.setDisciplines(data.disciplines);
  } else if (data.discipline) {
    // Backward compatibility with presets saved before this fix (singular field, single value)
    SWDDiscipline.setDisciplines([data.discipline]);
  }
  if (Array.isArray(data.databases) && data.databases.length) {
    SWDDiscipline.setCheckedDatabases(data.databases);
  }

  if (Array.isArray(data.scopeTerms)) SWDScope.restore(data.scopeTerms);
  else if (Array.isArray(data.scope)) SWDScope.restore(data.scope); // legacy field name
  if (data.requirements) SWDReq.restore(data.requirements);
  if (data.slots) SWDSlots.restore(data.slots);
  if (data.schema) {
    (data.schema.fields || []).forEach(fdef => {
      const target = LIVE_SCHEMA.find(s => s.field === fdef.field);
      if (target) { if (fdef.label != null) target.label = fdef.label; if (fdef.enabled != null) target.enabled = fdef.enabled; if (fdef.keywords) target.keywords = fdef.keywords; }
    });
    if (Array.isArray(data.schema.customFields)) {
      customFields.length = 0;
      data.schema.customFields.forEach(cf => customFields.push({ field: cf.field, label: cf.label || cf.field, type: cf.type || 'string', desc: cf.desc || 'Custom field', enabled: cf.enabled !== false, extractFrom: 'custom', keywords: cf.keywords || [] }));
    }
  }
  if (data.presetName) { const el = document.getElementById('preset-name'); if (el) el.value = data.presetName; }
  renderSchemaEditor(); renderSchemaPreview();
  if (_renderTable) _renderTable();
  if (_logMsg) _logMsg(`Preset "${data.presetName || 'Untitled'}" loaded.`, 'ok');
}

export function savePreset() {
  const name = (document.getElementById('preset-name')?.value || '').trim();
  if (!name) { alert('Give this preset a name first.'); return; }
  const safe = name.replace(/[^a-z0-9_\- ]/gi, '').trim().replace(/\s+/g, '_') || 'preset';
  dlFile(JSON.stringify(serializePreset(name), null, 2), `${safe}.json`, 'application/json');
}

export function loadPresetFile() { document.getElementById('preset-file-input').click(); }

export function handlePresetFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { try { applyPreset(JSON.parse(ev.target.result)); } catch (err) { alert('Could not read preset: ' + err.message); } };
  reader.readAsText(file);
  e.target.value = '';
}

export async function loadPresetFromUrl() {
  const url = (document.getElementById('preset-url')?.value || '').trim();
  if (!url) { alert('Enter a URL to a preset .json file.'); return; }
  try {
    const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status}`);
    applyPreset(await res.json());
  } catch (err) { alert('Could not load preset from URL (likely CORS). Download and use "Load from file" instead.\n\n' + err.message); }
}

export async function loadBundledPreset() {
  const path = document.getElementById('bundled-preset-select')?.value;
  if (!path) return;
  try {
    const res = await fetch(path); if (!res.ok) throw new Error(`HTTP ${res.status}`);
    applyPreset(await res.json());
  } catch (err) { alert('Could not load preset: ' + err.message); }
}
