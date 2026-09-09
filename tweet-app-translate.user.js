// ==UserScript==
// @name         Tweet.app Translate Button
// @namespace    imgd.net
// @version      2.3
// @description  各ツイートに翻訳ボタンを追加し、選択言語へワンクリック翻訳
// @match        https://app.tweet.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @connect      clients5.google.com
// @icon         https://app.tweet.app/assets/brand/bird-blue.svg
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'tweetapp_translate_lang';
  const COMPOSE_STORAGE_KEY = 'tweetapp_compose_translate_lang';

  const LANGS = [
    ['ja', '日本語'],
    ['en', 'English'],
    ['zh-CN', '中文(簡体)'],
    ['zh-TW', '中文(繁体)'],
    ['ko', '한국어'],
    ['es', 'Español'],
    ['fr', 'Français'],
    ['de', 'Deutsch'],
  ];

  // ブラウザ/OSの言語設定から対応言語コードを推定(例: "ja-JP" -> "ja", "zh-Hant-TW" -> "zh-TW")
  function detectSystemLang() {
    const raw = (navigator.language || 'en').toLowerCase();
    const supported = LANGS.map(([code]) => code.toLowerCase());

    if (supported.includes(raw)) {
      return LANGS.find(([code]) => code.toLowerCase() === raw)[0];
    }
    // 中国語は繁体/簡体の判定
    if (raw.startsWith('zh')) {
      return raw.includes('tw') || raw.includes('hant') ? 'zh-TW' : 'zh-CN';
    }
    // 主言語部分(例: "en-us" -> "en")で再照合
    const primary = raw.split('-')[0];
    const match = LANGS.find(([code]) => code.toLowerCase().split('-')[0] === primary);
    return match ? match[0] : 'en';
  }

  const DEFAULT_LANG = detectSystemLang();
  const DEFAULT_COMPOSE_LANG = 'en';

  function getLang() {
    return GM_getValue(STORAGE_KEY, DEFAULT_LANG);
  }
  function setLang(lang) {
    GM_setValue(STORAGE_KEY, lang);
  }
  function getComposeLang() {
    return GM_getValue(COMPOSE_STORAGE_KEY, DEFAULT_COMPOSE_LANG);
  }
  function setComposeLang(lang) {
    GM_setValue(COMPOSE_STORAGE_KEY, lang);
  }

  const style = document.createElement('style');
  style.textContent = `
    .tt-translate-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      color: rgb(101,119,134);
      font-size: 13px;
      margin-top: 4px;
      user-select: none;
      width: fit-content;
    }
    .tt-translate-btn:hover { color: #1da1f2; }
    .tt-translate-result {
      margin-top: 6px;
      padding: 8px 10px;
      background: rgba(29,161,242,0.08);
      border-left: 3px solid #1da1f2;
      border-radius: 4px;
      font-size: 14px;
      white-space: pre-wrap;
    }
    .tt-lang-select {
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,.15);
    }
    .tt-lang-bar {
      display: flex;
      flex-direction: row;
      gap: 8px;
      margin-bottom: 12px;
    }
    .tt-lang-bar.tt-fixed-fallback {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 9999;
    }
    .tt-compose-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      color: rgb(101,119,134);
      font-size: 13px;
      margin-top: 6px;
      user-select: none;
      width: fit-content;
    }
    .tt-compose-btn:hover { color: #1da1f2; }
    .tt-compose-result {
      margin-top: 6px;
      padding: 8px 10px;
      background: rgba(23,191,99,0.08);
      border-left: 3px solid #17bf63;
      border-radius: 4px;
      font-size: 14px;
      white-space: pre-wrap;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  function findWhoToFollowHeading() {
    // "Who to follow" というテキストを持つ見出し要素を探す
    const candidates = Array.from(document.querySelectorAll('h1, h2, h3, div, span'));
    return candidates.find((el) => el.children.length === 0 && el.textContent.trim() === 'Who to follow');
  }

  function injectLangBar() {
    if (document.querySelector('.tt-lang-bar')) return;

    const bar = document.createElement('div');
    bar.className = 'tt-lang-bar';

    const readSel = document.createElement('select');
    readSel.className = 'tt-lang-select';
    LANGS.forEach(([code, label]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = label;
      if (code === getLang()) opt.selected = true;
      readSel.appendChild(opt);
    });
    readSel.addEventListener('change', () => {
      setLang(readSel.value);
      refreshAllBtnLabels();
    });

    const composeSel = document.createElement('select');
    composeSel.className = 'tt-lang-select';
    LANGS.forEach(([code, label]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = 'Translate to: ' + label;
      if (code === getComposeLang()) opt.selected = true;
      composeSel.appendChild(opt);
    });
    composeSel.addEventListener('change', () => {
      setComposeLang(composeSel.value);
      refreshAllBtnLabels();
    });

    bar.appendChild(readSel);
    bar.appendChild(composeSel);

    const heading = findWhoToFollowHeading();
    if (heading) {
      // "Who to follow" を内包するカードの直前に挿入
      const card = heading.closest('div')?.parentElement || heading.parentElement;
      (card || heading.parentElement).insertAdjacentElement('beforebegin', bar);
    } else {
      bar.classList.add('tt-fixed-fallback');
      document.body.appendChild(bar);
    }
  }

  // ツイート本文の p タグ: class に "text-[15px]" と "leading-5" を含む
  function getTweetTextEls() {
    return Array.from(document.querySelectorAll('article p.leading-5'));
  }

  function processTweets() {
    getTweetTextEls().forEach((p) => {
      if (p.dataset.ttDone) return;
      p.dataset.ttDone = '1';

      const text = p.textContent.trim();
      if (!text) return;

      const btn = document.createElement('div');
      btn.className = 'tt-translate-btn';
      btn.dataset.ttState = 'idle';
      updateTranslateBtnLabel(btn);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        translateAndShow(p, text, btn);
      });

      p.insertAdjacentElement('afterend', btn);
    });
  }

  function updateTranslateBtnLabel(btn) {
    const lang = getLang();
    if (btn.dataset.ttState === 'shown') {
      btn.textContent = `🌐 Hide translation (${lang})`;
    } else if (btn.dataset.ttState === 'loading') {
      btn.textContent = `🌐 Translating... (${lang})`;
    } else {
      btn.textContent = `🌐 Show translation (${lang})`;
    }
  }

  function updateComposeBtnLabel(btn) {
    const lang = getComposeLang();
    if (btn.dataset.ttState === 'loading') {
      btn.textContent = `🌐 Translating... (${lang})`;
    } else {
      btn.textContent = `🌐 Insert translation (${lang})`;
    }
  }

  function refreshAllBtnLabels() {
    document.querySelectorAll('.tt-translate-btn').forEach(updateTranslateBtnLabel);
    document.querySelectorAll('.tt-compose-btn').forEach(updateComposeBtnLabel);
  }

  function buildUrl(endpoint, text, lang) {
    if (endpoint === 'primary') {
      return (
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
        encodeURIComponent(lang) +
        '&dt=t&q=' +
        encodeURIComponent(text)
      );
    }
    // フォールバック: clients5経由(別エンドポイント、レート制限が独立していることが多い)
    return (
      'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=' +
      encodeURIComponent(lang) +
      '&q=' +
      encodeURIComponent(text)
    );
  }

  function parseResponse(endpoint, responseText) {
    const data = JSON.parse(responseText);
    if (endpoint === 'primary') {
      return data[0].map((seg) => seg[0]).join('');
    }
    // clients5(dict-chrome-ex)形式: [["翻訳結果","検出された原文言語コード"]]
    // data[0][0] が翻訳文字列そのもの。data[0][1] 以降は言語コード等なので無視する。
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0][0];
    }
    if (Array.isArray(data) && typeof data[0] === 'string') {
      return data[0];
    }
    if (data.sentences) {
      return data.sentences.map((s) => s.trans).join('');
    }
    throw new Error('unexpected format');
  }

  function requestOnce(endpoint, text, lang, onSuccess, onFail) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: buildUrl(endpoint, text, lang),
      onload: function (res) {
        if (res.status < 200 || res.status >= 300) {
          onFail(res.status, res.responseText);
          return;
        }
        try {
          onSuccess(parseResponse(endpoint, res.responseText));
        } catch (err) {
          onFail('parse', res.responseText);
        }
      },
      onerror: function (err) {
        onFail('network', err);
      },
      ontimeout: function () {
        onFail('timeout', null);
      },
    });
  }

  function callTranslateApi(text, lang, onSuccess, onFail) {
    // まずprimaryエンドポイントを試し、429(レート制限)ならfallbackへ自動切替
    requestOnce(
      'primary',
      text,
      lang,
      onSuccess,
      (status, detail) => {
        console.error('[TT翻訳] primary失敗', status, detail);
        if (status === 429) {
          requestOnce(
            'fallback',
            text,
            lang,
            onSuccess,
            (status2, detail2) => {
              console.error('[TT翻訳] fallback失敗', status2, detail2);
              onFail(
                status2 === 429
                  ? 'Rate limited — please wait a moment and try again'
                  : 'HTTP ' + status2
              );
            }
          );
        } else {
          onFail(status === 'parse' ? 'Parse error' : status === 'network' ? 'Network error' : status === 'timeout' ? 'Timeout' : 'HTTP ' + status);
        }
      }
    );
  }

  function translateAndShow(anchorEl, text, btn) {
    const existing = btn.nextElementSibling;
    if (existing && existing.classList.contains('tt-translate-result')) {
      existing.remove();
      btn.dataset.ttState = 'idle';
      updateTranslateBtnLabel(btn);
      return;
    }
    btn.dataset.ttState = 'loading';
    updateTranslateBtnLabel(btn);
    const lang = getLang();

    callTranslateApi(
      text,
      lang,
      (translated) => {
        btn.dataset.ttState = 'shown';
        updateTranslateBtnLabel(btn);
        const div = document.createElement('div');
        div.className = 'tt-translate-result';
        div.textContent = translated;
        btn.insertAdjacentElement('afterend', div);
      },
      (errMsg) => {
        btn.dataset.ttState = 'idle';
        updateTranslateBtnLabel(btn);
        const div = document.createElement('div');
        div.className = 'tt-translate-result';
        div.textContent = '⚠️ Translation failed: ' + errMsg;
        btn.insertAdjacentElement('afterend', div);
      }
    );
  }

  // ---- 投稿(compose)欄および返信(reply)欄の翻訳機能 ----
  function getComposeEls() {
    const all = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));
    return all.filter((el) => {
      const ph = (el.getAttribute('placeholder') || el.getAttribute('aria-placeholder') || '').toLowerCase();
      const label = (el.getAttribute('aria-label') || '').toLowerCase();
      const name = (el.getAttribute('name') || '').toLowerCase();

      return (
        ph.includes('happening') ||
        label.includes('happening') ||
        ph.includes('reply') ||
        label.includes('reply') ||
        name === 'compose-text'
      );
    });
  }

  function getComposeText(el) {
    return el.tagName === 'TEXTAREA' ? el.value : el.textContent;
  }

  function processComposeBoxes() {
    getComposeEls().forEach((el) => {
      if (el.dataset.ttComposeDone) return;
      el.dataset.ttComposeDone = '1';

      const btn = document.createElement('div');
      btn.className = 'tt-compose-btn';
      btn.dataset.ttState = 'idle';
      updateComposeBtnLabel(btn);

      let resultEl = null;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const text = getComposeText(el).trim();
        if (!text) return;

        btn.dataset.ttState = 'loading';
        updateComposeBtnLabel(btn);
        const lang = getComposeLang();

        callTranslateApi(
          text,
          lang,
          (translated) => {
            btn.dataset.ttState = 'idle';
            updateComposeBtnLabel(btn);
            if (!resultEl) {
              resultEl = document.createElement('div');
              resultEl.className = 'tt-compose-result';
              resultEl.title = 'Click to insert into the compose box';
              btn.insertAdjacentElement('afterend', resultEl);
              resultEl.addEventListener('click', () => {
                insertTranslationIntoCompose(el, resultEl.textContent);
                resultEl.remove();
                resultEl = null;
              });
            }
            resultEl.textContent = translated;
          },
          (errMsg) => {
            btn.dataset.ttState = 'idle';
            updateComposeBtnLabel(btn);
            if (!resultEl) {
              resultEl = document.createElement('div');
              resultEl.className = 'tt-compose-result';
              btn.insertAdjacentElement('afterend', resultEl);
            }
            resultEl.textContent = '⚠️ Translation failed: ' + errMsg;
          }
        );
      });

      el.insertAdjacentElement('afterend', btn);
    });
  }

  function insertTranslationIntoCompose(el, translatedText) {
    if (el.tagName === 'TEXTAREA') {
      const current = el.value;
      const sep = current.endsWith('\n') || current === '' ? '' : '\n';
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      ).set;
      nativeSetter.call(el, current + sep + translatedText);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // contenteditable
      const br = document.createElement('br');
      const textNode = document.createTextNode(translatedText);
      el.appendChild(br);
      el.appendChild(textNode);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function init() {
    injectLangBar();
    processTweets();
    processComposeBoxes();
  }

  init();

  const observer = new MutationObserver(() => {
    injectLangBar();
    processTweets();
    processComposeBoxes();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
