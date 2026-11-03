(() => {
  'use strict';
  const slides = [...document.querySelectorAll('.slide')];
  const viewport = document.querySelector('.viewport');
  const select = document.getElementById('jump');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const counter = document.getElementById('counter');
  const menu = document.getElementById('viewerMenu');
  const full = document.getElementById('full');
  const hint = document.getElementById('gestureHint');
  const compact = matchMedia('(max-width: 700px), (max-width: 1000px) and (max-height: 500px)');
  let page = 0, touch = null, hintTimer;
  let lastWheel = -Infinity, lastWheelTurn = -Infinity;
  let wheelX = 0, wheelY = 0, wheelAxis = null, wheelLocked = false;
  const interactive = target => target instanceof Element && !!target.closest('button,select,input,textarea,a,summary,.viewer-controls');
  const zoomed = () => (window.visualViewport?.scale || 1) > 1.05;
  slides.forEach((slide, i) => {
    slide.id = 'slide-' + (i + 1);
    const option = document.createElement('option');
    option.value = i;
    option.textContent = String(i + 1).padStart(2, '0') + ' ' + slide.dataset.title;
    select.append(option);
    slide.querySelector('.page').textContent = String(i + 1).padStart(2, '0') + ' / ' + slides.length;
    slide.querySelectorAll('img').forEach(img => img.draggable = false);
  });
  function fit() {
    document.body.classList.toggle('read', compact.matches);
    document.documentElement.style.setProperty('--s', Math.min(viewport.clientWidth / 1440, viewport.clientHeight / 810));
  }
  function show(index, animate = true) {
    const target = Math.max(0, Math.min(slides.length - 1, index));
    const changed = target !== page;
    document.documentElement.style.setProperty('--enter-x', target > page ? '32px' : '-32px');
    page = target;
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === page);
      slide.classList.toggle('page-enter', i === page && changed && animate);
      slide.setAttribute('aria-hidden', String(i !== page));
      slide.inert = i !== page;
    });
    select.value = page;
    prev.disabled = page === 0;
    next.disabled = page === slides.length - 1;
    counter.textContent = (page + 1) + ' / ' + slides.length;
    counter.setAttribute('aria-label', (page + 1) + ' / ' + slides.length + '：' + slides[page].dataset.title);
    document.querySelector('.progress i').style.width = ((page + 1) / slides.length * 100) + '%';
    history.replaceState(null, '', '#' + (page + 1));
    if (changed) viewport.scrollTop = 0;
    menu.open = false;
  }
  prev.addEventListener('click', () => show(page - 1));
  next.addEventListener('click', () => show(page + 1));
  select.addEventListener('change', () => show(Number(select.value)));
  document.getElementById('print').addEventListener('click', () => { menu.open = false; window.print(); });
  document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) menu.open = false; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      menu.open = false;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || /^(SELECT|INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    let target;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') target = page + 1;
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') target = page - 1;
    if (e.key === 'Home') target = 0;
    if (e.key === 'End') target = slides.length - 1;
    if (target !== undefined) { e.preventDefault(); show(target); }
  });
  // A horizontal gesture and its momentum tail produce at most one page turn.
  viewport.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey || zoomed() || interactive(e.target)) return;
    const now = performance.now();
    if (now - lastWheel > 220 && now - lastWheelTurn > 450) {
      wheelX = wheelY = 0; wheelAxis = null; wheelLocked = false;
    }
    lastWheel = now;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewport.clientWidth : 1;
    wheelX += e.deltaX * unit; wheelY += e.deltaY * unit;
    if (!wheelAxis && Math.max(Math.abs(wheelX), Math.abs(wheelY)) > 10) {
      if (Math.abs(wheelX) > Math.abs(wheelY) * 1.4) wheelAxis = 'horizontal';
      else if (Math.abs(wheelY) > Math.abs(wheelX) * 1.4) wheelAxis = 'vertical';
    }
    if (wheelAxis !== 'horizontal') return;
    e.preventDefault();
    if (!wheelLocked && Math.abs(wheelX) >= 65) {
      wheelLocked = true; lastWheelTurn = now;
      show(page + (wheelX > 0 ? 1 : -1));
    }
  }, { passive: false });
  viewport.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || zoomed() || interactive(e.target)) { touch = null; return; }
    const p = e.touches[0];
    touch = { id: p.identifier, x: p.clientX, y: p.clientY, dx: 0, dy: 0, axis: null };
  }, { passive: true });
  viewport.addEventListener('touchmove', e => {
    if (!touch) return;
    if (e.touches.length !== 1 || zoomed()) { touch = null; return; }
    const p = [...e.touches].find(p => p.identifier === touch.id);
    if (!p) { touch = null; return; }
    touch.dx = p.clientX - touch.x; touch.dy = p.clientY - touch.y;
    if (!touch.axis && Math.max(Math.abs(touch.dx), Math.abs(touch.dy)) > 12) {
      touch.axis = Math.abs(touch.dx) > Math.abs(touch.dy) * 1.4 ? 'horizontal' : 'vertical';
    }
    if (touch.axis === 'horizontal' && e.cancelable) e.preventDefault();
  }, { passive: false });
  viewport.addEventListener('touchend', e => {
    const g = touch; touch = null;
    if (!g || e.touches.length || zoomed()) return;
    if (g.axis === 'horizontal' && Math.abs(g.dx) >= 55 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4) {
      show(page + (g.dx < 0 ? 1 : -1));
    }
  }, { passive: true });
  viewport.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
  function notice(text) {
    clearTimeout(hintTimer); hint.textContent = text; hint.classList.remove('dismissed');
    hintTimer = setTimeout(() => hint.classList.add('dismissed'), 5000);
  }
  function fullscreenState() {
    full.textContent = document.fullscreenElement ? '全画面を終了' : '全画面';
    full.setAttribute('aria-pressed', String(!!document.fullscreenElement));
    fit();
  }
  full.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen && document.fullscreenEnabled) await document.documentElement.requestFullscreen();
      else notice('このブラウザでは、画面内いっぱいの表示になります。');
    } catch { notice('全画面に切り替えられませんでした。画面内いっぱいの表示でご覧ください。'); }
  });
  document.addEventListener('fullscreenchange', fullscreenState);
  window.addEventListener('resize', () => { touch = null; fit(); });
  document.addEventListener('visibilitychange', () => { touch = null; });
  window.addEventListener('beforeprint', () => document.body.classList.remove('read'));
  window.addEventListener('afterprint', fit);
  fit();
  const initial = Number(location.hash.slice(1));
  show(Number.isFinite(initial) && initial > 0 ? initial - 1 : 0, false);
  fullscreenState();
  notice('左右にスワイプ・横スクロールでページ送り');
})();
