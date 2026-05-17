/* ─── Pina Angemi — Main Script ────────────────────────────────── */

/* ================================================================
   GLOBALS — populated by initCatalog() after fetching YAML
================================================================ */
let SERIES = {};
let OPERE  = [];

/* ================================================================
   HELPERS
================================================================ */
function clean(s) {
  if (s == null) return null;
  // Strip surrounding double-quotes used as convention in the YAML
  return String(s).trim().replace(/^"([\s\S]*)"$/, '$1').trim();
}

const ROMAN_VALS = [[10,'X'],[9,'IX'],[8,'VIII'],[7,'VII'],[6,'VI'],[5,'V'],[4,'IV'],[3,'III'],[2,'II'],[1,'I']];
function toRoman(n) {
  let r = '';
  for (const [v, sym] of ROMAN_VALS) while (n >= v) { r += sym; n -= v; }
  return r;
}

/* ================================================================
   TRANSFORM — maps raw YAML structure to flat render-ready data
================================================================ */
function transformCatalog(data) {
  // Mostre index
  const mostreIdx = {};
  for (const m of (data.mostre || [])) mostreIdx[m.id] = m;

  // Serie map
  const seriesMap = {};
  for (const s of (data.serie || [])) {
    const mostra = s.mostra ? mostreIdx[s.mostra] : null;

    // Build display label; append mostra subtitle when available
    // e.g. "Gorilla Silverback — Lo sguardo della foresta"
    let label = s.titolo;
    if (mostra) {
      const sub = mostra.titolo.split(/\.\s+/)[1];
      if (sub) label = `${s.titolo} — ${sub}`;
    }

    seriesMap[s.id] = {
      id:          s.id,
      titolo:      s.titolo,
      label,
      descrizione: clean(s.descrizione),
      concept:     clean(s.concept),
      quadri:      s.quadri   || null,
      sculture:    s.sculture || null,
    };
  }

  // Opere list
  const opere = [];
  for (const op of (data.opere || [])) {
    const serie = op.serie ? seriesMap[op.serie] : null;

    // Titolo — derive from serie + numero when absent in YAML
    let titolo = op.titolo ? clean(op.titolo) : null;
    if (!titolo && serie && op.numero != null) {
      titolo = op.categoria === 'quadro'
        ? `${serie.titolo} #${String(op.numero).padStart(2, '0')}`
        : `${serie.titolo} — ${toRoman(op.numero)}`;
    }

    // Tecnica / materiale — fall back to serie metadata
    let tecnica   = op.tecnica || null;
    let materiale = op.materiale;
    if (Array.isArray(materiale))   materiale = materiale.join(', ');
    else if (materiale != null)     materiale = String(materiale);
    else                            materiale = null;

    if (!tecnica && !materiale && serie) {
      if (op.categoria === 'quadro'   && serie.quadri)   tecnica   = serie.quadri.tecnica    || null;
      if (op.categoria === 'scultura' && serie.sculture) materiale = serie.sculture.materiale || null;
    }

    // Descrizione — fall back to serie.sculture.descrizione for series sculptures
    let descrizione = op.descrizione ? clean(op.descrizione) : null;
    if (!descrizione && serie && op.categoria === 'scultura' && serie.sculture)
      descrizione = clean(serie.sculture.descrizione);

    // Dimensioni — YAML may be a string or {scultura, base} object
    let dimensioni = null;
    if (op.dimensioni)
      dimensioni = typeof op.dimensioni === 'object'
        ? (op.dimensioni.scultura || null)
        : String(op.dimensioni);

    opere.push({
      id:          op.id,
      serie:       op.serie || null,
      categoria:   op.categoria,
      numero:      op.numero ?? null,
      titolo:      titolo || op.id,
      tecnica:     tecnica   || null,
      materiale:   materiale || null,
      anno:        op.anno   ?? null,
      dimensioni,
      descrizione: descrizione || null,
      ispirazione: op.ispirazione || null,
      riferimenti: op.riferimenti_filosofici
        ? op.riferimenti_filosofici.join(' · ')
        : null,
      certificato: op.certificato_autenticita || false,
      immagine:    op.immagine,
    });
  }

  return { seriesMap, opere };
}

/* ================================================================
   GALLERY
================================================================ */
const galleryRoot = document.getElementById('galleryRoot');
let visible = [];
let lbIdx   = 0;

const groupKey   = op => op.serie || (op.categoria === 'quadro' ? '__q' : '__s');
const groupLabel = op =>
  (op.serie && SERIES[op.serie])
    ? SERIES[op.serie].label
    : (op.categoria === 'quadro' ? 'Opere Singole — Quadri' : 'Sculture Singole');

function renderGallery(filter) {
  visible = filter === 'all' ? [...OPERE] : OPERE.filter(o => o.categoria === filter);
  galleryRoot.innerHTML = '';

  const groups = [];
  const map    = new Map();
  for (const op of visible) {
    const k = groupKey(op);
    if (!map.has(k)) { map.set(k, []); groups.push(k); }
    map.get(k).push(op);
  }

  for (const k of groups) {
    const ops = map.get(k);

    const hd = document.createElement('div');
    hd.className = 'series-hd';
    hd.innerHTML = `<span>${groupLabel(ops[0])}</span><span class="series-count">${ops.length} ${ops.length === 1 ? 'opera' : 'opere'}</span>`;
    galleryRoot.appendChild(hd);

    const grid = document.createElement('div');
    grid.className = 'art-grid';

    for (const op of ops) {
      const idx  = visible.indexOf(op);
      const card = document.createElement('div');
      card.className = 'art-card' + (op.categoria === 'scultura' ? ' tall' : '');
      card.innerHTML = `
        <img src="${op.immagine}" alt="${op.titolo}" loading="lazy" decoding="async">
        <div class="art-overlay">
          <div class="art-title">${op.titolo}</div>
          <div class="art-sub">${op.tecnica || op.materiale || op.categoria}</div>
        </div>
        <div class="art-expand">
          <svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </div>`;
      card.addEventListener('click', () => openLb(idx));
      grid.appendChild(card);
    }
    galleryRoot.appendChild(grid);
  }
}

/* ================================================================
   LIGHTBOX
================================================================ */
const lb    = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');

function openLb(idx) {
  lbIdx = idx;
  updateLb();
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLb() {
  lb.classList.remove('open');
  document.body.style.overflow = '';
}
function updateLb() {
  const op = visible[lbIdx];
  lbImg.src = op.immagine;
  lbImg.alt = op.titolo;

  document.getElementById('lbSerie').textContent =
    (op.serie && SERIES[op.serie]) ? SERIES[op.serie].label.toUpperCase() : op.categoria.toUpperCase();
  document.getElementById('lbTitle').textContent = op.titolo;

  const desc   = op.descrizione || (op.serie && SERIES[op.serie]?.descrizione) || '';
  const lbDesc = document.getElementById('lbDesc');
  lbDesc.textContent   = desc;
  lbDesc.style.display = desc ? '' : 'none';

  const tech = document.getElementById('lbTech');
  tech.innerHTML = '';
  const rows = [
    ['Tecnica',     op.tecnica],
    ['Materiale',   op.materiale],
    ['Anno',        op.anno],
    ['Dimensioni',  op.dimensioni],
    ['Ispirazione', op.ispirazione],
    ['Riferimenti', op.riferimenti],
    ['Certificato', op.certificato ? 'Certificato di Autenticità' : null],
  ];
  for (const [k, v] of rows) {
    if (!v) continue;
    tech.innerHTML += `<dt>${k}</dt><dd>${v}</dd>`;
  }
  document.getElementById('lbCounter').textContent = `${lbIdx + 1} / ${visible.length}`;
}

document.getElementById('lbClose').addEventListener('click', closeLb);
document.getElementById('lbPrev').addEventListener('click', () => { lbIdx = (lbIdx - 1 + visible.length) % visible.length; updateLb(); });
document.getElementById('lbNext').addEventListener('click', () => { lbIdx = (lbIdx + 1) % visible.length; updateLb(); });
lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
document.addEventListener('keydown', e => {
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape')     closeLb();
  if (e.key === 'ArrowLeft')  { lbIdx = (lbIdx - 1 + visible.length) % visible.length; updateLb(); }
  if (e.key === 'ArrowRight') { lbIdx = (lbIdx + 1) % visible.length; updateLb(); }
});

let touchX = 0;
lb.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend',   e => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) < 40) return;
  dx < 0
    ? (lbIdx = (lbIdx + 1) % visible.length,                   updateLb())
    : (lbIdx = (lbIdx - 1 + visible.length) % visible.length,  updateLb());
}, { passive: true });

/* ================================================================
   FILTERS
================================================================ */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderGallery(btn.dataset.f);
  });
});

/* ================================================================
   NAV
================================================================ */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 50), { passive: true });
document.getElementById('burger').addEventListener('click',     () => document.getElementById('mobileMenu').classList.add('open'));
document.getElementById('mobileClose').addEventListener('click', () => document.getElementById('mobileMenu').classList.remove('open'));
document.querySelectorAll('#mobileMenu a').forEach(a =>
  a.addEventListener('click', () => document.getElementById('mobileMenu').classList.remove('open')));

/* ================================================================
   FADE-IN OBSERVER
================================================================ */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } });
}, { threshold: 0.08 });
document.querySelectorAll('.fi').forEach(el => io.observe(el));

/* ================================================================
   INIT — fetch catalogo.yaml, parse with js-yaml, render
================================================================ */
async function initCatalog() {
  try {
    const res  = await fetch('catalogo.yaml');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = jsyaml.load(text);
    const { seriesMap, opere } = transformCatalog(data);
    SERIES = seriesMap;
    OPERE  = opere;
    renderGallery('all');
  } catch (err) {
    console.error('[catalogo] caricamento fallito:', err);
    galleryRoot.innerHTML =
      `<p style="color:var(--fg-muted);padding:3rem 0;font-size:0.88rem">
        Impossibile caricare il catalogo.<br>
        <small style="opacity:.6">Il sito deve essere servito da un server HTTP (non tramite file://).</small>
      </p>`;
  }
}

initCatalog();
