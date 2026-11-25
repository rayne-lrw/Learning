(function () {
  'use strict';

  var SECTIONS = [
    ['what', '它是什麼'],
    ['example', '例子'],
    ['why', '為什麼重要'],
    ['howto', '怎麼用']
  ];

  var state = { categories: [], all: [], byId: {}, cat: 'all', q: '', fav: loadFav(), stack: [], start: 0 };
  var PANEL_W = 420, SPINE_W = 46;
  var mobileMQ = window.matchMedia('(max-width: 860px)');
  var hoverMQ = window.matchMedia('(hover: hover) and (min-width: 861px)');

  /* ---------- 收藏（只存在這個瀏覽器的 localStorage） ---------- */
  function loadFav() {
    try {
      var arr = JSON.parse(localStorage.getItem('favorites') || '[]');
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) { return new Set(); }
  }
  function saveFav() {
    try { localStorage.setItem('favorites', JSON.stringify(Array.from(state.fav))); } catch (e) {}
  }
  function favCount() {
    var n = 0;
    state.fav.forEach(function (id) { if (state.byId[id]) n++; });
    return n;
  }
  function inView(c) {
    return state.cat === 'all' || (state.cat === 'fav' ? state.fav.has(c.id) : c.cat === state.cat);
  }
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 主題 ---------- */
  function applyThemeIcon() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    $('themeBtn').textContent = dark ? '☀️' : '🌙';
    $('themeBtn').title = dark ? '切換為淺色模式' : '切換為深色模式';
  }
  $('themeBtn').addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    applyThemeIcon();
  });
  applyThemeIcon();

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function baseName(n) { return n.replace(/（.*?）/g, '').trim(); }

  // 名稱對照表：用來把文中「某概念」自動連到該卡片
  var nameMap = {};
  function buildNameMap() {
    state.all.forEach(function (c) {
      nameMap[c.name] = c.id;
      nameMap[baseName(c.name)] = c.id;
      var m = c.name.match(/（(.*?)）/);
      if (m) nameMap[m[1]] = c.id;
    });
  }

  // 把一段字串轉成 HTML：以「- 」開頭的行變清單，其餘變段落
  function renderText(text, selfId, q) {
    var lines = String(text).split('\n');
    var html = '', inList = false;
    lines.forEach(function (line) {
      var isItem = /^\s*-\s+/.test(line);
      var content = inline(line.replace(/^\s*-\s+/, ''), selfId, q);
      if (isItem) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + content + '</li>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (line.trim()) html += '<p>' + content + '</p>';
      }
    });
    if (inList) html += '</ul>';
    return html;
  }

  function inline(s, selfId, q) {
    var out = esc(s);
    out = out.replace(/「([^「」]+)」/g, function (m, inner) {
      var id = nameMap[inner];
      if (id && id !== selfId) return '「<a class="ref" href="#' + id + '" data-ref="' + id + '">' + inner + '</a>」';
      return m;
    });
    return highlight(out, q);
  }

  function highlight(html, q) {
    if (!q) return html;
    var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    // 只處理標籤之外的文字；先還原成原始文字再比對，避免把 &amp; 之類的跳脫字元切開
    return html.replace(/(<[^>]+>)|([^<]+)/g, function (m, tag, txt) {
      if (tag) return tag;
      var raw = unesc(txt);
      var out = '', last = 0, r;
      re.lastIndex = 0;
      while ((r = re.exec(raw))) {
        if (!r[0]) { re.lastIndex++; continue; }
        out += esc(raw.slice(last, r.index)) + '<mark>' + esc(r[0]) + '</mark>';
        last = r.index + r[0].length;
      }
      return out + esc(raw.slice(last));
    });
  }

  function unesc(s) {
    return s.replace(/&(amp|lt|gt|quot|#39);/g, function (m, e) {
      return { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e];
    });
  }

  function gist(c) {
    var first = c.what.split('\n')[0];
    return first.replace(/^\s*-\s+/, '');
  }

  /* ---------- 載入資料 ---------- */
  function load() {
    fetch('data/categories.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (idx) {
        state.categories = idx.categories;
        return Promise.all(idx.categories.map(function (cat) {
          return fetch('data/' + cat.file, { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error(cat.file + ' ' + r.status); return r.json(); })
            .then(function (items) {
              // id 會寫進網址和 HTML 屬性，只接受小寫英文、數字和連字號
              cat.items = items.filter(function (it) {
                var ok = it && typeof it.id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(it.id) && typeof it.name === 'string';
                if (!ok) console.warn('略過格式不正確的概念：', it && it.id);
                return ok;
              });
              cat.items.forEach(function (it) { it.cat = cat.id; it.catName = cat.name; });
            });
        }));
      })
      .then(function () {
        state.categories.forEach(function (c) { state.all = state.all.concat(c.items); });
        state.all.forEach(function (c) { state.byId[c.id] = c; });
        buildNameMap();
        $('sub').textContent = '共 ' + state.all.length + ' 個概念 · ' + state.categories.length + ' 個分類';
        renderChips();
        render();
        openFromHash();
      })
      .catch(function (err) {
        $('list').innerHTML = '<div class="error">資料載入失敗（' + esc(err.message) + '）。<br>' +
          '如果你是直接用瀏覽器開啟本機檔案，請改用本機伺服器，例如在資料夾中執行 <code>python3 -m http.server</code>。</div>';
        $('sub').textContent = '載入失敗';
      });
  }

  /* ---------- 畫面 ---------- */
  function renderChips() {
    var html = '<button class="cat-item all' + (state.cat === 'all' ? ' on' : '') + '" data-cat="all"><span class="label">全部</span><span class="n">' + state.all.length + '</span></button>';
    html += '<button class="cat-item fav-item' + (state.cat === 'fav' ? ' on' : '') + '" data-cat="fav"><span class="label">★ 我的收藏</span><span class="n">' + favCount() + '</span></button>';
    var cur = state.cat === 'fav' ? '★ 收藏' : '全部';
    state.categories.forEach(function (c) {
      if (state.cat === c.id) cur = c.name;
      html += '<button class="cat-item' + (state.cat === c.id ? ' on' : '') + '" data-cat="' + c.id + '" title="' + esc(c.description || '') + '"><span class="label">' + esc(c.name) + '</span><span class="n">' + c.items.length + '</span></button>';
    });
    $('chips').innerHTML = html;
    $('catCur').textContent = cur;
  }

  function matches(c, q) {
    if (!q) return true;
    var hay = [c.name, c.en, c.what, c.example, c.why, c.howto].join(' ').toLowerCase();
    return hay.indexOf(q.toLowerCase()) !== -1;
  }

  function cardHTML(c, q) {
    var body = SECTIONS.map(function (s) {
      return '<div class="part"><h3>' + s[1] + '</h3>' + renderText(c[s[0]], c.id, q) + '</div>';
    }).join('');
    return '<details class="card" id="' + c.id + '">' +
      '<summary><div class="t"><div><span class="name">' + highlight(esc(c.name), q) + '</span>' +
      '<span class="en">' + highlight(esc(c.en || ''), q) + '</span></div>' +
      '<div class="gist">' + highlight(esc(gist(c)), q) + '</div></div>' +
      favBtnHTML(c.id) +
      '<span class="arrow"></span></summary>' +
      '<div class="body">' + body +
      '<div class="card-foot"><span class="tag">' + esc(c.catName) + '</span>' +
      '<button class="copy" data-copy="' + c.id + '">複製連結</button></div>' +
      '</div></details>';
  }

  function favBtnHTML(id) {
    var on = state.fav.has(id);
    return '<button class="fav-btn' + (on ? ' on' : '') + '" data-fav="' + id + '" aria-pressed="' + on + '" title="' + (on ? '取消收藏' : '收藏') + '">' + (on ? '★' : '☆') + '</button>';
  }

  /* ---------- 連結面板 ---------- */
  function panelHTML(c, i) {
    var body = SECTIONS.map(function (s) {
      return '<div class="part"><h3>' + s[1] + '</h3>' + renderText(c[s[0]], c.id, '') + '</div>';
    }).join('');
    return '<section class="panel" data-idx="' + i + '" data-id="' + c.id + '">' +
      '<div class="panel-head"><div class="t"><div class="name">' + esc(c.name) + '</div>' +
      '<div class="en">' + esc(c.en || '') + '</div></div>' +
      favBtnHTML(c.id) +
      '<button class="x" data-close="' + i + '" title="關閉">✕</button></div>' +
      '<div class="panel-meta"><span class="tag">' + esc(c.catName) + '</span>' +
      '<button class="goto" data-goto="' + c.id + '">在列表中查看</button></div>' +
      body + '</section>';
  }

  // 桌面版：算出畫面放得下幾個展開的面板，其餘縮成窄邊
  function expandedCount(n) {
    var avail = window.innerWidth - 250;
    var k = n;
    while (k > 1 && k * PANEL_W + (n - k) * SPINE_W > avail) k--;
    return k;
  }

  function renderStack(focusIdx) {
    var n = state.stack.length;
    var el = $('stack');
    if (!n) {
      el.classList.remove('open');
      $('stackShade').classList.remove('open');
      document.body.classList.remove('sheet-open');
      $('stackTrack').innerHTML = '';
      return;
    }
    var k = mobileMQ.matches ? n : expandedCount(n);
    if (focusIdx == null) focusIdx = n - 1;
    var start = Math.min(state.start, n - k);
    if (focusIdx < start) start = focusIdx;
    if (focusIdx > start + k - 1) start = focusIdx - k + 1;
    state.start = Math.max(0, start);
    var html = '';
    state.stack.forEach(function (id, i) {
      var c = state.byId[id];
      if (i >= state.start && i < state.start + k) html += panelHTML(c, i);
      else html += '<button class="spine" data-spine="' + i + '" title="' + esc(c.name) + '">' + Array.from(baseName(c.name)).map(function (ch) { return '<span>' + esc(ch) + '</span>'; }).join('') + '</button>';
    });
    $('stackTrack').innerHTML = html;
    $('stackCrumbs').textContent = state.stack.map(function (id) { return baseName(state.byId[id].name); }).join(' › ');
    $('stackBack').hidden = n < 2;
    el.classList.add('open');
    if (mobileMQ.matches) {
      $('stackShade').classList.add('open');
      document.body.classList.add('sheet-open');
    }
    var target = $('stackTrack').querySelector('.panel[data-idx="' + focusIdx + '"]');
    var track = $('stackTrack');
    if (target) {
      // 只在面板區塊內左右捲動，不動到整個頁面
      var l = target.offsetLeft, r = l + target.offsetWidth;
      if (r > track.scrollLeft + track.clientWidth) track.scrollLeft = r - track.clientWidth;
      if (l < track.scrollLeft) track.scrollLeft = l;
    }
  }

  function flashPanel(i) {
    var p = $('stackTrack').querySelector('.panel[data-idx="' + i + '"]');
    if (!p) return;
    p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash');
  }

  // fromIdx：從第幾個面板點出來的；-1 代表從列表點的
  function openRef(id, fromIdx) {
    hidePeek();
    var at = state.stack.indexOf(id);
    if (at !== -1) { renderStack(at); flashPanel(at); return; }
    state.stack = state.stack.slice(0, fromIdx + 1).concat(id);
    state.start = state.stack.length; // 讓最新的面板靠右
    renderStack(state.stack.length - 1);
    var p = $('stackTrack').querySelector('.panel[data-idx="' + (state.stack.length - 1) + '"]');
    if (p) p.scrollTop = 0;
  }

  function closeStack() { state.stack = []; state.start = 0; renderStack(); }

  /* ---------- 預覽小卡（只在有滑鼠的桌面） ---------- */
  var peekTimer = null;
  function hidePeek() { clearTimeout(peekTimer); $('peek').classList.remove('show'); }
  function showPeek(a) {
    var c = state.byId[a.getAttribute('data-ref')]; if (!c) return;
    var pk = $('peek');
    pk.innerHTML = '<span class="name">' + esc(c.name) + '</span><span class="en">' + esc(c.en || '') + '</span>' +
      '<div class="g">' + esc(gist(c)) + '</div><div class="hint">點一下在旁邊展開</div>';
    pk.classList.add('show');
    var r = a.getBoundingClientRect(), w = pk.offsetWidth, h = pk.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = r.top - h - 8;
    pk.style.left = left + 'px'; pk.style.top = Math.max(8, top) + 'px';
  }
  document.addEventListener('mouseover', function (e) {
    if (!hoverMQ.matches) return;
    var a = e.target.closest && e.target.closest('a.ref');
    if (!a) return;
    clearTimeout(peekTimer);
    peekTimer = setTimeout(function () { showPeek(a); }, 250);
  });
  document.addEventListener('mouseout', function (e) {
    var a = e.target.closest && e.target.closest('a.ref');
    if (a && !a.contains(e.relatedTarget)) hidePeek();
  });
  window.addEventListener('scroll', hidePeek, true);

  function render() {
    var q = state.q.trim();
    var html = '', count = 0;
    state.categories.forEach(function (cat) {
      var items = cat.items.filter(function (c) { return inView(c) && matches(c, q); });
      if (!items.length) return;
      count += items.length;
      html += '<section class="section"><h2>' + esc(cat.name) + '</h2>' +
        (cat.description ? '<p class="desc">' + esc(cat.description) + '</p>' : '') +
        items.map(function (c) { return cardHTML(c, q); }).join('') + '</section>';
    });
    var empty = q ? '找不到符合「' + esc(q) + '」的概念。'
      : (state.cat === 'fav' ? '還沒有收藏。點卡片右上角的 ☆ 就能收藏。<br>收藏只存在這個瀏覽器，清除網站資料後就會消失。' : '這個分類還沒有概念。');
    $('list').innerHTML = html || '<div class="empty">' + empty + '</div>';
    $('status').textContent = q ? '找到 ' + count + ' 個結果' : '';
    // 搜尋時自動展開結果較少的卡片
    if (q && count <= 5) document.querySelectorAll('.card').forEach(function (d) { d.open = true; });
    updateToggleLabel();
  }

  function updateToggleLabel() {
    var cards = document.querySelectorAll('.card');
    var allOpen = cards.length && Array.prototype.every.call(cards, function (d) { return d.open; });
    $('toggleAll').textContent = allOpen ? '全部收合' : '全部展開';
  }

  function focusCard(id, instant) {
    var el = document.getElementById(id);
    if (!el) {
      // 不在目前篩選範圍內：清除篩選後再找
      state.cat = 'all'; state.q = ''; $('search').value = '';
      renderChips(); render();
      el = document.getElementById(id);
      if (!el) return;
    }
    el.open = true;
    var headerH = document.querySelector('header.top').offsetHeight;
    var top = el.getBoundingClientRect().top + window.pageYOffset - headerH - 12;
    window.scrollTo({ top: top, behavior: instant ? 'auto' : 'smooth' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    updateToggleLabel();
  }

  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (id && state.byId[id]) focusCard(id, true);
  }

  /* ---------- 事件 ---------- */
  $('chips').addEventListener('click', function (e) {
    var b = e.target.closest('.cat-item'); if (!b) return;
    state.cat = b.getAttribute('data-cat');
    renderChips(); render();
    setDrawer(false);
    window.scrollTo({ top: 0 });
  });

  // 手機版抽屜
  function setDrawer(open) {
    $('side').classList.toggle('open', open);
    $('backdrop').classList.toggle('open', open);
    document.body.classList.toggle('drawer-open', open);
    $('catBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  $('catBtn').addEventListener('click', function () { setDrawer(true); });
  $('sideClose').addEventListener('click', function () { setDrawer(false); });
  $('backdrop').addEventListener('click', function () { setDrawer(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });

  // 讓側欄黏在頂部列下方
  function syncHeadHeight() {
    document.documentElement.style.setProperty('--head-h', document.querySelector('header.top').offsetHeight + 'px');
  }
  window.addEventListener('resize', syncHeadHeight);
  syncHeadHeight();

  var timer;
  $('search').addEventListener('input', function (e) {
    clearTimeout(timer);
    timer = setTimeout(function () { state.q = e.target.value; render(); }, 150);
  });

  $('toggleAll').addEventListener('click', function () {
    var cards = document.querySelectorAll('.card');
    var allOpen = Array.prototype.every.call(cards, function (d) { return d.open; });
    cards.forEach(function (d) { d.open = !allOpen; });
    updateToggleLabel();
  });

  $('randomBtn').addEventListener('click', function () {
    var pool = state.all.filter(inView);
    if (!pool.length) return;
    var c = pool[Math.floor(Math.random() * pool.length)];
    document.querySelectorAll('.card[open]').forEach(function (d) { d.open = false; });
    history.replaceState(null, '', '#' + c.id);
    focusCard(c.id);
  });

  // 星號與概念連結：列表和面板共用
  document.addEventListener('click', function (e) {
    var fb = e.target.closest('.fav-btn');
    if (fb) {
      e.preventDefault(); // 不要順便展開或收合卡片
      var id = fb.getAttribute('data-fav');
      if (state.fav.has(id)) state.fav.delete(id); else state.fav.add(id);
      saveFav();
      renderChips();
      document.querySelectorAll('.fav-btn[data-fav="' + id + '"]').forEach(function (b) { b.outerHTML = favBtnHTML(id); });
      if (state.cat === 'fav' && !state.fav.has(id)) render();
      return;
    }
    var ref = e.target.closest('a.ref');
    if (ref) {
      e.preventDefault();
      var panel = ref.closest('.panel');
      openRef(ref.getAttribute('data-ref'), panel ? +panel.getAttribute('data-idx') : -1);
    }
  });

  $('stackTrack').addEventListener('click', function (e) {
    var x = e.target.closest('[data-close]');
    if (x) {
      var i = +x.getAttribute('data-close');
      state.stack.splice(i, 1);
      renderStack(Math.min(i, state.stack.length - 1));
      return;
    }
    var sp = e.target.closest('[data-spine]');
    if (sp) { var j = +sp.getAttribute('data-spine'); renderStack(j); flashPanel(j); return; }
    var g = e.target.closest('[data-goto]');
    if (g) {
      var id = g.getAttribute('data-goto');
      closeStack();
      history.replaceState(null, '', '#' + id);
      focusCard(id);
    }
  });
  $('stackClose').addEventListener('click', closeStack);
  $('stackShade').addEventListener('click', closeStack);
  $('stackBack').addEventListener('click', function () {
    state.stack.pop();
    renderStack();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hidePeek(); closeStack(); } });
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (state.stack.length) renderStack(); }, 120);
  });

  $('list').addEventListener('click', function (e) {
    // 在列表中點開另一張卡片時，關掉右側的連結面板
    var sum = e.target.closest('summary');
    if (sum && !e.target.closest('.fav-btn') && !sum.parentNode.open) closeStack();
    var cp = e.target.closest('.copy');
    if (cp) {
      var url = location.href.split('#')[0] + '#' + cp.getAttribute('data-copy');
      var done = function () { cp.textContent = '已複製 ✓'; setTimeout(function () { cp.textContent = '複製連結'; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt('複製這個連結：', url); });
      else prompt('複製這個連結：', url);
    }
  });

  $('list').addEventListener('toggle', updateToggleLabel, true);
  window.addEventListener('hashchange', openFromHash);

  load();
})();
