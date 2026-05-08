const activeMenuKeydownHandlers = new Set();

document.addEventListener('load', async function () {
    const isBluebird =
        !!window.electronAPI ||
        navigator.userAgent.includes("BluebirdBrowser");
    console.log(isBluebird);

    document.getElementById('see-all-history').onclick = async () => {
        showPopupSearchable(
            await getAllHistory(localStorage.getItem('currentProfile')),
            "History Manager",
            "history",
            {
                profile: localStorage.getItem('currentProfile'),
                fallbackFavicon: "history",
                deleteRange: ms => deleteHistoryRange(localStorage.getItem('currentProfile'), ms)
            }
        );
    }
    document.getElementById('see-all-bookmarks').onclick = async () => {
        showPopupSearchable(
            getBookmarks(localStorage.getItem('currentProfile')),
            "Bookmarks Manager",
            "bookmarks",
            {
                profile: localStorage.getItem('currentProfile'),
                fallbackFavicon: "bookmarks"
            }
        );
    }

    // Load theme

    const settings = {};
    settingsArray.forEach(({ key, value }) => {
        settings[key] = value;
    });

    let theme = settings.theme;
    if (typeof theme === 'string') {
        try {
            theme = JSON.parse(theme);
        } catch (e) {
            console.warn('Failed to parse theme:', e);
            theme = {};
        }
    } else if (Array.isArray(theme)) {
        theme = Object.fromEntries(theme.map(t => [t.key, t.value]));
    } else if (typeof theme === 'object' && theme !== null) {
        // already object
    } else {
        theme = {};
    }
    Object.entries(theme).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--${key}`, value);
    });

    // System Theme
    document.body.style.colorScheme = settings.systemTheme;

    setTimeout(async function () {
        await renderCardItems();
        document.getElementById('search-suggestion').focus();
    }, 1000)
})

window.addEventListener('scroll', function () {
    const y = window.scrollY;
    const cont = document.getElementById('s-i');

    if (y > 270) {
        cont.style.position = 'fixed';
        cont.style.zIndex = '5';
    } else {
        cont.style.position = 'static';
        cont.style.zIndex = '0';
    }
});

document.addEventListener('focus', async function () {
    await renderCardItems()
})

setInterval(async function () {
    await renderCardItems();
}, 1200)

async function renderCardItems() {
    const bookmarksCont = document.getElementById('all-bookmarks')
    const historyCont = document.getElementById('all-history')

    const bookmarks = getBookmarks(localStorage.getItem('currentProfile'))
    const history = await getHistoryProfile(localStorage.getItem('currentProfile'), 10)

    if (!bookmarks && !history) {
        return
    }

    bookmarksCont.innerHTML = ``
    historyCont.innerHTML = ``

    if (history.length) {
        history.forEach(item => {
            const hisElem = document.createElement('button');
            hisElem.classList.add('his-book-button');
            hisElem.onclick = () => {
                window.open(item.url)
            }

            // Image
            const img = item.favicon
                ? Object.assign(document.createElement('img'), { src: item.favicon })
                : Object.assign(document.createElement('i'), {
                    className: 'material-symbols-rounded',
                    textContent: 'history'
                });

            // Text container
            const span = document.createElement('span');

            // Line 1
            const p1 = document.createElement('p');
            p1.textContent = item.title || item.url;

            // Line 2
            const p2 = document.createElement('p');
            p2.textContent = item.title ? getBaseURL(item.url) : '';

            // Build structure
            span.appendChild(p1);
            span.appendChild(p2);

            hisElem.appendChild(img);
            hisElem.appendChild(span);

            historyCont.appendChild(hisElem);
        });
    } else {
        historyCont.innerHTML = `
            <div class="centered-message>
                <div>
                    <h1><i class="material-symbols-rounded">history_off</i></h1>
                    <p>There is no history left behind</p>
                </div>
            </div>"`
    }

    bookmarks.forEach(item => {
        const hisElem = document.createElement('button');
        hisElem.classList.add('his-book-button');

        hisElem.onclick = () => {
            window.open(item.url)
        }

        const img = item.favicon
            ? Object.assign(document.createElement('img'), { src: item.favicon })
            : Object.assign(document.createElement('i'), {
                className: 'material-symbols-rounded',
                textContent: 'bookmarks'
            });

        // Text container
        const span = document.createElement('span');

        // Line 1
        const p1 = document.createElement('p');
        p1.textContent = item.title || item.url;

        // Line 2
        const p2 = document.createElement('p');
        p2.textContent = item.title ? getBaseURL(item.url) : '';

        // Build structure
        span.appendChild(p1);
        span.appendChild(p2);

        hisElem.appendChild(img);
        hisElem.appendChild(span);

        bookmarksCont.appendChild(hisElem);
    });
}

function getBaseURL(url) {
    try {
        // Normal URLs (https, http, ftp, etc.)
        const u = new URL(url);
        return u.origin.replace(/^https?:\/\//, '');
    } catch {
        if (url.startsWith('file://')) {
            return 'file://';
        }
        return url; // fallback
    }
}


// const settingsBtn = document.getElementById('settings-btn')

// settingsBtn.onclick = () => {
//     if (window.electronAPI?.openSidebarApp) {
//         window.electronAPI.send('sidebar:open-app', {
//             app: 'settings'
//         });

//     } else {
//         console.log("Sidebar not available — running fallback");
//     }
// }

document.getElementById('send').onclick = () => {
    const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true
    });

    address.dispatchEvent(enterEvent);
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BrowserProfilesDB', 5);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('profiles')) {
                db.createObjectStore('profiles', { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('themes')) {
                db.createObjectStore('themes', { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains('permissions')) {
                db.createObjectStore('permissions', { keyPath: 'url' });
            }
            if (!db.objectStoreNames.contains('history')) {
                db.createObjectStore('history', { autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('bookmarks')) {
                db.createObjectStore('bookmarks', { autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('tabs')) {
                db.createObjectStore('tabs', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('window_bounds')) {
                db.createObjectStore('window_bounds', { keyPath: 'profile' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function transactionDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Transaction error'));
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
}

const address = document.getElementById('search-suggestion');
let suggestionsBox = document.getElementById('suggestions');

function ensureSuggestionsBox() {
    if (suggestionsBox) return suggestionsBox;
    suggestionsBox = document.createElement('div');
    suggestionsBox.id = 'suggestions';
    suggestionsBox.setAttribute('role', 'listbox');
    suggestionsBox.style.position = 'fixed';
    suggestionsBox.style.display = 'none';
    suggestionsBox.style.zIndex = '9997';
    suggestionsBox.style.background = '#2a2b2f';
    suggestionsBox.style.border = '1px solid #444';
    suggestionsBox.style.borderRadius = '8px';
    suggestionsBox.style.padding = '4px 0';
    suggestionsBox.style.maxHeight = '320px';
    suggestionsBox.style.overflow = 'auto';
    document.body.appendChild(suggestionsBox);
    return suggestionsBox;
}

const SUGGESTION_LIMIT = 10;
const DEBOUNCE_MS = 500;
const COMMON_TLDS = ['com', 'org', 'net', 'io', 'gov', 'edu', 'co', 'us', 'uk', 'dev', 'app', 'ai', 'info', 'biz', 'me', 'tech'];

let suggestions = [];
let selectedIndex = -1;
let suggestionTimer = null;

function getBookmarks(profile) {
    const raw = localStorage.getItem(bookmarksKey(profile));
    return raw ? JSON.parse(raw) : [];
}

function bookmarksKey(profile) { return `bookmarks:${profile}`; }

function getBookmarksProfile(profile = 'Default') {
    try { return getBookmarks(profile) || []; } catch (e) { return []; }
}

function removeBookmark(profile, url) {
    const list = getBookmarks(profile).filter(b => b.url !== url);
    localStorage.setItem(bookmarksKey(profile), JSON.stringify(list));
}

async function getAllHistory(profile) {
    const db = await openDB();
    const tx = db.transaction('history', 'readonly');
    const store = tx.objectStore('history');

    const res = await promisifyRequest(store.getAll());

    // Filter by profile BEFORE sorting
    const history = (res || [])
        .filter(item => item.profile === profile)
        .sort((a, b) => b.visitedAt - a.visitedAt)

    await transactionDone(tx);

    return history;
}

async function getHistoryProfile(profile, limit = 50) {
    const db = await openDB();
    const tx = db.transaction('history', 'readonly');
    const store = tx.objectStore('history');

    const res = await promisifyRequest(store.getAll());

    // Filter by profile BEFORE sorting
    const history = (res || [])
        .filter(item => item.profile === profile)
        .sort((a, b) => b.visitedAt - a.visitedAt)
        .slice(0, limit);

    await transactionDone(tx);

    return history;
}

function openUrlOrSearch(urlOrSearch) {
    if (typeof performSearch === 'function') performSearch(urlOrSearch);
    else window.location.href = urlOrSearch;
}

function escapeHtml(str = '') {
    return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function looksLikeUrl(input) {
    if (!input || !input.trim()) return false;
    input = input.trim();
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(input)) return true;
    const hostMatch = input.match(/^([^\s\/?#]+)([\/?#].*)?$/);
    if (hostMatch) {
        const host = hostMatch[1].toLowerCase();
        const hostNoPort = host.split(':')[0];
        const labels = hostNoPort.split('.');
        if (labels.length >= 2) {
            const last = labels[labels.length - 1];
            const secondLast = labels[labels.length - 2];
            if (COMMON_TLDS.includes(last)) return true;
            if ((secondLast === 'co' || secondLast === 'gov' || secondLast === 'ac') && labels.length >= 3) return true;
        }
    }
    if (/\S+\.\S+/.test(input) && !/\s/.test(input)) return true;
    return false;
}

function looksLikeIp(input) {
    return /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test((input || '').trim());
}

function normalizeUrl(input) {
    input = (input || '').trim();
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return input;
    if (input.startsWith('//')) return input;
    if (input.startsWith('file://')) return input;
    if (input.startsWith('view-source:')) return input;
    return 'https://' + input;
}

function makeSearchUrl(query, engine = 'google') {
    const q = encodeURIComponent(query);
    switch (engine) {
        case 'ddg': return `https://duckduckgo.com/?q=${q}`;
        case 'bing': return `https://www.bing.com/search?q=${q}`;
        default: return `https://www.google.com/search?q=${q}`;
    }
}

function createIconNode(suggestion) {
    const wrapper = document.createElement('div');
    wrapper.className = 'icon';
    switch (suggestion.type) {
        case 'url': wrapper.innerHTML = `<span class="material-symbols-rounded">link</span>`; break;
        case 'file': wrapper.innerHTML = `<span class="material-symbols-rounded">file_open</span>`; break;
        case 'ip': wrapper.innerHTML = `<span class="material-symbols-rounded">bring_your_own_ip</span>`; break;
        case 'search': wrapper.innerHTML = `<span class="material-symbols-rounded">search</span>`; break;
        case 'search-ai': wrapper.innerHTML = `<span class="material-symbols-rounded">auto_awesome</span>`; break;
        case 'action': wrapper.innerHTML = `<span class="material-symbols-rounded">bolt</span>`; break;
        case 'bookmark': wrapper.innerHTML = `<span class="material-symbols-rounded">bookmark</span>`; break;
        case 'history': wrapper.innerHTML = `<span class="material-symbols-rounded">history</span>`; break;
        case 'contact': wrapper.innerHTML = `<span class="material-symbols-rounded">person</span>`; break;
        case 'tag': wrapper.innerHTML = `<span class="material-symbols-rounded">label</span>`; break;
        case 'custom': wrapper.innerHTML = `<span class="material-symbols-rounded">link</span>`; break;
        default: wrapper.innerHTML = '•';
    }
    return wrapper;
}

let _prefixesCache = null;

async function _readPrefixesFromSettings() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('settings', 'readonly');
            const store = tx.objectStore('settings');
            const req = store.get('prefixes');
            req.onsuccess = () => {
                const rec = req.result;
                const arr = (rec && Array.isArray(rec.value)) ? rec.value.slice() : [];
                _prefixesCache = arr;
                resolve(arr);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        _prefixesCache = [];
        return [];
    }
}

async function getUserPrefixes() {
    if (_prefixesCache) return _prefixesCache.slice();
    return await _readPrefixesFromSettings();
}

async function saveUserPrefix(entry) {
    if (!entry || typeof entry.prefix !== 'string') throw new Error('Invalid prefix entry');
    const normalized = { prefix: entry.prefix, name: entry.name || '', value: entry.value || '' };
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const getReq = store.get('prefixes');
        getReq.onsuccess = () => {
            const rec = getReq.result;
            const list = (rec && Array.isArray(rec.value)) ? rec.value.slice() : [];
            const idx = list.findIndex(p => p.prefix === normalized.prefix);
            if (idx >= 0) list[idx] = normalized; else list.push(normalized);
            const putReq = store.put({ key: 'prefixes', value: list });
            putReq.onsuccess = () => { _prefixesCache = list.slice(); resolve(true); };
            putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

async function deleteUserPrefix(prefix) {
    if (!prefix) throw new Error('prefix required');
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const getReq = store.get('prefixes');
        getReq.onsuccess = () => {
            const rec = getReq.result;
            const list = (rec && Array.isArray(rec.value)) ? rec.value.slice() : [];
            const newList = list.filter(p => p.prefix !== prefix);
            const putReq = store.put({ key: 'prefixes', value: newList });
            putReq.onsuccess = () => { _prefixesCache = newList.slice(); resolve(true); };
            putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

async function setAllUserPrefixes(list) {
    if (!Array.isArray(list)) throw new Error('list must be an array');
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const putReq = store.put({ key: 'prefixes', value: list.slice() });
        putReq.onsuccess = () => { _prefixesCache = list.slice(); resolve(true); };
        putReq.onerror = () => reject(putReq.error);
    });
}

function getBuiltInPrefixes() {
    return [
        { prefix: '!ai', name: 'Google AI', value: 'google-ai' },
        { prefix: '!', name: 'Commands', value: 'actions' },
        { prefix: '@', name: 'Mentions', value: 'contacts' },
        { prefix: '#', name: 'Tags', value: 'tags' }
    ];
}

function makeGoogleAISearchUrl(query) {
    const base = "https://www.google.com/search";
    const params = new URLSearchParams({ q: query, udm: "50", aep: "1", newwindow: "1" });
    return `${base}?${params.toString()}`;
}

function buildActionSuggestions(command) {
    const actions = [
        { key: "newtab", label: "Open New Tab", icon: "➕", text: "about:newtab", onClick: () => createNewTab?.() },
        { key: "settings", label: "Open Settings", icon: "⚙️", text: "app://settings", onClick: () => openSettings?.() },
        { key: "history", label: "Show History", icon: "📜", text: "app://history", onClick: () => openHistory?.() },
        { key: "bookmarks", label: "Open Bookmarks", icon: "🔖", text: "app://bookmarks", onClick: () => openBookmarks?.() }
    ];
    const cmd = (command || '').toLowerCase();
    const matches = actions.filter(a => a.key.startsWith(cmd));
    return matches.map(a => ({ text: a.text, label: a.label, type: 'action', sub: 'Command', icon: a.icon, onClick: a.onClick }));
}

function buildMentionSuggestions(query) {
    const contacts = (typeof getContactsProfile === 'function') ? getContactsProfile() : [];
    const q = (query || '').toLowerCase();
    const matches = contacts.filter(c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
    return matches.map(c => ({ text: c.email || c.name, label: c.name || c.email, type: 'contact', sub: 'Contact', icon: '👤' }));
}

function buildTagSuggestions(query) {
    const tags = ['work', 'music', 'projects', 'ideas', 'personal'];
    const q = (query || '').toLowerCase();
    const matches = tags.filter(t => t.startsWith(q));
    return matches.map(t => ({ text: `#${t}`, label: `Filter by tag "${t}"`, type: 'tag', sub: 'Tag', icon: '🏷️' }));
}

async function fetchDuckDuckGoSuggestions(query) {
    if (!query || looksLikeUrl(query) || looksLikeIp(query)) return [];
    try {
        const res = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`);
        if (!res.ok) return [];
        const data = await res.json();
        let phrases = [];
        if (Array.isArray(data)) {
            if (data.length >= 2 && Array.isArray(data[1])) phrases = data[1].filter(s => typeof s === 'string' && s.trim().length);
            else phrases = data.filter(s => typeof s === 'string' && s.trim().length);
        } else if (data && Array.isArray(data.results)) {
            phrases = data.results.map(item => item && (item.phrase || item.title || item.text)).filter(s => typeof s === 'string' && s.trim().length);
        }
        if (!phrases.length) return [];
        return phrases.map(p => ({ text: `https://google.com/search?q=${encodeURIComponent(p)}`, label: p, type: 'search', sub: 'Search Suggestion' }));
    } catch (err) {
        return [];
    }
}

async function buildSuggestions(queryRaw) {
    const q = (queryRaw || '').trim();
    if (!q) return [];
    const results = [];
    const lower = q.toLowerCase();
    let userPrefixes = [];
    try { userPrefixes = await getUserPrefixes(); } catch (err) { userPrefixes = []; }
    const prefixes = [...getBuiltInPrefixes(), ...(userPrefixes || [])];
    prefixes.sort((a, b) => b.prefix.length - a.prefix.length);
    const matchedPrefix = prefixes.find(p => q.startsWith(p.prefix));
    if (matchedPrefix) {
        const rawAfter = q.slice(matchedPrefix.prefix.length);
        if (rawAfter === '') return [];
        const after = rawAfter.trim();
        const val = (matchedPrefix.value || '').toLowerCase();
        if (val === 'actions') {
            const actionResults = buildActionSuggestions(after);
            if (actionResults.length) return actionResults;
        }
        if (val === 'contacts') {
            const mentionResults = buildMentionSuggestions(after);
            if (mentionResults.length) return mentionResults;
        }
        if (val === 'tags') {
            const tagResults = buildTagSuggestions(after);
            if (tagResults.length) return tagResults;
        }
        if (val === 'google-ai') {
            return [{ text: makeGoogleAISearchUrl(after), label: `Search with Google AI for "${after}"`, type: 'search-ai', sub: 'Google AI' }];
        }
        if (val.startsWith('url:')) {
            const template = matchedPrefix.value.slice(4);
            const url = template.replace(/\{q\}/g, encodeURIComponent(after));
            return [{ text: url, label: matchedPrefix.name ? `${matchedPrefix.name}: ${after}` : url, type: 'custom', sub: matchedPrefix.name || 'Custom' }];
        }
    }
    const enginePrefix = (() => {
        const m = q.match(/^!(\w+)\s+(.*)/);
        if (m) return { engine: m[1].toLowerCase(), rest: m[2] || '' };
        return null;
    })();
    if (enginePrefix) {
        const eng = enginePrefix.engine === 'ddg' ? 'ddg' : enginePrefix.engine === 'bing' ? 'bing' : 'google';
        results.push({ text: makeSearchUrl(enginePrefix.rest, eng), label: `Search ${eng.toUpperCase()}: ${enginePrefix.rest}`, type: 'search', sub: eng });
    }
    if (looksLikeIp(q)) {
        results.push({ text: normalizeUrl(q), label: q, type: 'ip', sub: 'IP address' });
    }
    if (q.startsWith('file://')) {
        results.unshift({ text: q, label: q, type: 'file', sub: 'Local file' });
    } else if (looksLikeUrl(q)) {
        const normalized = normalizeUrl(q);
        results.unshift({ text: normalized, label: q, type: 'url', sub: normalized });
    }
    const bookmarks = (typeof getBookmarksProfile === 'function') ? getBookmarksProfile(localStorage.getItem('currentProfile'), 'Default') : [];
    for (const b of (bookmarks || [])) {
        if (!b || !b.url) continue;
        const title = (b.title || b.url).toString();
        if (title.toLowerCase().includes(lower) || b.url.toLowerCase().includes(lower)) results.push({ text: b.url, label: title, type: 'bookmark', sub: b.url });
    }
    const history = (typeof getHistoryProfile === 'function') ? await getHistoryProfile(50) : [];
    for (const h of (history || [])) {
        if (!h || !h.url) continue;
        const title = (h.title || h.url).toString();
        if (title.toLowerCase().includes(lower) || h.url.toLowerCase().includes(lower)) results.push({ text: h.url, label: title, type: 'history', sub: h.url });
    }
    results.push({ text: makeSearchUrl(q, 'google'), label: `Search Google for "${q}"`, type: 'search', sub: q });
    results.push({ text: makeGoogleAISearchUrl(q), label: `Search with Google AI for "${q}"`, type: 'search-ai', sub: 'Google AI' });
    if (!looksLikeUrl(q) && !looksLikeIp(q) && !q.startsWith('file://')) {
        const ddgSuggestions = await fetchDuckDuckGoSuggestions(q);
        results.push(...ddgSuggestions);
    }
    const seen = new Set();
    const final = [];
    for (const r of results) {
        if (!r || !r.text) continue;
        const key = r.text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        final.push(r);
        if (final.length >= SUGGESTION_LIMIT) break;
    }
    return final;
}

function renderSuggestions(list) {
    const box = ensureSuggestionsBox();
    suggestions = list || [];
    selectedIndex = -1;
    box.innerHTML = '';
    if (!suggestions.length) {
        box.style.display = 'none';
        box.setAttribute('aria-hidden', 'true');
        return;
    }
    suggestions.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'suggestion';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', 'false');
        row.dataset.index = i;
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '24px 1fr auto';
        row.style.gap = '8px';
        row.style.padding = '6px 10px';
        row.style.cursor = 'pointer';
        let icon = createIconNode(s);
        if (!icon) {
            icon = document.createElement('span');
            icon.className = 'fallback-icon';
            icon.innerHTML = `<i class="material-symbols-rounded">globe</i>`;
        }
        row.appendChild(icon);
        const labelWrap = document.createElement('div');
        labelWrap.style.display = 'flex';
        labelWrap.style.flexDirection = 'column';
        labelWrap.style.minWidth = '0';
        const label = document.createElement('div');
        label.className = 'label';
        label.innerHTML = escapeHtml(s.label || s.text);
        label.style.whiteSpace = 'nowrap';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        labelWrap.appendChild(label);
        if (s.sub) {
            const sub = document.createElement('div');
            sub.className = 'sub';
            sub.textContent = s.sub;
            sub.style.fontSize = '12px';
            sub.style.opacity = '0.7';
            labelWrap.appendChild(sub);
        }
        row.appendChild(labelWrap);
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = s.type;
        meta.style.opacity = '0.6';
        meta.style.fontSize = '12px';
        row.appendChild(meta);
        row.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            acceptSuggestion(i);
        });
        row.addEventListener('mousemove', () => setHighlight(i));
        row.addEventListener('mouseenter', () => row.style.background = '#3a3f45');
        row.addEventListener('mouseleave', () => row.style.background = 'transparent');
        box.appendChild(row);
    });
    const rect = (typeof document.getElementById('s-i') !== 'undefined' && document.getElementById('s-i') && typeof document.getElementById('s-i').getBoundingClientRect === 'function') ? document.getElementById('s-i').getBoundingClientRect() : null;
    if (rect) {
        box.style.position = 'fixed';
        box.style.top = `${rect.bottom}px`;
        box.style.left = `${rect.left}px`;
        box.style.width = `${rect.width}px`;
        box.style.display = 'block';
        box.setAttribute('aria-hidden', 'false');
    } else {
        box.style.position = 'fixed';
        box.style.top = '48px';
        box.style.left = '8px';
        box.style.width = '320px';
        box.style.display = 'block';
        box.setAttribute('aria-hidden', 'false');
    }
}

function setHighlight(i) {
    const box = ensureSuggestionsBox();
    const nodes = box.querySelectorAll('.suggestion');
    nodes.forEach((n) => {
        n.classList.remove('highlight');
        n.setAttribute('aria-selected', 'false');
    });
    if (i >= 0 && nodes[i]) {
        nodes[i].classList.add('highlight');
        nodes[i].setAttribute('aria-selected', 'true');
        selectedIndex = i;
    } else {
        selectedIndex = -1;
    }
}

function acceptSuggestion(i) {
    const s = suggestions[i];
    if (!s) return;
    if (address) address.value = s.text;
    suggestions = [];
    renderSuggestions([]);
    if (s.onClick && typeof s.onClick === 'function') {
        try { s.onClick(); } catch (e) { }
    } else {
        openUrlOrSearch(s.text);
    }
}

function hideSuggestions() {
    const box = ensureSuggestionsBox();
    suggestions = [];
    selectedIndex = -1;
    box.innerHTML = '';
    box.style.display = 'none';
    box.setAttribute('aria-hidden', 'true');
}

function onAddressInputChange(q) {
    clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(async () => {
        try {
            const list = await buildSuggestions(q);
            renderSuggestions(list);
        } catch (err) {
            console.error('Suggestion error:', err);
            hideSuggestions();
        }
    }, DEBOUNCE_MS);
}

// Wire address behaviors
if (address) {
    address.addEventListener('focus', () => {
        setTimeout(() => {
            address.dispatchEvent(new Event('input', { bubbles: true }));
        }, 150);
    });

    address.addEventListener("blur", function () {
        setTimeout(function () {
            clearTimeout(suggestionTimer);
            const q = address.value.trim();
            if (!q) {
                hideSuggestions();
                return;
            }
            const box = ensureSuggestionsBox();
            box.innerHTML = '';
            box.style.display = 'none';
            box.setAttribute('aria-hidden', 'true');
        }, 200);
    });

    address.addEventListener('input', () => {
        clearTimeout(suggestionTimer);
        const q = address.value.trim();
        if (!q) {
            hideSuggestions();
            document.getElementById('send').style.opacity = '0.2'
            return;
        }

        suggestionTimer = setTimeout(async () => {
            try {
                let list
                if (q.startsWith(('!' || '@'))) {
                    null
                } else {
                    list = await buildSuggestions(q);
                }
                renderSuggestions(list);
                document.getElementById('send').style.opacity = '1'
            } catch (err) {
                console.error('Suggestion error:', err);
                hideSuggestions();
                document.getElementById('send').style.opacity = '0.2'
            }
        }, DEBOUNCE_MS);
    });

    address.addEventListener('keydown', (e) => {
        const box = ensureSuggestionsBox();
        const nodes = box.querySelectorAll('.suggestion');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(selectedIndex + 1, nodes.length - 1);
            setHighlight(next);
            nodes[next]?.scrollIntoView({ block: 'nearest' });
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = Math.max(selectedIndex - 1, 0);
            setHighlight(prev);
            nodes[prev]?.scrollIntoView({ block: 'nearest' });
            return;
        }

        if (e.key === 'Tab') {
            // Let Tab move focus naturally; if you want Tab to navigate suggestions, change here:
            hideSuggestions();
            return;
        }

        if (e.key === 'Escape') {
            hideSuggestions();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const val = address.value.trim();
            if (!val) return;

            address.blur();

            const openInNewTab = e.shiftKey;

            const target = selectedIndex >= 0 ? suggestions[selectedIndex]?.text : val;
            const isUrl = looksLikeUrl(target) || looksLikeIp(target);
            const finalUrl = isUrl ? normalizeUrl(target) : makeSearchUrl(target);

            var a = document.createElement('a')
            a.href = finalUrl

            if (openInNewTab) {
                a.target = '_blank'
            } else {
                a.target = '_top'
            }

            document.body.appendChild(a);
            a.click();
            a.remove();

            hideSuggestions();
        }
    });

    document.addEventListener('click', (e) => {
        const box = ensureSuggestionsBox();
        if (!box.contains(e.target) && e.target !== address) hideSuggestions();
    });
}

/**
 * Unified searchable popup for history and bookmarks.
 *
 * @param {Array} array - items to show (history or bookmarks)
 * @param {string} title - popup title
 * @param {'history'|'bookmarks'} mode - mode
 * @param {Object} info - extra info:
 *   - profile: current profile id (required for delete/remove callbacks)
 *   - fallbackFavicon: icon name for fallback
 *   - deleteRange: optional function(profile, ms) => Promise to delete history range
 *   - onDelete: optional function() called after deletion to let caller refresh data
 */

let popup
/**
 * showPopupSearchable(array, title, mode, info)
 *
 * - array: array of items (history or bookmarks)
 * - title: string title for popup
 * - mode: "history" or "bookmarks"
 * - info: {
 *     profile,                // profile id used for deletes/removes
 *     fallbackFavicon,        // fallback icon text
 *     deleteRange: fn(profile, ms) optional override,
 *     onDelete: fn() optional callback after deletes,
 *     open: fn(url) optional open handler
 *   }
 */
function showPopupSearchable(array, title, mode, info = {}) {
    if (!Array.isArray(array)) array = Array.from(array || []);

    // --- create backdrop & popup --------------------------------------------
    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
        background: "rgba(0,0,0,0.4)",
        position: "fixed",
        inset: "0",
        zIndex: "9999",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        boxSizing: "border-box"
    });
    backdrop.addEventListener("click", e => { if (e.target === backdrop) backdrop.remove(); });

    const popup = document.createElement("div");
    popup.classList.add("popup-centered-like-browser");

    // header
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    const titleEl = document.createElement("h3");
    titleEl.textContent = title || (mode === "history" ? "History" : "Bookmarks");
    titleEl.style.margin = "0";

    const i = document.createElement('iframe');
    i.src = `../managers/index.html?manager=${mode}`;
    i.style.width = '100%';
    i.style.height = '100%';
    document.body.appendChild(i);


    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = `<i class="material-symbols-rounded">close</i>`;
    closeBtn.onclick = () => backdrop.remove();

    // header.appendChild(titleEl);
    popup.appendChild(closeBtn);
    // popup.appendChild(header);
    popup.appendChild(i)

    // mount and initial render
    backdrop.appendChild(popup);
    document.body.appendChild(backdrop);
}

function createContextMenu(items = [], elementClicked = null, x = 0, y = 0, removeWhenClicked, passThru = {}) {
    removeContextMenus();

    setTimeout(function () {
        const backdrop = document.createElement('div');
        backdrop.classList.add('context-menu-backdrop');
        Object.assign(backdrop.style, {
            width: '100%',
            height: '100vh',
            left: '0',
            top: '0',
            position: 'fixed',
            zIndex: '9998'
        });
        backdrop.onclick = () => removeContextMenus();
        document.body.appendChild(backdrop);

        const contextMenu = document.createElement('div');
        contextMenu.classList.add('context-menu');
        document.body.appendChild(contextMenu);

        let top = y;
        let left = x;
        if (elementClicked) {
            const rect = elementClicked.getBoundingClientRect();
            top = rect.bottom + window.scrollY;
            left = rect.left + window.scrollX;
        }

        contextMenu.style.visibility = 'hidden';
        contextMenu.style.opacity = '0';
        contextMenu.style.pointerEvents = 'none';

        requestAnimationFrame(() => {
            const menuRect = contextMenu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (left + menuRect.width > viewportWidth) {
                left = Math.max(0, viewportWidth - menuRect.width);
            }
            if (top + menuRect.height > viewportHeight) {
                top = Math.max(0, viewportHeight - menuRect.height);
            }

            contextMenu.style.top = `${top}px`;
            contextMenu.style.left = `${left}px`;
            contextMenu.style.visibility = 'visible';
            contextMenu.style.opacity = '1';
            contextMenu.style.pointerEvents = 'auto';
        });

        let currentCategory = null;
        const buildItems = (list, parent) => {
            list.forEach(({ icon, icType, name, shortcut, category, submenu, disabled, function: callback, id }) => {
                if (category && category !== currentCategory) {
                    currentCategory = category;
                    const catDiv = document.createElement('div');
                    catDiv.classList.add('context-menu-category');
                    catDiv.textContent = category;
                    parent.appendChild(catDiv);
                }

                const item = document.createElement('div');
                item.classList.add('context-menu-item');
                item.id = id || '';

                if (icType == 'GF') {
                    icon = `<i class="material-symbols-rounded">${icon}</i>`
                } else if (!icType) {
                    icon = icon
                }

                const leftSpan = document.createElement('span');
                leftSpan.innerHTML = `${icon ? `<span class="icon" style="margin-right:6px">${icon}</span>` : ''}${name}`;
                item.appendChild(leftSpan);

                if (submenu) {
                    const arrow = document.createElement('span');
                    arrow.textContent = '▶';
                    arrow.style.opacity = '0.6';
                    item.appendChild(arrow);

                    const subMenu = document.createElement('div');
                    subMenu.classList.add('context-submenu');

                    buildItems(submenu, subMenu);
                    item.appendChild(subMenu);

                    item.addEventListener('mouseenter', () => {
                        subMenu.style.opacity = '1';
                        subMenu.style.pointerEvents = 'auto';

                        if (!subMenu.dataset.positioned) {
                            const rect = subMenu.getBoundingClientRect();
                            const overflowRight = rect.right + 40 > window.innerWidth;
                            const overflowBottom = rect.bottom > window.innerHeight;

                            subMenu.style.left = overflowRight ? `-${rect.width}px` : '100%';
                            subMenu.style.top = overflowBottom ? `${window.innerHeight - rect.bottom - 10}px` : '0';

                            subMenu.dataset.positioned = 'true';
                        }
                    });

                    item.addEventListener('mouseleave', () => {
                        subMenu.style.opacity = '0';
                        subMenu.style.pointerEvents = 'none';
                    });
                } else {
                    if (shortcut) {
                        const right = document.createElement('span');
                        right.classList.add('shortcut');
                        right.textContent = shortcut;
                        right.style.opacity = '0.6';
                        item.appendChild(right);

                        const handler = (e) => {
                            const combo = [];
                            if (e.ctrlKey || e.metaKey) combo.push('Ctrl');
                            if (e.altKey) combo.push('Alt');
                            if (e.shiftKey) combo.push('Shift');
                            combo.push(e.key.toUpperCase());
                            if (combo.join('+') === shortcut.toUpperCase()) {
                                e.preventDefault();
                                callback?.(passThru);
                                removeContextMenus();
                            }
                        };
                        window.addEventListener('keydown', handler);
                        activeMenuKeydownHandlers.add(handler);
                    }

                    if (removeWhenClicked) {
                        item.addEventListener('click', (e) => {
                            e.stopPropagation();
                            callback?.(passThru);
                            removeContextMenus();
                        });
                    }

                }
                item.addEventListener('mouseenter', () => item.style.background = '#3a3f45');
                item.addEventListener('mouseleave', () => item.style.background = 'transparent');
                if (!disabled) {
                    parent.appendChild(item);
                }
            });
        };

        buildItems(items, contextMenu);

        //     setTimeout(() => {
        //         document.querySelector('context-menu-backdrop').addEventListener('click', removeContextMenus);
        //     }, 10);
        return contextMenu
    }, 50);
}

function removeContextMenus() {
    document.querySelectorAll('.context-menu').forEach(menu => menu.remove());

    document.querySelectorAll('.context-menu-backdrop').forEach(backdrop => backdrop.remove());

    document.querySelectorAll('.context-menu-backdrop').forEach(element => {
        element.removeEventListener('click', removeContextMenus);
    });

    for (const fn of activeMenuKeydownHandlers) {
        window.removeEventListener('keydown', fn);
    }
    activeMenuKeydownHandlers.clear();
}

const notificationQueue = [];
let isDisplaying = false;
let currentTimeout = null;

function displayNotification(message, icon = '', timeout = 5000, priority = 1) {
    const newNote = { message, icon, timeout, priority };
    notificationQueue.push(newNote);

    // Sort by priority (higher first)
    notificationQueue.sort((a, b) => b.priority - a.priority);

    processQueue();
}

function processQueue() {
    if (isDisplaying || notificationQueue.length === 0) return;

    const { message, icon, timeout } = notificationQueue.shift();
    const notification = document.getElementById('notification');

    // Reset animation state
    notification.style.transition = 'none';
    notification.style.transform = 'translate(-50%, 100%)';
    void notification.offsetHeight; // force reflow

    // Set content
    notification.innerHTML = `<i class="material-symbols-rounded">${icon}</i> ${message}`;

    // Animate in
    notification.style.transition = 'transform 0.3s';
    notification.style.transform = 'translate(-50%, -10px)';

    isDisplaying = true;

    if (currentTimeout) clearTimeout(currentTimeout);

    currentTimeout = setTimeout(() => {
        // Animate out
        notification.style.transform = 'translate(-50%, 100%)';

        setTimeout(() => {
            isDisplaying = false;
            processQueue();
        }, 300);
    }, timeout);
}