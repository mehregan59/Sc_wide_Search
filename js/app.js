/* js/app.js — Orchestrator, UI state, rendering */

(() => {

  window._SWDRecords = [];

  let isRunning = false, abortCtrl = null, midTerms = [], currentCat = 'all';
  let stats = { queries:0, raw:0, dedup:0, records:0, noloc:0, errors:0 };
  const catCounts = { A:0, B:0, C:0, D:0, E:0, F:0 };

  // ── Tab nav ─────────────────────────────────────────────────
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── Config ──────────────────────────────────────────────────
  document.getElementById('btn-start-from-config').addEventListener('click', () => { switchTab('run'); startSearch(); });
  document.getElementById('btn-reset-config').addEventListener('click', SWDConfig.resetDefaults);

  // ── Run controls ────────────────────────────────────────────
  document.getElementById('btn-run').addEventListener('click', startSearch);
  document.getElementById('btn-stop').addEventListener('click', () => { if(abortCtrl) abortCtrl.abort(); });

  // ── Mid-run ─────────────────────────────────────────────────
  document.getElementById('btn-add-term').addEventListener('click', addMidTerm);
  document.getElementById('mid-term').addEventListener('keydown', e => { if(e.key==='Enter') addMidTerm(); });
  document.getElementById('btn-apply-yr').addEventListener('click', () => {
    const f=document.getElementById('mid-yr-from').value, t=document.getElementById('mid-yr-to').value;
    if(f) document.getElementById('cfg-yr-from').value=f;
    if(t) document.getElementById('cfg-yr-to').value=t;
    logMsg(`Year range updated to ${f||'—'}–${t||'—'}`,'warn');
  });
  document.getElementById('btn-add-db').addEventListener('click', () => {
    const db=document.getElementById('mid-db-select').value; if(!db) return;
    logMsg(`Database queued: ${SWDConfig.DB_LABELS[db]||db}`,'ok');
    const el=document.querySelector(`input[value="${db}"]`); if(el){el.checked=true;}
  });

  // ── Results filters ─────────────────────────────────────────
  document.getElementById('res-search').addEventListener('input', renderTable);
  document.getElementById('res-verif').addEventListener('change', renderTable);
  document.getElementById('res-sort').addEventListener('change', renderTable);
  document.querySelectorAll('.cat-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      renderTable();
    });
  });

  // ── Schema table ────────────────────────────────────────────
  document.getElementById('schema-tbody').innerHTML = SWDConfig.SCHEMA.map(s =>
    `<tr><td class="field-name">${s.field}</td><td class="field-type">${s.type}</td><td style="font-size:12.5px;color:var(--ink-2)">${s.desc}</td></tr>`
  ).join('');

  // ── Missing sources ─────────────────────────────────────────
  document.getElementById('missing-list').innerHTML = SWDConfig.MISSING_SOURCES
    .map(s=>`<div class="missing-item">${s}</div>`).join('');

  // ── Search loop ─────────────────────────────────────────────
  async function startSearch() {
    if (isRunning) return;
    isRunning = true;
    abortCtrl = new AbortController();
    window._SWDRecords = [];
    SWDExtractor.resetSeen();
    stats = { queries:0, raw:0, dedup:0, records:0, noloc:0, errors:0 };
    Object.keys(catCounts).forEach(k=>catCounts[k]=0);

    document.getElementById('log-box').innerHTML = '';
    setProgress(0,'Initialising…');
    setStatus('running','Running');
    document.getElementById('btn-run').disabled = true;
    document.getElementById('btn-stop').disabled = false;

    const s = SWDConfig.getSettings();
    const allTerms = [...s.speciesTerms,...s.commonTerms,...s.extraTerms,...midTerms].filter(Boolean);
    const signal = abortCtrl.signal;
    const total = s.databases.length * allTerms.length;
    let done = 0;

    logMsg(`Search started — ${s.databases.length} databases · ${allTerms.length} terms`);
    logMsg(`Year range: ${s.yearFrom}–${s.yearTo} · max ${s.maxPerQuery}/query`);

    for (const db of s.databases) {
      if (signal.aborted) break;
      for (const term of allTerms) {
        if (signal.aborted) break;
        const label = SWDConfig.DB_LABELS[db]||db;
        logMsg(`Querying ${label} for "${term.slice(0,50)}${term.length>50?'…':''}"`);
        stats.queries++; updateStats();

        try {
          const hits = await SWDEngines.query(db, term, s, signal);
          stats.raw += hits.length;
          let newCount = 0;
          for (const hit of hits) {
            for (const rec of SWDExtractor.processHit(hit, s)) {
              if (SWDExtractor.isDuplicate(rec)) continue;
              window._SWDRecords.push(rec);
              newCount++; stats.dedup++;
              if (rec.category==='E') stats.noloc++;
              else { stats.records++; catCounts[rec.category]=(catCounts[rec.category]||0)+1; }
            }
          }
          if (hits.length===0) logMsg(`  → 0 results`,'warn');
          else logMsg(`  → ${hits.length} hits · ${newCount} new · ${hits.length-newCount} dupes`,'ok');
        } catch(err) {
          if (err.name==='AbortError') break;
          stats.errors++;
          logMsg(`  ⚠ Error on ${label}: ${err.message}`,'err');
        }

        updateStats();
        done++;
        setProgress((done/total)*100, `${SWDConfig.DB_LABELS[db]||db} · "${term.slice(0,30)}"`);
      }
    }

    const stopped = signal.aborted;
    setProgress(stopped?null:100, stopped?'Stopped':'Complete');
    setStatus(stopped?'stopped':'done', stopped?'Stopped':'Done');
    logMsg(stopped
      ? `Stopped. ${window._SWDRecords.length} records collected.`
      : `Complete. ${window._SWDRecords.length} records · ${stats.errors} errors.`,
      stopped?'warn':'ok');

    isRunning = false;
    document.getElementById('btn-run').disabled = false;
    document.getElementById('btn-stop').disabled = true;

    const badge = document.getElementById('badge-results');
    badge.textContent = window._SWDRecords.length;
    badge.hidden = window._SWDRecords.length === 0;

    renderTable();
    if (!stopped) switchTab('results');
  }

  function addMidTerm() {
    const input = document.getElementById('mid-term');
    const t = input.value.trim(); if (!t) return;
    midTerms.push(t); input.value='';
    const chip = document.createElement('label');
    chip.className='chip'; chip.style.cursor='pointer';
    chip.innerHTML=`${esc(t)} <span style="opacity:.5;margin-left:4px">×</span>`;
    chip.addEventListener('click', ()=>{ midTerms=midTerms.filter(x=>x!==t); chip.remove(); });
    document.getElementById('mid-term-list').appendChild(chip);
    logMsg(`Added term: "${t}"`);
  }

  function renderTable() {
    const q    = (document.getElementById('res-search').value||'').toLowerCase();
    const v    = document.getElementById('res-verif').value;
    const sort = document.getElementById('res-sort').value;

    let data = (window._SWDRecords||[]).filter(r => {
      if (currentCat!=='all' && r.category!==currentCat) return false;
      if (v && r.verification_status!==v) return false;
      if (q) {
        const h=[r.country,r.region,r.locality,r.host_plant,r.full_citation,r.language,r.source_type,r.source_db,r.evidence_type,r.notes].join(' ').toLowerCase();
        if (!h.includes(q)) return false;
      }
      return true;
    });

    if (sort==='year_desc') data.sort((a,b)=>(b.pub_year||0)-(a.pub_year||0));
    if (sort==='year_asc')  data.sort((a,b)=>(a.pub_year||0)-(b.pub_year||0));
    if (sort==='country_asc') data.sort((a,b)=>(a.country||'').localeCompare(b.country||''));
    if (sort==='verif') data.sort((a,b)=>(a.verification_status||'').localeCompare(b.verification_status||''));

    const tbody = document.getElementById('results-tbody');
    if (!data.length) {
      tbody.innerHTML=`<tr class="empty-row"><td colspan="11">${window._SWDRecords.length===0?'Run a search to see results.':'No records match the current filter.'}</td></tr>`;
      document.getElementById('table-footer').textContent=''; return;
    }

    const MAX=500;
    tbody.innerHTML=data.slice(0,MAX).map(r => {
      const vc = SWDConfig.VERIF_CLASS[r.verification_status]||'verif-secondary';
      const doiCell = r.doi&&r.doi!=='not reported'
        ? `<a class="doi-link" href="https://doi.org/${r.doi}" target="_blank" rel="noopener">DOI →</a>`
        : r.url&&r.url!=='not reported'
        ? `<a class="doi-link" href="${esc(r.url)}" target="_blank" rel="noopener">URL →</a>` : '—';
      const au = (r.full_citation||'').split('(')[0].trim().slice(0,40);
      return `<tr>
        <td><span class="cat-pill cat-${(r.category||'e').toLowerCase()}">${r.category||'?'}</span></td>
        <td>${r.pub_year||'—'}</td>
        <td class="truncate" title="${esc(r.full_citation)}">${esc(au)}</td>
        <td>${esc(r.country||'—')}</td>
        <td class="truncate">${esc(r.region||'—')}</td>
        <td class="truncate">${esc(r.locality||'—')}</td>
        <td>${esc(r.sampling_year||'—')}</td>
        <td class="truncate">${esc(r.host_plant||'—')}</td>
        <td style="font-size:11px;color:var(--ink-3)">${esc(r.evidence_type||'—')}</td>
        <td><span class="verif-badge ${vc}">${esc(r.verification_status||'')}</span></td>
        <td>${doiCell}</td>
      </tr>`;
    }).join('');

    document.getElementById('table-footer').textContent =
      `Showing ${Math.min(data.length,MAX)} of ${data.length} record${data.length!==1?'s':''}${data.length>MAX?` (first ${MAX} shown)`:''}`;
  }

  // ── Helpers ─────────────────────────────────────────────────
  function logMsg(msg, cls='') {
    const box=document.getElementById('log-box');
    const p=document.createElement('p');
    if(cls) p.className=`log-${cls}`;
    p.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`;
    box.appendChild(p); box.scrollTop=box.scrollHeight;
  }

  function setProgress(pct, label) {
    if(pct!==null) document.getElementById('prog-fill').style.width=Math.min(100,pct)+'%';
    document.getElementById('prog-label').textContent=label||'';
    document.getElementById('prog-pct').textContent=pct!==null?Math.round(pct)+'%':'';
  }

  function setStatus(state, text) {
    const el=document.getElementById('run-status-label');
    el.className=`run-status ${state}`; el.textContent=text;
  }

  function updateStats() {
    document.getElementById('s-queries').textContent=stats.queries;
    document.getElementById('s-raw').textContent=stats.raw;
    document.getElementById('s-dedup').textContent=stats.dedup;
    document.getElementById('s-records').textContent=stats.records;
    document.getElementById('s-noloc').textContent=stats.noloc;
    document.getElementById('s-errors').textContent=stats.errors;
    for(const k of Object.keys(catCounts)){
      const el=document.getElementById(`cat-${k.toLowerCase()}`);
      if(el) el.textContent=catCounts[k]||0;
    }
  }

  function switchTab(id) {
    document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    const btn=document.querySelector(`.nav-tab[data-tab="${id}"]`);
    if(btn) btn.classList.add('active');
    const panel=document.getElementById(`panel-${id}`);
    if(panel) panel.classList.add('active');
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
