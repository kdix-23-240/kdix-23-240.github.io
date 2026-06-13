// ============================================================
// AKIHIDE MIKAMI — PORTFOLIO 2026 v3
// Data-driven projects & awards — edit data/content.js to extend
// ============================================================
const { stats, projects, awards } = window.PORTFOLIO_DATA ?? { stats: {}, projects: [], awards: [] };

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
};

let activeIndex = 0;
let rotationIndex = 0;
let dragOffset = 0;
let wheelAccum = 0;
let isDragging = false;
let dragStartX = 0;
let layoutRaf = 0;
let wheelCooldown = false;
let pointerOnViewport = false;
let focusedModalPanel = null;

const DRAG_PX_PER_SLOT = 130;
const WHEEL_THRESHOLD = 40;
const MAX_DRAG_OFFSET = 2.5;
const CARD_W = 340;
const CARD_H = 486;

const DEFAULT_THEME = {
  primary: '#EE4429',
  secondary: '#ff8a93',
  wash: 'rgba(238, 68, 41, 0.06)',
  glow: 'rgba(238, 68, 41, 0.2)',
  bg: '#F4F1EA',
};

function hexAlpha(hex, alpha) {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

function gameplayImgPath(p) {
  if (!p.titleImage) return null;
  return p.titleImage.replace(/_title\./, '_gameplay.');
}

function serviceLinkKind(url, deploy = false) {
  if (!url) return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('notion.site') || url.includes('notion.so')) return 'notion';
  if (url.includes('qiita.com')) return 'qiita';
  if (url.includes('github.com')) return 'github';
  if (url.includes('topaz.dev')) return 'topaz';
  if (deploy || url.includes('unityroom.com') || url.includes('itch.io')) return 'deploy';
  return null;
}

function isServiceLink(l) {
  return serviceLinkKind(l.url, l.deploy) !== null;
}

const SERVICE_BTN_ICONS = {
  youtube: '▶',
  notion: '◈',
  qiita: 'Q',
  github: '⎇',
  topaz: '◇',
  deploy: '↗',
};

function serviceBtnTip(l) {
  const kind = serviceLinkKind(l.url, l.deploy);
  const tips = {
    youtube: 'YouTubeで動画を見る',
    notion: 'Notionで詳細を見る',
    qiita: 'Qiitaの記事を読む',
    github: 'GitHubリポジトリを見る',
    topaz: 'Topa\'zの説明ページ',
    deploy: l.url.includes('unityroom') ? 'unityroomでプレイ' : '外部サイトで体験する',
  };
  return tips[kind] ?? l.label;
}

function serviceBtnHTML(l) {
  const kind = serviceLinkKind(l.url, l.deploy);
  if (!kind) return '';
  const tip = serviceBtnTip(l);
  return `<a class="card-service-btn card-service-btn--${kind}"
             href="${esc(l.url)}" target="_blank" rel="noopener"
             data-service-tip="${esc(tip)}"
             aria-describedby="service-tip-portal"
             aria-label="${esc(tip)}">${SERVICE_BTN_ICONS[kind]}</a>`;
}

function serviceLinkHTML(l, isPrimary) {
  const kind = serviceLinkKind(l.url, l.deploy);
  if (kind) {
    return `<a class="card-service-link card-service-link--${kind}" href="${esc(l.url)}" target="_blank" rel="noopener">
      <span class="card-service-icon">${SERVICE_BTN_ICONS[kind]}</span>
      <span class="card-service-label">${esc(l.label)}</span>
    </a>`;
  }
  return `<a class="card-link${isPrimary ? ' card-link--primary' : ''}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`;
}

// ── Render helpers ──────────────────────────────────────────

function renderStats() {
  const ul = $('#status-rows');
  if (!ul) return;
  ul.innerHTML = Object.values(stats).map((s) => `
    <li>
      <span class="k">${esc(s.label)}</span>
      <span class="v">${s.value}<small>${esc(s.suffix)}</small></span>
    </li>
  `).join('');
}

function projectThemeVars(p) {
  const t = p.theme;
  const primary = t.primary;
  return {
    primary,
    shadow: hexAlpha(primary, 0.12),
    wash: hexAlpha(primary, 0.16),
    border: hexAlpha(primary, 0.28),
    flipBg: hexAlpha(primary, 0.08),
    screenBg: `repeating-linear-gradient(135deg, ${hexAlpha(primary, 0.1)}, ${hexAlpha(primary, 0.1)} 11px, transparent 11px, transparent 22px), ${hexAlpha(primary, 0.05)}`,
    backBg: `linear-gradient(160deg, #ffffff 0%, ${hexAlpha(primary, 0.05)} 100%)`,
  };
}

function cardFrontHTML(p) {
  const m = p.modal;
  const tagline = m?.tagline ?? p.desc;
  const awards = p.awards.map((a) => `<span class="award-chip award-chip--front">${esc(a)}</span>`).join('');
  const tags = p.tech.map((t) => `<span class="tech-tag tech-tag--front">${esc(t)}</span>`).join('');

  const serviceBtns = (m?.links ?? []).filter(isServiceLink).map(serviceBtnHTML).join('');

  return `
    <span class="card-kana">${esc(p.fallback)}</span>
    <h3 class="card-title">${esc(p.title)}</h3>
    <p class="card-tagline card-tagline--front">${esc(tagline)}</p>
    ${awards ? `<div class="card-front-awards">${awards}</div>` : ''}
    <div class="card-front-bottom">
      <div class="tech-tags card-front-tech">${tags}</div>
      ${serviceBtns ? `<div class="card-front-service">${serviceBtns}</div>` : ''}
    </div>
  `;
}

function serviceButtonsHTML(p) {
  const btns = (p.modal?.links ?? []).filter(isServiceLink).map(serviceBtnHTML).join('');
  return btns ? `<div class="card-service-btns">${btns}</div>` : '';
}

function cardFlipBarHTML(p, face, { modal = false } = {}) {
  const hasSvcBtns = (p.modal?.links ?? []).some(isServiceLink);
  const toBackLabel = modal ? '裏面へ' : '詳しく ↻';
  const toFrontLabel = modal ? '表面へ' : '↺ 戻る';

  if (face === 'front') {
    const primaryLink = !hasSvcBtns && p.modal?.links?.find((l) => l.primary);
    return `
      <div class="card-flip-bar">
        ${primaryLink ? `
          <a class="card-front-link" href="${esc(primaryLink.url)}" target="_blank" rel="noopener">${esc(primaryLink.label)}</a>
        ` : '<span class="card-flip-bar-gap"></span>'}
        <button type="button" class="card-flip-btn" data-flip="to-back">${toBackLabel}</button>
      </div>
    `;
  }
  const links = (p.modal?.links ?? []).filter((l) => !isServiceLink(l)).map((l, i) => `
    <a class="card-link${i === 0 ? ' card-link--primary' : ''}"
       href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>
  `).join('');
  return `
    <div class="card-flip-bar card-flip-bar--back">
      ${links ? `<div class="card-links">${links}</div>` : '<span class="card-flip-bar-gap"></span>'}
      <button type="button" class="card-flip-btn" data-flip="to-front">${toFrontLabel}</button>
    </div>
  `;
}

function cardBackHTML(p) {
  const m = p.modal;
  const sections = (m?.sections ?? []).map((s, i) => `
    <div class="card-back-section">
      <span class="quest-no" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <h4>${esc(s.title)}</h4>
      <p>${esc(s.body)}</p>
    </div>
  `).join('');

  const svcBtns = serviceButtonsHTML(p);

  return `
    <div class="card-back-top">
      <p class="card-back-label">DETAIL LOG</p>
      <h3 class="card-title">${esc(p.title)}</h3>
      <dl class="card-facts card-facts--grid">
        <div><dt>ROLE</dt><dd>${esc(m?.facts?.role ?? '—')}</dd></div>
        <div><dt>TEAM</dt><dd>${esc(m?.facts?.team ?? '—')}</dd></div>
        <div><dt>PERIOD</dt><dd>${esc(m?.facts?.period ?? '—')}</dd></div>
      </dl>
    </div>
    <div class="card-back-sections">
      ${sections}
      ${svcBtns ? `<div class="card-back-actions">${svcBtns}</div>` : ''}
    </div>
  `;
}

function applyDefaultTheme() {
  const t = DEFAULT_THEME;
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', t.primary);
  root.style.setProperty('--theme-secondary', t.secondary);
  root.style.setProperty('--theme-wash', t.wash);
  root.style.setProperty('--theme-glow', t.glow);
  root.style.setProperty('--theme-bg', t.bg);
  delete document.body.dataset.activeProject;
  updateStageTheme(null);
}

function applyProjectTheme(p) {
  if (!p?.theme) return;
  const t = p.theme;
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', t.primary);
  root.style.setProperty('--theme-secondary', t.secondary);
  root.style.setProperty('--theme-wash', t.wash);
  root.style.setProperty('--theme-glow', t.glow ?? t.wash);
  root.style.setProperty('--theme-bg', t.bg);
  document.body.dataset.activeProject = p.id;
  updateStageTheme(p);
}

function projectPanelHTML(p, i, { modal = false } = {}) {
  const t = p.theme;
  const tv = projectThemeVars(p);
  const num = String(i + 1).padStart(2, '0');
  const screenImg = p.titleImage
    ? `<img class="card-screen-img" src="${esc(p.titleImage)}" alt="${esc(p.title)}のタイトル画面" loading="${modal ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${modal ? 'high' : 'auto'}" onerror="this.remove()">`
    : '';
  const screenPlaceholder = p.titleImage ? '' : `<div class="card-screen-placeholder">
        <span class="ts-grid" aria-hidden="true"></span>
        <span class="ts-glow" aria-hidden="true"></span>
        <span class="ts-corner ts-corner--tl" aria-hidden="true"></span>
        <span class="ts-corner ts-corner--tr" aria-hidden="true"></span>
        <span class="ts-corner ts-corner--bl" aria-hidden="true"></span>
        <span class="ts-corner ts-corner--br" aria-hidden="true"></span>
        <span class="card-screen-label">▶ TITLE SCREEN</span>
        <span class="card-screen-kana">${esc(p.fallback)}</span>
        <span class="ts-press" aria-hidden="true">PRESS START</span>
      </div>`;
  const panelClass = modal ? 'modal-panel' : 'carousel-panel';
  const bodyClass = modal ? 'card-body card-body--memo card-body--modal' : 'card-body card-body--memo';

  return `
    <div class="${panelClass}" role="${modal ? 'dialog' : 'tabpanel'}"
         data-project="${esc(p.id)}" data-index="${i}"
         aria-hidden="true"
         style="--stage-primary:${t.primary};--stage-secondary:${t.secondary};--stage-wash:${t.wash};--stage-bg:${t.bg};--card-shadow:${tv.shadow};--card-border:${tv.border};--card-flip-bg:${tv.flipBg};--card-back-bg:${tv.backBg}">
      <article class="showcase-card">
        <div class="card-flipper">
          <div class="card-face card-face--front">
            <div class="${bodyClass}">
              <div class="card-screen" style="background:${tv.screenBg}">
                <div class="card-index card-index--screen" aria-hidden="true">
                  <span class="card-index-num">${num}</span>
                </div>
                ${screenPlaceholder}${screenImg}
                <div class="card-screen-wash" style="background:linear-gradient(180deg,transparent 40%,${tv.wash} 100%)"></div>
              </div>
              <div class="card-front-info">${cardFrontHTML(p)}</div>
              ${cardFlipBarHTML(p, 'front', { modal })}
            </div>
          </div>
          <div class="card-face card-face--back">
            <div class="card-body card-body--memo card-body--back">
              <div class="card-back-content" data-back-content></div>
              ${cardFlipBarHTML(p, 'back', { modal })}
            </div>
          </div>
        </div>
      </article>
    </div>
  `;
}

function jumpBtnHTML(p, i) {
  const t = p.theme;
  return `
    <button class="jump-btn" type="button" role="tab"
            data-index="${i}" aria-selected="false"
            style="--jump-primary:${t.primary}">
      <span class="jump-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="jump-label">${esc(p.title)}</span>
    </button>
  `;
}

function gridTileTagsHTML(p) {
  const genre = p.genre;
  const highlights = p.highlights ?? [];
  if (!genre && !highlights.length) return '';

  const genreTag = genre ? `<span class="gt-tag gt-tag--genre">${esc(genre)}</span>` : '';
  const highlightTags = highlights.map((h) => `<span class="gt-tag gt-tag--highlight">${esc(h)}</span>`).join('');

  return `<span class="gt-tags" aria-label="ジャンル・タグ">${genreTag}${highlightTags}</span>`;
}

function gridTileHTML(p, i) {
  const t = p.theme;
  const tv = projectThemeVars(p);
  const num = String(i + 1).padStart(2, '0');
  const weight = p.weight || 'md';
  const screen = p.titleImage
    ? `<img class="gt-img" src="${esc(p.titleImage)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
    : `<span class="gt-ph"><span class="gt-ph-kana">${esc(p.fallback)}</span><span class="gt-ph-tag">TITLE</span></span>`;
  const topAward = p.awards && p.awards.length
    ? `<span class="gt-award">★ ${esc(p.awards[0])}</span>`
    : '';
  const tagline = weight === 'lg' ? `<span class="gt-tagline">${esc(p.modal?.tagline ?? p.desc)}</span>` : '';
  return `
    <button type="button" class="grid-tile grid-tile--${weight}"
            data-project="${esc(p.id)}" data-index="${i}"
            aria-label="${esc(p.title)} の詳細を見る"
            style="--stage-primary:${t.primary};--stage-secondary:${t.secondary};--stage-wash:${t.wash};--stage-bg:${t.bg}">
      <span class="gt-screen" style="background:${tv.screenBg}">
        ${screen}
        <span class="gt-wash" aria-hidden="true"></span>
      </span>
      <span class="gt-num">${num}</span>
      ${gridTileTagsHTML(p)}
      <span class="gt-info">
        <span class="gt-kana">${esc(p.fallback)}</span>
        <span class="gt-title">${esc(p.title)}</span>
        ${tagline}
        ${topAward}
      </span>
      <span class="gt-cta" aria-hidden="true">VIEW →</span>
    </button>
  `;
}

function wrapSlot(slot) {
  const n = projects.length;
  if (!n) return slot;
  let s = slot;
  const limit = Math.max(n, 8);
  let guard = 0;
  while (s > n / 2 && guard++ < limit) s -= n;
  guard = 0;
  while (s < -n / 2 && guard++ < limit) s += n;
  return s;
}

function slotOffset(i) {
  return wrapSlot(i - rotationIndex - dragOffset);
}

function updateStageTheme(p) {
  const stage = $('#projects-stage');
  if (!stage) return;
  const t = p?.theme ?? DEFAULT_THEME;
  stage.style.setProperty('--stage-primary', t.primary);
  stage.style.setProperty('--stage-secondary', t.secondary);
  stage.style.setProperty('--stage-wash', t.wash);
  stage.style.setProperty('--stage-bg', t.bg);
  if (p) stage.dataset.active = p.id;
  else delete stage.dataset.active;
}

function layoutCarousel() {
  const panels = $('#carousel-track')?.querySelectorAll('.carousel-panel');
  if (!panels?.length) return;

  panels.forEach((panel, i) => {
    const off = slotOffset(i);
    const a = Math.abs(off);

    if (a > 2.7) {
      panel.style.display = 'none';
      panel.style.pointerEvents = 'none';
      panel.classList.remove('is-active');
      panel.setAttribute('aria-hidden', 'true');
      return;
    }

    const tx = off * 224;
    const tz = -a * 130;
    const ry = -off * 33;
    const sc = Math.max(0.74, 1 - a * 0.075);
    const op = a > 2.3 ? 0 : (a < 0.5 ? 1 : Math.max(0.42, 0.95 - (a - 0.5) * 0.32));

    panel.style.display = 'block';
    panel.style.transform =
      `translate3d(${tx.toFixed(1)}px, 0, ${tz.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
    panel.style.opacity = String(op);
    panel.style.zIndex = String(Math.round(50 - a * 10));
    panel.style.pointerEvents = a < 1.2 ? 'auto' : 'none';
    panel.classList.toggle('is-active', a < 0.5);
    panel.setAttribute('aria-hidden', a < 0.5 ? 'false' : 'true');
  });
}

function scheduleLayout() {
  if (layoutRaf) return;
  layoutRaf = requestAnimationFrame(() => {
    layoutRaf = 0;
    layoutCarousel();
  });
}

function hydrateCardBack(panel) {
  const mount = panel?.querySelector('[data-back-content]');
  if (!mount || mount.dataset.hydrated === 'true') return;
  const idx = Number(panel.dataset.index);
  const p = projects[idx];
  if (!p) return;
  mount.innerHTML = cardBackHTML(p);
  mount.dataset.hydrated = 'true';
}

function syncCarouselUI() {
  if (!document.body.classList.contains('has-grid-focus')) applyDefaultTheme();

  document.querySelectorAll('.jump-btn').forEach((btn, i) => {
    const on = i === activeIndex;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', String(on));
  });

  const counter = $('#carousel-counter');
  if (counter) {
    const n = projects.length;
    counter.textContent = `NO.${String(activeIndex + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')} ∞`;
  }

  layoutCarousel();
}

function resetFlippedPanels() {
  $('#carousel-track')?.querySelectorAll('.carousel-panel.is-flipped').forEach((panel) => {
    panel.classList.remove('is-flipped');
  });
}

function goToIndex(index, { direction = null } = {}) {
  if (!projects.length) return;

  const n = projects.length;
  const target = ((index % n) + n) % n;

  if (direction === 1 || direction === -1) {
    rotationIndex += direction;
  } else {
    const cur = ((rotationIndex % n) + n) % n;
    let diff = target - cur;
    if (diff > n / 2) diff -= n;
    if (diff < -n / 2) diff += n;
    rotationIndex += diff;
  }

  activeIndex = ((rotationIndex % n) + n) % n;
  dragOffset = 0;
  wheelAccum = 0;
  resetFlippedPanels();
  syncCarouselUI();
}

function nudgeCarousel(steps) {
  if (!steps || !projects.length) return;
  rotationIndex += steps;
  activeIndex = ((rotationIndex % projects.length) + projects.length) % projects.length;
  dragOffset = 0;
  wheelAccum = 0;
  syncCarouselUI();
}

function buildGridOrder() {
  const buckets = { lg: [], md: [], sm: [] };
  projects.forEach((p, i) => {
    const w = p.weight || 'md';
    (buckets[w] || buckets.md).push(i);
  });
  const pattern = ['lg', 'md', 'sm', 'md', 'sm'];
  const fallback = ['lg', 'md', 'sm'];
  const order = [];
  let step = 0;
  let guard = 0;
  while (order.length < projects.length && guard++ < 500) {
    const preferred = pattern[step % pattern.length];
    const pickFrom = [preferred, ...fallback.filter((w) => w !== preferred)];
    let picked = null;
    for (const w of pickFrom) {
      if (buckets[w].length) {
        picked = buckets[w].shift();
        break;
      }
    }
    if (picked === null) break;
    order.push(picked);
    step++;
  }
  fallback.forEach((w) => {
    while (buckets[w].length) order.push(buckets[w].shift());
  });
  return order;
}

function renderProjects() {
  const track = $('#carousel-track');
  const jump = $('#project-jump');
  const grid = $('#projects-grid');
  if (!track || !jump) return;

  track.innerHTML = projects.map((p, i) => projectPanelHTML(p, i)).join('');
  jump.innerHTML = projects.map((p, i) => jumpBtnHTML(p, i)).join('');
  if (grid) {
    grid.innerHTML = buildGridOrder().map((idx) => gridTileHTML(projects[idx], idx)).join('');
  }

  goToIndex(0);
}

function getModalPanel() {
  return $('#grid-focus-mount')?.querySelector('.modal-panel') ?? null;
}

let clearModalFlipTransition = null;

function resetModalFlipState() {
  clearModalFlipTransition?.();
  clearModalFlipTransition = null;
  $('#grid-focus-layer')?.classList.remove('is-flipping');
}

function beginModalFlipTransition(panel) {
  const flipper = panel?.querySelector('.card-flipper');
  const layer = $('#grid-focus-layer');
  if (!flipper || !layer) return;

  resetModalFlipState();
  panel.classList.add('is-flipping');
  layer.classList.add('is-flipping');
  flipper.style.willChange = 'transform';

  const onEnd = (e) => {
    if (e.target !== flipper || e.propertyName !== 'transform') return;
    resetModalFlipState();
    panel.classList.remove('is-flipping');
  };

  flipper.addEventListener('transitionend', onEnd, { once: true });
  clearModalFlipTransition = () => {
    flipper.removeEventListener('transitionend', onEnd);
    panel.classList.remove('is-flipping');
    layer.classList.remove('is-flipping');
    flipper.style.willChange = '';
  };
}

function setModalFlipped(panel, flipped, { defer = false } = {}) {
  if (!panel) return;

  if (flipped) hydrateCardBack(panel);

  const apply = () => {
    panel.classList.toggle('is-flipped', flipped);
    beginModalFlipTransition(panel);
  };

  if (defer) requestAnimationFrame(apply);
  else apply();
}

function closeGridFocus() {
  const layer = $('#grid-focus-layer');
  const mount = $('#grid-focus-mount');
  if (!layer || layer.hidden) return;

  resetModalFlipState();
  hideServiceTip();
  if (mount) mount.innerHTML = '';
  focusedModalPanel = null;
  if (layer) {
    layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('has-grid-focus');
  document.body.style.overflow = '';
  applyDefaultTheme();
}

function focusGridPanel(panel) {
  if (!panel) return;
  const idx = Number(panel.dataset.index);
  const p = projects[idx];
  if (!p) return;

  const mount = $('#grid-focus-mount');
  const layer = $('#grid-focus-layer');
  if (!mount || !layer) return;

  resetModalFlipState();
  mount.innerHTML = projectPanelHTML(p, idx, { modal: true });
  focusedModalPanel = mount.querySelector('.modal-panel');
  if (focusedModalPanel) {
    focusedModalPanel.setAttribute('aria-modal', 'true');
    focusedModalPanel.setAttribute('aria-label', `${p.title}の詳細`);
    focusedModalPanel.classList.remove('is-flipped');
    hydrateCardBack(focusedModalPanel);
  }

  layer.hidden = false;
  layer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-grid-focus');
  document.body.style.overflow = 'hidden';
  applyProjectTheme(p);
}

function handleModalFlip(e) {
  const flip = e.target.closest('[data-flip]');
  if (!flip) return false;

  const panel = getModalPanel();
  if (!panel) return false;

  setModalFlipped(panel, flip.dataset.flip === 'to-back');
  return true;
}

function setupViewSwitch() {
  const bar = $('#view-switch-bar');
  const flow = $('#projects-flow');
  const grid = $('#projects-grid');
  if (!bar || !flow || !grid) return;

  const btns = [...bar.querySelectorAll('.vs-btn')];
  const cnt = $('#vs-count');
  if (cnt) cnt.textContent = String(projects.length);

  const setView = (view) => {
    const isGrid = view === 'grid';
    grid.hidden = !isGrid;
    flow.hidden = isGrid;
    bar.classList.toggle('is-grid', isGrid);
    if (isGrid) closeGridFocus();
    else scheduleLayout();
    btns.forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };

  btns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
}

function setupGridFocus() {
  $('#grid-focus-backdrop')?.addEventListener('click', () => closeGridFocus());
  $('#grid-focus-mount')?.addEventListener('click', (e) => {
    if (e.target.closest('.card-front-link, .card-link, .card-service-btn')) return;
    handleModalFlip(e);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && focusedModalPanel) {
      closeGridFocus();
      e.preventDefault();
    }
  });
}

function setupProjectThemeHover() {
  const section = $('#projects');
  if (!section) return;

  const bindTheme = (el) => {
    const idx = Number(el.dataset.index ?? el.closest('[data-index]')?.dataset.index);
    const p = projects[idx];
    if (!p) return;
    el.addEventListener('pointerenter', () => applyProjectTheme(p));
  };

  const refreshBindings = () => {
    section.querySelectorAll('.carousel-panel, .grid-tile, .jump-btn').forEach(bindTheme);
  };

  refreshBindings();
  section.addEventListener('pointerleave', () => {
    if (!document.body.classList.contains('has-grid-focus')) applyDefaultTheme();
  });

  const observer = new MutationObserver(refreshBindings);
  observer.observe(section, { childList: true, subtree: true });
}

function handleCardFlip(e) {
  const flip = e.target.closest('[data-flip]');
  if (!flip) return false;

  const panel = flip.closest('.carousel-panel');
  if (!panel) return true;

  if (panel.classList.contains('is-active') && flip.dataset.flip === 'to-back') {
    focusGridPanel(panel);
    setModalFlipped(getModalPanel(), true, { defer: true });
  }
  return true;
}

function setupProjects() {
  const viewport = $('#carousel-viewport');
  const track = $('#carousel-track');
  const jump = $('#project-jump');
  if (!track) return;

  jump?.addEventListener('click', (e) => {
    const btn = e.target.closest('.jump-btn');
    if (btn) goToIndex(Number(btn.dataset.index));
  });

  $('#projects-grid')?.addEventListener('click', (e) => {
    if (e.target.closest('.card-front-link, .card-link, .card-service-btn')) return;
    const tile = e.target.closest('.grid-tile');
    if (tile) focusGridPanel(tile);
  });

  track.addEventListener('click', (e) => {
    if (e.target.closest('.card-front-link, .card-link, .card-service-btn')) return;
    if (handleCardFlip(e)) return;

    const panel = e.target.closest('.carousel-panel');
    if (panel?.classList.contains('is-active')) {
      focusGridPanel(panel);
      return;
    }

    if (panel && !panel.classList.contains('is-active')) {
      const targetIdx = Number(panel.dataset.index);
      const n = projects.length;
      let diff = targetIdx - activeIndex;
      if (diff > n / 2) diff -= n;
      if (diff < -n / 2) diff += n;
      if (diff === 1 || diff === -1) goToIndex(targetIdx, { direction: diff });
      else goToIndex(targetIdx);
    }
  });

  $('#carousel-prev')?.addEventListener('click', () => goToIndex(activeIndex - 1, { direction: -1 }));
  $('#carousel-next')?.addEventListener('click', () => goToIndex(activeIndex + 1, { direction: 1 }));

  $('#projects')?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      goToIndex(activeIndex - 1, { direction: -1 });
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      goToIndex(activeIndex + 1, { direction: 1 });
      e.preventDefault();
    }
  });

  jump?.addEventListener('keydown', (e) => {
    const current = document.activeElement?.closest('.jump-btn');
    if (!current) return;
    const all = [...jump.querySelectorAll('.jump-btn')];
    const idx = all.indexOf(current);
    let next = idx;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (idx + 1) % all.length;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (idx - 1 + all.length) % all.length;
      e.preventDefault();
    } else return;

    all[next].focus();
    goToIndex(Number(all[next].dataset.index));
  });

  const trackEl = track;

  const setDragging = (on) => {
    isDragging = on;
    trackEl?.classList.toggle('is-dragging', on);
  };

  const snapFromDrag = () => {
    const steps = Math.round(dragOffset);
    if (steps !== 0) {
      rotationIndex += steps;
    } else if (Math.abs(dragOffset) > 0.12) {
      rotationIndex += dragOffset > 0 ? 1 : -1;
    }
    activeIndex = ((rotationIndex % projects.length) + projects.length) % projects.length;
    dragOffset = 0;
    resetFlippedPanels();
    syncCarouselUI();
  };

  viewport?.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.carousel-nav, .card-flip-btn, .card-front-link, .card-link, .card-service-btn')) return;
    pointerOnViewport = true;
    dragStartX = e.clientX;
    dragOffset = 0;
    setDragging(true);
    viewport.setPointerCapture(e.pointerId);
  });

  viewport?.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    dragOffset = Math.max(
      -MAX_DRAG_OFFSET,
      Math.min(MAX_DRAG_OFFSET, (e.clientX - dragStartX) / DRAG_PX_PER_SLOT)
    );
    scheduleLayout();
  });

  const releasePointer = () => {
    pointerOnViewport = false;
  };

  const endDrag = (e) => {
    if (!isDragging) return;
    if (viewport?.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
    setDragging(false);
    releasePointer();
    snapFromDrag();
  };

  viewport?.addEventListener('pointerup', endDrag);
  viewport?.addEventListener('pointercancel', (e) => {
    if (!isDragging) return;
    setDragging(false);
    dragOffset = 0;
    releasePointer();
    syncCarouselUI();
  });
  viewport?.addEventListener('pointerleave', (e) => {
    if (!isDragging && e.buttons === 0) releasePointer();
  });

  viewport?.addEventListener('wheel', (e) => {
    const pressed = e.buttons !== 0 || pointerOnViewport;
    if (!pressed) return;

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta === 0 || wheelCooldown) return;

    wheelAccum += delta;
    if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;

    nudgeCarousel(wheelAccum > 0 ? 1 : -1);
    wheelAccum = 0;
    wheelCooldown = true;
    setTimeout(() => { wheelCooldown = false; }, 180);

    e.preventDefault();
  }, { passive: false });

  window.addEventListener('resize', scheduleLayout);
}

function awardSortKey(a) {
  if (a.date) return a.date;
  const y = String(a.year ?? '0000');
  const m = a.month != null ? String(a.month).padStart(2, '0') : '00';
  return `${y}-${m}`;
}

function awardDateISO(a) {
  if (a.date) return a.date.length === 4 ? `${a.date}-01` : a.date;
  if (a.year == null) return '';
  const m = a.month != null ? String(a.month).padStart(2, '0') : '01';
  return `${a.year}-${m}`;
}

function awardDateLabel(a) {
  if (a.dateLabel) return a.dateLabel;
  if (a.date) {
    const [y, m, d] = a.date.split('-');
    if (m && d) return `${y}.${m}.${d}`;
    if (m) return `${y}.${m}`;
    return y;
  }
  if (a.year == null) return '—';
  if (a.month != null) return `${a.year}.${String(a.month).padStart(2, '0')}`;
  return String(a.year);
}

function awardCardHTML(a) {
  const iso = awardDateISO(a);
  const label = awardDateLabel(a);
  return `
    <time class="award-node-date" datetime="${esc(iso)}">${esc(label)}</time>
    <div class="award-node-spine" aria-hidden="true">
      <span class="award-node-dot award-node-dot--${a.tier}"></span>
    </div>
    <div class="award-node-card award-node-card--${a.tier}">
      <div class="award-node-body">
        <p class="award-node-title">${esc(a.title)}</p>
        <p class="award-node-project">${esc(a.project)}</p>
      </div>
      <span class="award-node-badge">${esc(a.badge)}</span>
    </div>
  `;
}

function sortAwardsChronological(list) {
  return list
    .map((a, i) => ({ ...a, _order: i }))
    .sort((a, b) => awardSortKey(a).localeCompare(awardSortKey(b)) || a._order - b._order);
}

function renderAwards() {
  const mount = $('#awards-timeline');
  const summary = $('#awards-summary');
  if (!mount) return;

  const sorted = sortAwardsChronological(awards);

  mount.innerHTML = `
    <div class="awards-track" aria-label="受賞歴（時系列）">
      <span class="awards-track-line" aria-hidden="true"></span>
      ${sorted.map((a) => `<article class="award-node">${awardCardHTML(a)}</article>`).join('')}
    </div>
  `;

  if (summary) {
    const major = awards.filter((a) => a.tier === 'finalist' || a.tier === 'major').length;
    const first = awardDateLabel(sorted[0]);
    const last = awardDateLabel(sorted[sorted.length - 1]);
    summary.textContent = `${first}–${last} ── ${awards.length}件 / ${major} highlights`;
  }
}

function setupParallax() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced || !finePointer) return;

  document.addEventListener('pointermove', (e) => {
    const mx = (e.clientX / window.innerWidth - 0.5) * 2;
    const my = (e.clientY / window.innerHeight - 0.5) * 2;
    document.documentElement.style.setProperty('--mx', String(mx));
    document.documentElement.style.setProperty('--my', String(my));
  });
}

function setupNav() {
  const navToggle = $('.nav-toggle');
  const nav = $('.site-nav');
  if (!navToggle || !nav) return;

  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    })
  );
}

function setupReveal() {
  const staggerTargets = document.querySelectorAll(
    '.phil-scatter > *, .loadout-layout > *, .exp-board > *, .award-node, .jump-btn'
  );
  staggerTargets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 8) * 60}ms`;
  });

  const revealEls = document.querySelectorAll('.reveal');

  const activate = (el) => {
    el.classList.add('active');
    setTimeout(() => { el.style.transitionDelay = ''; }, 1000);
  };

  revealEls.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92) activate(el);
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          activate(e.target);
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -4% 0px' });
    revealEls.forEach((el) => {
      if (!el.classList.contains('active')) io.observe(el);
    });
  } else {
    revealEls.forEach(activate);
  }
}

function setupTilt() {}

function setupKonami() {
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
                'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let pos = 0;
  const toast = $('#toast');
  let toastTimer;

  const showToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  };

  document.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = (key === code[pos]) ? pos + 1 : (key === code[0] ? 1 : 0);
    if (pos === code.length) {
      pos = 0;
      const on = document.body.classList.toggle('crt');
      showToast(on ? 'CRT MODE : ON' : 'CRT MODE : OFF');
    }
  });
}

let serviceTipPortal = null;
let serviceTipAnchor = null;

function ensureServiceTipPortal() {
  if (serviceTipPortal) return serviceTipPortal;
  serviceTipPortal = document.createElement('div');
  serviceTipPortal.id = 'service-tip-portal';
  serviceTipPortal.className = 'service-tip-portal';
  serviceTipPortal.setAttribute('role', 'tooltip');
  serviceTipPortal.hidden = true;
  document.body.appendChild(serviceTipPortal);
  return serviceTipPortal;
}

function positionServiceTip() {
  if (!serviceTipPortal || !serviceTipAnchor || serviceTipPortal.hidden) return;

  const rect = serviceTipAnchor.getBoundingClientRect();
  const tipRect = serviceTipPortal.getBoundingClientRect();
  const gap = 8;
  let top = rect.top - tipRect.height - gap;
  let left = rect.left + rect.width / 2 - tipRect.width / 2;

  left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
  if (top < 8) top = rect.bottom + gap;

  serviceTipPortal.style.top = `${Math.round(top)}px`;
  serviceTipPortal.style.left = `${Math.round(left)}px`;
  serviceTipPortal.style.setProperty(
    '--tip-arrow-x',
    `${Math.round(rect.left + rect.width / 2 - left)}px`
  );
}

function showServiceTip(btn) {
  const text = btn.dataset.serviceTip;
  if (!text) return;

  const portal = ensureServiceTipPortal();
  portal.textContent = text;
  portal.hidden = false;
  portal.classList.remove('is-visible');
  serviceTipAnchor = btn;
  positionServiceTip();
  portal.classList.add('is-visible');
}

function hideServiceTip() {
  if (!serviceTipPortal) return;
  serviceTipPortal.hidden = true;
  serviceTipPortal.classList.remove('is-visible');
  serviceTipAnchor = null;
}

function setupServiceTooltips() {
  ensureServiceTipPortal();

  document.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.card-service-btn');
    if (btn) showServiceTip(btn);
  });

  document.addEventListener('mouseout', (e) => {
    const btn = e.target.closest('.card-service-btn');
    if (btn && serviceTipAnchor === btn && !btn.contains(e.relatedTarget)) hideServiceTip();
  });

  document.addEventListener('focusin', (e) => {
    const btn = e.target.closest('.card-service-btn');
    if (btn) showServiceTip(btn);
  });

  document.addEventListener('focusout', (e) => {
    const btn = e.target.closest('.card-service-btn');
    if (btn && serviceTipAnchor === btn && !btn.contains(e.relatedTarget)) hideServiceTip();
  });

  window.addEventListener('scroll', () => {
    if (serviceTipAnchor) positionServiceTip();
  }, true);

  window.addEventListener('resize', () => {
    if (serviceTipAnchor) positionServiceTip();
  });
}

function boot() {
  document.documentElement.classList.add('js');

  if (!window.PORTFOLIO_DATA) {
    console.error('PORTFOLIO_DATA not loaded — check data/content.js');
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('active'));
    return;
  }
  renderStats();
  renderProjects();
  renderAwards();
  setupProjects();
  setupViewSwitch();
  setupGridFocus();
  setupProjectThemeHover();
  setupServiceTooltips();
  setupParallax();
  setupNav();
  setupReveal();
  setupTilt();
  setupKonami();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
