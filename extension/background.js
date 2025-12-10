// background.js (MV3 service worker) - domain + page tracking, robust flush & token-check
const FLUSH_INTERVAL_MS = 30_000;    // flush every 30s
const MIN_SECONDS_TO_LOG = 5;        // ignore very short visits
const BATCH_THRESHOLD = 5;           // flush when >= N records
const STORAGE_KEY = 'activity_pending';
const TOKEN_KEY = 'user';            // { user: { token: '...' } } in chrome.storage.local
const BACKEND_TRACK_URL = 'http://localhost:5000/api/activity/track';

let prevUrl = '';
let prevTitle = '';
let prevDomain = '';
let startTime = Date.now();
let pending = [];   // [{ domain, url, title, date, duration }]
let authToken = null;
let isIdle = false;

console.log('BG: background.js ACTIVE', new Date().toISOString());

// -------------------- helpers --------------------
function extractHostname(url = '') {
  try { return new URL(url).hostname.replace(/^www\./,''); }
  catch { return 'unknown'; }
}
function todayISO() { return new Date().toISOString().slice(0,10); }
function nowSeconds() { return Math.floor(Date.now()/1000); }

function persistPending() {
  try {
    chrome.storage.local.set({ [STORAGE_KEY]: pending }, () => {});
  } catch (e) {
    console.warn('BG: persist error', e);
  }
}

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() / 1000 > payload.exp;
  } catch (e) {
    return true;
  }
}

// normalize a record before sending to backend
function formatRecordForBackend(r) {
  return {
    domain: r.domain,
    url: r.url,
    title: r.title || '',
    duration: r.duration,
    date: r.date
  };
}

// -------------------- init --------------------
(async function init() {
  try {
    const s = await chrome.storage.local.get([STORAGE_KEY, TOKEN_KEY]);
    if (s[STORAGE_KEY]) pending = s[STORAGE_KEY];
    if (s[TOKEN_KEY]?.user?.token) authToken = s[TOKEN_KEY].user.token;
    console.log('BG: init restored', { pendingLength: pending.length, hasToken: !!authToken });
  } catch (e) {
    console.warn('BG: init error', e);
  }
})();

// -------------------- core tracking logic --------------------
// Credit the time for the previous active tab (if any) and start tracking the new tab (tabObj can be null)
function handleTabSwitch(tabObj) {
  const now = Date.now();
  const seconds = Math.floor((now - startTime) / 1000);

  // If there was a previous tab and it lasted long enough, queue it
  if (prevUrl && !isIdle && seconds >= MIN_SECONDS_TO_LOG) {
    pending.push({
      domain: prevDomain || extractHostname(prevUrl),
      url: prevUrl,
      title: prevTitle || '',
      date: todayISO(),
      duration: seconds
    });
    persistPending();
    console.log('BG: queued', prevDomain || extractHostname(prevUrl), seconds, 'pending:', pending.length);
  }

  // Set new "previous" to the new tab (so next switch credits this one)
  if (tabObj && tabObj.url) {
    prevUrl = tabObj.url;
    prevTitle = tabObj.title || '';
    prevDomain = extractHostname(tabObj.url);
    startTime = now;
    isIdle = false;
  } else {
    // no active tab (window lost focus / idle)
    prevUrl = '';
    prevTitle = '';
    prevDomain = '';
    startTime = now;
    isIdle = true;
  }

  if (pending.length >= BATCH_THRESHOLD) flushPending();
  console.log('BG: handling tab switch ->', tabObj?.url ?? 'none');
}

// -------------------- flush --------------------
async function flushPending() {
  // short-circuit: nothing to do
  if (!pending || pending.length === 0) return;

  // require auth token
  if (!authToken) {
    console.warn('BG: no authToken, skipping flush');
    return;
  }

  // clear expired token & avoid spamming backend
  if (isTokenExpired(authToken)) {
    console.warn('BG: authToken expired — clearing stored token');
    authToken = null;
    await chrome.storage.local.remove(TOKEN_KEY);
    return;
  }

  // pull all records and persist remaining (we remove them optimistically)
  const records = pending.splice(0, pending.length);
  persistPending();

  const formatted = records.map(r => formatRecordForBackend({
    domain: r.domain,
    url: r.url,
    title: r.title,
    duration: r.duration,
    date: r.date
  }));

  try {
    console.log('BG: flushing', formatted.length, 'records to', BACKEND_TRACK_URL);
    const res = await fetch(BACKEND_TRACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ records: formatted })
    });

    const text = await res.text();
    console.log('BG: flush response', res.status, text);

    if (!res.ok) {
      // restore records on failure
      pending = records.concat(pending);
      persistPending();
      console.warn('BG: flush failed status', res.status);
      if (res.status === 401 || res.status === 403) {
        // token likely invalid - clear it so we don't keep trying with the same token
        console.warn('BG: server returned 401/403 — clearing token');
        authToken = null;
        await chrome.storage.local.remove(TOKEN_KEY);
      }
    } else {
      console.log('BG: flush succeeded');
    }
  } catch (err) {
    // restore records on network error
    pending = records.concat(pending);
    persistPending();
    console.warn('BG: network error flushing', err && err.message);
  }
}

// -------------------- listeners --------------------

// Tab activated
chrome.tabs.onActivated.addListener(async activeInfo => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    handleTabSwitch(tab);
  } catch (e) {
    handleTabSwitch(null);
  }
});

// Tab updated (complete navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab?.url) {
    handleTabSwitch(tab);
  }
});

// Window focus changes
chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    handleTabSwitch(null);
    return;
  }
  try {
    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs && tabs[0]) handleTabSwitch(tabs[0]);
    else handleTabSwitch(null);
  } catch (e) {
    handleTabSwitch(null);
  }
});

// Idle detection
if (chrome.idle) {
  chrome.idle.setDetectionInterval(60);
  chrome.idle.onStateChanged.addListener(state => {
    if (state === 'idle' || state === 'locked') {
      isIdle = true;
      handleTabSwitch(null); // credit time up to idle
    } else if (state === 'active') {
      isIdle = false;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) handleTabSwitch(tabs[0]);
      });
    }
  });
}

// message listener (set/clear token, debug, force flush)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'SET_TOKEN') {
        authToken = msg.token;
        await chrome.storage.local.set({ [TOKEN_KEY]: { user: { token: authToken } } });
        console.log('BG: token set');
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === 'CLEAR_TOKEN') {
        authToken = null;
        await chrome.storage.local.remove(TOKEN_KEY);
        console.log('BG: token cleared');
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === 'DEBUG_STORAGE') {
        const s = await chrome.storage.local.get(null);
        sendResponse({ ok: true, store: s });
        return;
      }

      if (msg?.type === 'DEBUG_FLUSH_NOW') {
        await flushPending();
        sendResponse({ ok: true, flushed: true });
        return;
      }

      sendResponse({ ok: false, err: 'unknown message' });
    } catch (e) {
      sendResponse({ ok: false, err: e?.message });
    }
  })();

  return true; // indicate async sendResponse
});

// restore token on startup if service worker restarted
chrome.storage.local.get(TOKEN_KEY).then(s => {
  if (s[TOKEN_KEY]?.user?.token) {
    authToken = s[TOKEN_KEY].user.token;
    console.log('BG: restored token from storage');
  }
}).catch(()=>{});

// periodic flush / keepalive
setInterval(() => {
  // credit time for the current tab so short-lived tabs aren't missed
  const now = Date.now();
  const seconds = Math.floor((now - startTime) / 1000);
  // do not queue here — we'll rely on tab switching to queue, but still attempt flush
  flushPending();
}, FLUSH_INTERVAL_MS);

// ensure pending is persisted on unload (best-effort)
self.addEventListener('unload', () => {
  persistPending();
});
