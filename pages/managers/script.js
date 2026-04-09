// ------------------------------
// Manager Type Detection
// ------------------------------
const params = new URLSearchParams(window.location.search);
const managerType = params.get("manager") || "bookmarks";

const container = document.getElementById("searchable-content");
const searchBar = document.getElementById("searchBar");
const sortNav = document.getElementById("sort-nav");
const navSpan = document.getElementById("clear-cont");

// In-memory cache of loaded items (used for search + bulk delete UI logic)
let currentItems = [];

// ------------------------------
// Loader
// ------------------------------
function showLoader(show) {
    if (show) {
        container.innerHTML = `
            <div class="loader">
                <svg class="load" viewBox="25 25 50 50">
                    <circle r="20" cy="50" cx="50"></circle>
                </svg>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const inIframe = window.self !== window.top;
    if (inIframe) {
        document.querySelector('nav').style.paddingRight = '80px'
    }

    const value = params.get('manager')
    const topLeft = document.getElementById('t-l-title')
    if (value == 'bookmarks') {
        topLeft.innerHTML = `
        <i class="material-symbols-rounded">bookmarks</i><h3>Bookmarks</h3>`
    } else if (value == 'history') {
        topLeft.innerHTML = `
        <i class="material-symbols-rounded">manage_history</i><h3>History</h3>`
    } else if (value == 'tabs') {
        topLeft.innerHTML = `
        <i class="material-symbols-rounded">tab</i><h3>Tabs</h3>`
    }
    document.querySelector('title').innerText = `${params.get('manager').toUpperCase()} - Browser Manager`
})

function getProfileByName(name) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("BrowserProfilesDB");

        request.onerror = () => resolve(null);

        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("profiles", "readonly");
            const store = tx.objectStore("profiles");

            const index = store.index("name");
            const query = index.get(name);

            query.onsuccess = () => resolve(query.result || null);
            query.onerror = () => resolve(null);
        };
    });
}

// ------------------------------
// LocalStorage Loader (Bookmarks)
// ------------------------------
function loadBookmarks() {
    const raw = localStorage.getItem(`bookmarks:${localStorage.getItem('currentProfile')}`);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// ------------------------------
// IndexedDB Loader (Tabs / History)
// ------------------------------
function loadIndexedDB(storeName) {
    return new Promise((resolve) => {
        const request = indexedDB.open("BrowserProfilesDB");

        request.onerror = () => { resolve([]); displayNotification('There was an error displaying data. Try again later.', 'error') };

        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) {
                resolve([]);
                return;
            }

            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const getAll = store.getAll();

            getAll.onsuccess = () => resolve(getAll.result || []);
            getAll.onerror = () => { resolve([]); displayNotification('There was an error displaying data. Try again later.', 'error') }
        };
    });
}

async function loadItems(storeName) {
    const request = indexedDB.open("BrowserProfilesDB");

    request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);

        const items = [];

        store.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor) {
                renderList(items);
                return;
            }

            items.push({
                ...cursor.value,
                id: cursor.key
            });

            cursor.continue();
        };
    };
}


// ------------------------------
// Timestamp Helper
// ------------------------------
function getItemTimestamp(item) {
    // Try common fields: lastVisited, createdAt, date, timestamp
    const candidate =
        item.lastVisited ||
        item.createdAt ||
        item.date ||
        item.timestamp ||
        item.visitedAt ||
        null;

    if (!candidate) return null;

    if (typeof candidate === "number") return candidate;

    const t = Date.parse(candidate);
    return Number.isNaN(t) ? null : t;
}

// ------------------------------
// Delete Functions (Single Item)
// ------------------------------
function deleteBookmark(id) {
    const raw = localStorage.getItem(`bookmarks:${localStorage.getItem('currentProfile')}`);
    if (!raw) return;

    try {
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;

        const filtered = arr.filter(item => item.createdAt !== id);
        localStorage.setItem(`bookmarks:${localStorage.getItem('currentProfile')}`, JSON.stringify(filtered));
        loadManager();
        displayNotification('Data Deleted', 'delete_forever')
    } catch {
        displayNotification('There was an error deleting bookmark data. Try again later.', 'error')
    }
}

window.deleteBookmark = deleteBookmark;

function deleteIndexedDBItem(storeName, id) {
    const request = indexedDB.open("BrowserProfilesDB");

    request.onerror = () => { displayNotification('There was an error deleting data. Try again later.', 'error') };

    request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) return;

        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.delete(id);

        tx.oncomplete = () => { loadManager(); displayNotification('Data Deleted', 'delete_forever') };
    };
}

// ------------------------------
// Delete by Time Range
// ------------------------------
function deleteByTimeRange({ mode, start, end }) {
    // mode: 'preset-last-hour' | 'preset-last-day' | 'preset-last-week' | 'all-time' | 'between' | 'before' | 'after'
    const now = Date.now();

    let rangeStart = null;
    let rangeEnd = null;

    if (mode === "preset-last-hour") {
        rangeStart = now - 60 * 60 * 1000;
        rangeEnd = now;
    } else if (mode === "preset-last-day") {
        rangeStart = now - 24 * 60 * 60 * 1000;
        rangeEnd = now;
    } else if (mode === "preset-last-week") {
        rangeStart = now - 7 * 24 * 60 * 60 * 1000;
        rangeEnd = now;
    } else if (mode === "all-time") {
        rangeStart = -Infinity;
        rangeEnd = Infinity;
    } else if (mode === "between") {
        rangeStart = start ?? -Infinity;
        rangeEnd = end ?? Infinity;
    } else if (mode === "before") {
        rangeStart = -Infinity;
        rangeEnd = end ?? Infinity;
    } else if (mode === "after") {
        rangeStart = start ?? -Infinity;
        rangeEnd = Infinity;
    }

    if (managerType === "bookmarks") {
        deleteBookmarksByTime(rangeStart, rangeEnd);
    } else if (managerType === "tabs" || managerType === "history") {
        const storeName = managerType === "tabs" ? "tabs" : "history";
        deleteIndexedDBByTime(storeName, rangeStart, rangeEnd);
    }
}

function timestampInRange(ts, start, end) {
    if (ts === null) return false; // if no timestamp, don't touch it
    return ts >= start && ts <= end;
}

// LocalStorage: delete bookmarks by time range
function deleteBookmarksByTime(start, end) {
    const raw = localStorage.getItem(`bookmarks:${localStorage.getItem('currentProfile')}`);
    console.log(`bookmarks:${localStorage.getItem('currentProfile')}`)
    if (!raw) return;

    try {
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;

        const kept = arr.filter(item => {
            const ts = getItemTimestamp(item);
            return !timestampInRange(ts, start, end);
        });

        localStorage.setItem(`bookmarks:${localStorage.getItem('currentProfile')}`, JSON.stringify(kept));
        loadManager();
        displayNotification('Bookmarks Deleted', 'delete_forever')
    } catch {
        displayNotification('There was an error deleting data. Try again later.', 'error')
        // ignore parse errors
    }
}

// IndexedDB: delete records by time range
function deleteIndexedDBByTime(storeName, start, end) {
    const request = indexedDB.open("BrowserProfilesDB");

    request.onerror = () => { displayNotification('There was an error deleting data. Try again later.', 'error') };

    request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) return;

        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        const cursorReq = store.openCursor();

        cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;

            const item = cursor.value;
            const ts = getItemTimestamp(item);

            if (timestampInRange(ts, start, end)) {
                cursor.delete();
            }
            cursor.continue();
        };

        tx.oncomplete = () => { loadManager(); displayNotification('Data Deleted', 'delete_forever') }
    };
}

// ------------------------------
// Render Bookmarks Tree
// ------------------------------
function renderBookmarksTree(bookmarks) {
    container.innerHTML = "";

    // Build tree structure
    const tree = { children: {}, bookmarks: [] };

    bookmarks.forEach(bm => {
        const folderPath = bm.folder || '';
        const parts = folderPath.split('/').filter(p => p);
        let current = tree;

        parts.forEach(part => {
            if (!current.children[part]) {
                current.children[part] = { children: {}, bookmarks: [] };
            }
            current = current.children[part];
        });

        current.bookmarks.push(bm);
    });

    // Render tree
    function renderNode(node, path = '', level = 0) {
        const containerDiv = document.createElement('div');
        containerDiv.style.marginLeft = `${level * 20}px`;

        // Render folders
        Object.keys(node.children).forEach(folderName => {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'bookmark-folder';
            folderDiv.innerHTML = `
                <span class="folder-toggle">
                    <i class="material-symbols-rounded">chevron_right</i>
                    <i class="material-symbols-rounded">folder</i>
                    ${folderName}
                </span>
            `;
            const contentDiv = document.createElement('div');
            contentDiv.className = 'folder-content';
            contentDiv.style.display = 'none';

            folderDiv.querySelector('.folder-toggle').onclick = () => {
                const isOpen = contentDiv.style.display !== 'none';
                contentDiv.style.display = isOpen ? 'none' : 'block';
                folderDiv.querySelector('.folder-toggle i:first-child').style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
            };

            renderNode(node.children[folderName], path + folderName + '/', level + 1).forEach(child => contentDiv.appendChild(child));

            containerDiv.appendChild(folderDiv);
            containerDiv.appendChild(contentDiv);
        });

        // Render bookmarks
        node.bookmarks.forEach(bm => {
            const div = document.createElement("div");
            div.className = "manager-item";

            div.innerHTML = `
                <span class="wrapper-1">
                    <span class="favicon">
                        ${bm.favicon && bm.favicon.startsWith("http") 
                            ? `<img src="${bm.favicon}">` 
                            : `<i class="material-symbols-rounded">globe</i>`}
                    </span>
                    <span class="wrapper">
                        <div class="info">
                            <h4>${bm.title || getBaseURL(bm.url) || "Untitled"}</h4>
                            <p>${getBaseURL(bm.url) || ""}</p>
                            <small>${new Date(bm.createdAt).toLocaleString()}</small>
                        </div>
                    </span>
                </span>
                <span style="gap: 40px;">
                    <button class="delete-btn material-symbols-rounded" onclick="deleteBookmark(${bm.createdAt})">delete</button>
                    <a class="open-btn material-symbols-rounded" href="${bm.url}" target="_blank">open_in_new</a>
                </span>
            `;

            containerDiv.appendChild(div);
        });

        return [containerDiv];
    }

    const treeElements = renderNode(tree);
    treeElements.forEach(el => container.appendChild(el));
}

// ------------------------------
// Render Items
// ------------------------------
function renderList(items) {
    container.innerHTML = "";

    if (!items) {
        container.textContent = "No items found.";
        return;
    }

    console.log(items)

    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "manager-item";

        // -------------------------
        // WRAPPER #1
        // -------------------------
        const wrapper1 = document.createElement("span");
        wrapper1.className = "wrapper-1";

        // -------------------------
        // FAVICON
        // -------------------------
        const favCont = document.createElement("span");
        favCont.className = "favicon";

        let favElem;
        if (item.favicon && item.favicon.startsWith("http")) {
            favElem = document.createElement("img");
            favElem.src = item.favicon;
        } else {
            favElem = document.createElement("i");
            favElem.classList.add("material-symbols-rounded");
            favElem.textContent = "globe";
        }
        favCont.appendChild(favElem);

        // -------------------------
        // WRAPPER #2
        // -------------------------
        const wrapper2 = document.createElement("span");
        wrapper2.className = "wrapper";

        const info = document.createElement("div");
        info.className = "info";

        const titleEl = document.createElement("h4");
        titleEl.textContent = item.title || getBaseURL(item.url) || "Untitled";

        const subtitleEl = document.createElement("p");
        subtitleEl.textContent = getBaseURL(item.url) || item.lastVisited || "";

        info.appendChild(titleEl);
        info.appendChild(subtitleEl);

        const ts = getItemTimestamp(item);
        if (ts) {
            const small = document.createElement("small");
            small.textContent = new Date(ts).toLocaleString();
            info.appendChild(small);
        }

        wrapper2.appendChild(info);
        wrapper1.appendChild(favCont);
        wrapper1.appendChild(wrapper2);

        // -------------------------
        // WRAPPER #3 (BUTTONS)
        // -------------------------
        const wrapper3 = document.createElement("span");
        wrapper3.style.gap = "40px";

        const openBtn = document.createElement("a");
        openBtn.className = "open-btn material-symbols-rounded";
        openBtn.innerHTML = "open_in_new";
        openBtn.href = item.url;
        openBtn.target = "_blank";

        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn material-symbols-rounded";
        delBtn.textContent = "delete";

        delBtn.onclick = () => {
            if (managerType === "bookmarks") deleteBookmark(item.createdAt);
            if (managerType === "tabs") deleteIndexedDBItem("tabs", item.id);
            if (managerType === "history") deleteIndexedDBItem("history", item.id);
        };

        wrapper3.appendChild(delBtn);
        wrapper3.appendChild(openBtn);

        // -------------------------
        // FINAL LAYOUT
        // -------------------------
        div.appendChild(wrapper1);
        div.appendChild(wrapper3);

        container.appendChild(div);
    });
}

// ------------------------------
// Sorting
// ------------------------------
function sortItems(items, type) {
    const copy = [...items];

    if (type === "A-Z") {
        return copy.sort((a, b) =>
            (a.title || "").localeCompare(b.title || "")
        );
    }

    if (type === "Z-A") {
        return copy.sort((a, b) =>
            (b.title || "").localeCompare(a.title || "")
        );
    }

    if (type === "latest") {
        return copy.sort(
            (a, b) => (getItemTimestamp(b) || 0) - (getItemTimestamp(a) || 0)
        );
    }

    if (type === "oldest") {
        return copy.sort(
            (a, b) => (getItemTimestamp(a) || 0) - (getItemTimestamp(b) || 0)
        );
    }

    return copy;
}

function sortDOM(type) {
    const nodes = [...container.querySelectorAll(".manager-item")];

    nodes.sort((a, b) => {
        const titleA = a.querySelector("h4")?.textContent || "";
        const titleB = b.querySelector("h4")?.textContent || "";

        if (type === "A-Z") return titleA.localeCompare(titleB);
        if (type === "Z-A") return titleB.localeCompare(titleA);

        const tsA = new Date(a.querySelector("small")?.textContent || 0).getTime();
        const tsB = new Date(b.querySelector("small")?.textContent || 0).getTime();

        if (type === "latest") return tsB - tsA;
        if (type === "oldest") return tsA - tsB;

        return 0;
    });

    nodes.forEach(node => container.appendChild(node));
}

// ------------------------------
// Search Filter
// ------------------------------
function applySearchFilter() {
    const query = searchBar.value.toLowerCase();
    const items = [...document.querySelectorAll(".manager-item")];

    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(query) ? "" : "none";
    });
}

// ------------------------------
// Main Loader
// ------------------------------
async function loadManager() {
    showLoader(true);

    let data = [];

    if (managerType === "bookmarks") {
        data = loadBookmarks();
        renderBookmarksTree(data);
    } else if (managerType === "tabs") {
        data = await loadIndexedDB("tabs");
        renderList(data);
    } else if (managerType === "history") {
        data = await loadItems("history");
        renderList(data);
    }
    
    setTimeout(function() {
        if (managerType !== "bookmarks") {
            sortDOM(sortNav.value)
            applySearchFilter();
        }

        showLoader(false);
    }, 100)
}

// ------------------------------
// Time-based Delete Popup UI
// ------------------------------
function createBulkDeleteButton() {
    let deIcon
    if (!navSpan) return;

    const currentPage = params.get('manager')

    if (currentPage == 'bookmarks') {
        deIcon = `bookmark_remove`
    } else if (currentPage == 'history') {
        deIcon = `delete_history`
    } else {
        deIcon = `delete`
    }

    const btn = document.createElement("button");
    btn.id = "bulk-delete-btn";
    btn.innerHTML = `<i class="material-symbols-rounded">${deIcon}</i>`;
    btn.className = "bulk-delete-btn";
    btn.addEventListener("click", openDeletePopup);

    navSpan.appendChild(btn);
}

function openDeletePopup() {
    const profileInfo = getProfileByName(localStorage.getItem('currentProfile'))
    let overlay = document.getElementById("delete-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "delete-overlay";
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.background = "rgba(0,0,0,0.4)";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.zIndex = "9999";

        overlay.innerHTML = `
            <div id="delete-popup" class="popup-on-ov">
                <h3 style="margin-top:0;margin-bottom:8px;">Clear ${managerType}</h3>
                <p style="margin-top:0;margin-bottom:12px;font-size:13px;opacity:0.8;">
                    Choose what to delete. Items without a date are kept.
                </p>

                <label style="display:block;margin-bottom:6px;font-size:13px;">Preset:</label>
                <select id="delete-preset" style="width:100%;margin-bottom:10px;">
                    <option value="preset-last-hour">Last hour</option>
                    <option value="preset-last-day">Last 24 hours</option>
                    <option value="preset-last-week">Last 7 days</option>
                    <option value="all-time">All time</option>
                    <option value="between">Between dates</option>
                    <option value="before">Before date</option>
                    <option value="after">After date</option>
                </select>

                <div id="date-range-fields" style="margin-bottom:10px;display:none;">
                    <label style="display:block;font-size:13px;margin-bottom:4px;">Start date/time:</label>
                    <input type="datetime-local" id="date-start" style="width:100%;margin-bottom:6px;">

                    <label style="display:block;font-size:13px;margin-bottom:4px;">End date/time:</label>
                    <input type="datetime-local" id="date-end" style="width:100%;">
                </div>

                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
                    <button id="delete-cancel-btn">Cancel</button>
                    <button id="delete-confirm-btn"">
                        Delete
                    </button>
                </div>

                <br>
                <div class="profile-info" style="display: flex; gap: 20px; align-items: center; background: var(--color-3); padding: 12px; border-radius: 12px;">
                    <i style="font-size: 25px;" class="material-symbols-rounded">account_circle</i>
                    <span>
                        <b>${localStorage.getItem('currentProfile')}</b>
                        <p>Your deleting saved data of this user. Once deleted, it cannot be recovered.</p>
                    </span>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const presetSelect = overlay.querySelector("#delete-preset");
        const dateFields = overlay.querySelector("#date-range-fields");
        const cancelBtn = overlay.querySelector("#delete-cancel-btn");
        const confirmBtn = overlay.querySelector("#delete-confirm-btn");

        const startInput = overlay.querySelector("#date-start");
        const endInput = overlay.querySelector("#date-end");

        presetSelect.addEventListener("change", () => {
            startInput.style.display = 'unset';
            endInput.style.display = 'unset';
            const v = presetSelect.value;
            if (v === "between" || v === "before" || v === "after") {
                dateFields.style.display = "block";

                // Reset both first
                startInput.style.display = "block";
                endInput.style.display = "block";

                if (v === "before") {
                    startInput.style.display = "none";
                }

                if (v === "after") {
                    endInput.style.display = "none";
                }
            } else {
                dateFields.style.display = "none";
            }
        });

        cancelBtn.addEventListener("click", closeDeletePopup);

        confirmBtn.addEventListener("click", () => {
            const mode = presetSelect.value;

            let start = null;
            let end = null;

            if (mode === "between" || mode === "after") {
                if (startInput.value) {
                    const s = Date.parse(startInput.value);
                    if (!Number.isNaN(s)) start = s;
                }
            }

            if (mode === "between" || mode === "before") {
                if (endInput.value) {
                    const e = Date.parse(endInput.value);
                    if (!Number.isNaN(e)) end = e;
                }
            }

            deleteByTimeRange({ mode, start, end });
            closeDeletePopup();
        });

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                closeDeletePopup();
            }
        });
    }

    overlay.style.display = "flex";
}

function closeDeletePopup() {
    const overlay = document.getElementById("delete-overlay");
    if (overlay) overlay.style.display = "none";
}

function openModeChangePop() {
    const dropdown = document.getElementById('dropDown')
    const rect = dropdown.getBoundingClientRect()

    const switchMode = document.createElement('div')
    switchMode.classList.add('switchMode')
    switchMode.style.left = `${rect.left}px`
    switchMode.style.top = `${rect.top + rect.height}px`
    switchMode.innerHTML = `
    <h4>View Other Saved Data</h4>
    <div style="${params.get('manager') == 'history' ? 'background: var(--color-2);' : ''}" onclick="switchMode('history')">
        <i class="material-symbols-rounded">history_2</i>
        <h4>History</h4>
    </div>
    <div ${params.get('manager') == 'bookmarks' ? `"style'background: var(--color-2);"` : ''} onclick="switchMode('bookmarks')">
        <i class="material-symbols-rounded">bookmark</i>
        <h4>Bookmarks</h4>
    </div>
    <div ${params.get('manager') == 'tabs' ? style = "'background: var(--color-2);'" : ''} onclick="switchMode('tabs')">
        <i class="material-symbols-rounded">tab</i>
        <h4>Tabs</h4>
    </div>
    `
    document.body.appendChild(switchMode)
    setTimeout(function () {
        document.body.onclick = function () {
            switchMode.remove()
            document.body.onclick = undefined
        }
    }, 100)
}

function switchMode(mode) {
    params.set('manager', mode)
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.replaceState({}, "", newUrl);
    showLoader(true)
    displayNotification('Changing Mode...', 'change_circle', 800)
    setTimeout(function () {
        location.reload()
    }, 800)
}

// ------------------------------
// Event Listeners
// ------------------------------
if (searchBar) {
    searchBar.addEventListener("input", applySearchFilter);
}

if (sortNav) {
    sortNav.addEventListener("change", () => {
        loadManager();
    });
}

function getBaseURL(url) {
    try {
        const u = new URL(url);
        return u.origin.replace(/^https?:\/\//, '');
    } catch {
        return url;
    }
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

// ------------------------------
// Start
// ------------------------------
createBulkDeleteButton();
loadManager();