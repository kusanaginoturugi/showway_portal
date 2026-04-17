(function () {
  'use strict';

  const CHECK_TIMEOUT_MS = 8000;

  function formatDateTime(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function createCard(site) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.url = site.url;

    const head = document.createElement('div');
    head.className = 'card-head';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = site.name;
    const subtitle = document.createElement('p');
    subtitle.className = 'card-subtitle';
    subtitle.textContent = site.subtitle || '';
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const status = document.createElement('span');
    status.className = 'status';
    const dot = document.createElement('span');
    dot.className = 'dot dot-checking';
    const statusText = document.createElement('span');
    statusText.textContent = 'checking';
    status.appendChild(dot);
    status.appendChild(statusText);

    head.appendChild(titleWrap);
    head.appendChild(status);

    const desc = document.createElement('p');
    desc.className = 'card-desc';
    desc.textContent = site.description || '';

    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const updated = document.createElement('span');
    updated.textContent = '最終更新: ' + (site.lastUpdated || '—');

    const link = document.createElement('a');
    link.href = site.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'サイトを開く →';

    foot.appendChild(updated);
    foot.appendChild(link);

    card.appendChild(head);
    card.appendChild(desc);
    card.appendChild(foot);

    card._dot = dot;
    card._statusText = statusText;
    return card;
  }

  function setStatus(card, state) {
    const dot = card._dot;
    const text = card._statusText;
    dot.classList.remove('dot-up', 'dot-down', 'dot-checking');
    if (state === 'up') {
      dot.classList.add('dot-up');
      text.textContent = 'up';
    } else if (state === 'down') {
      dot.classList.add('dot-down');
      text.textContent = 'down';
    } else {
      dot.classList.add('dot-checking');
      text.textContent = 'checking';
    }
  }

  // CORSの制約上、fetchでレスポンスは読めないが、
  // 到達できたかどうかは no-cors モードでのPromise resolve/rejectで判別できる。
  // ネットワークエラー (DNS失敗・サーバ停止) のみ reject する。
  // 401 / 403 / 200 いずれも resolve される = サイトは生きている。
  async function ping(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    // キャッシュ回避のためのクエリ
    const probe = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    try {
      await fetch(probe, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
        credentials: 'omit'
      });
      return 'up';
    } catch (e) {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkAll(cards) {
    setLastChecked('checking...');
    await Promise.all(cards.map(async (card) => {
      setStatus(card, 'checking');
      const state = await ping(card.dataset.url);
      setStatus(card, state);
    }));
    setLastChecked(formatDateTime(new Date()));
  }

  function setLastChecked(text) {
    const el = document.getElementById('last-checked');
    if (el) el.textContent = text;
  }

  function render() {
    const data = window.SITES || { public: [], private: [] };
    const publicContainer = document.getElementById('cards-public');
    const privateContainer = document.getElementById('cards-private');
    const allCards = [];

    data.public.forEach((site) => {
      const card = createCard(site);
      publicContainer.appendChild(card);
      allCards.push(card);
    });
    data.private.forEach((site) => {
      const card = createCard(site);
      privateContainer.appendChild(card);
      allCards.push(card);
    });

    const btn = document.getElementById('refresh');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await checkAll(allCards);
      btn.disabled = false;
    });

    checkAll(allCards);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
