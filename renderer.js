// Bluebird Browser (Bluebird IPE)
// 2026 Bryant Sandoval
// DISCLAIMER: This app or project was mostly made with AI, combined with features that were checked and created by me


let appVersion
window.cachedHistoryRecent = [];
const tabHistory = {};

const updateContent = `
<div class="update-app-content">
	<h2>What's New In Update 2.3.0?</h2>
	<p>You have been updated to the new version of Bluebird Browser! Here's what it includes:</p>
	<div class="flex">
		<span class="updateContent">
			<i class="material-symbols-rounded update-cont-logo">tab_recent</i>
			<h3>New Tab Viewer</h3>
			<p>Instead of using a context-menu like tab viewer, we have made some improvements to tab viewer. Now, you can close the page with one click, view more actions and active tab from that menu, and a more cleaner UI.</p>
			<p>To access, click this button (<i class="material-symbols-rounded">tabs</i>) on the top right.</p>
		</span>
		<span class="updateContent">
			<i class="material-symbols-rounded update-cont-logo">battery_android_frame_plus</i>
			<h3>Battery Manager</h3>
			<p>You can now view battery percentage from the titlebar, if you have the button enabled. If you click on it, you will get more, in depth details about your battery. Keep in mind that we calcuate things differently.</p>
		</span>
		<span class="updateContent">
			<i class="material-symbols-rounded update-cont-logo">robot_2</i>
			<h3>AI Chatbox</h3>
			<p>We are bringing AI to our browser. Using Copilot, Gemini, Google Search, and ChatGPT, you can use AI to talk to in the sidebar. Have a question? Need clarification? It just a click away.</p>
		</span>
	</div>
	<div>
		<h3 style="text-align: left;">More Updates</h3>
		<ul>
			<li>
				<b>New Popups</b>
				<p>To make your life simple, we now have a new type of popups (like these). These popups are always centered, always big, and easy to use.</p>
			</li>
			<li>
				<b>Bookmarks Bar</b>
				<p>Classic, browser feature. Now in Bluebird Browser.</p>
			</li>
			<li>
				<b>3rd Party Account Connections</b>
				<p>Due to the ability that restricts logging in thru the browser, you can now log in safely thru a new window, and you will now be logged in to the browser.</p>
				<p><b>How to Log In?</b> Under Profile menu, go to Connected Accounts, then select one of the options. Currently, Google, Microsoft, GitHub, and Apple are ready to use.</p>
			</li>
			<li>
				<b>And More</b>
				<p>Look throughout the browser to see new features!</p>
			</li>
			<li>
				<b>Access your Active Hidden Tab</b>
				<p>To easily access you active tab (while hidden), it will now show a button to the left of the screen. Clicking on it shows the actions that shows for that tab.</p>
			</li>
			<p>We hope you enjoy these features! Till the next time.</p>
		</ul>
	</div>
</div>
`

// This is for battery manager, different from the other code.
navigator.getBattery().then(battery => {
	const sample = {
		timestamp: Date.now(),
		level: Math.round(battery.level * 100),
		charging: battery.charging,
		chargingTime: battery.chargingTime,
		dischargingTime: battery.dischargingTime
	};
	recordBatterySample(sample);
});

function loadBatteryData() {
	return JSON.parse(localStorage.getItem("batteryData") || "[]");
}

function saveBatteryData(data) {
	localStorage.setItem("batteryData", JSON.stringify(data));
}

function recordBatterySample(sample) {
	const data = loadBatteryData();
	data.push(sample);
	localStorage.setItem("batteryData", JSON.stringify(data));
}

window.api.getAppVersion().then(version => {
	appVersion = version

	if (localStorage.getItem('appVer') !== version) {
		localStorage.setItem('appVer', version)
		createOverlayPopup(updateContent, '90%', '80vh')
	}
});

// IndexedDB
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
			if (!db.objectStoreNames.contains('savedPasswords')) {
				db.createObjectStore('savedPasswords', { autoIncrement: true });
			}
			if (!db.objectStoreNames.contains('zoomPercent')) {
				db.createObjectStore('zoomPercent', { key: 'url' });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function showUpdateButton(label) {
	const btn = document.createElement("button");
	btn.textContent = label;
	btn.className = "update-btn";
	btn.onclick = () => {
		ipcRenderer.send("install-update");
	};
	document.body.appendChild(btn);
}


// Helpers for IDB
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

const isMac = navigator.platform.toLowerCase().includes('mac');
let activeProfile = 'Default';

// Initial per-profile bounds application
(async () => {
	console.log(activeProfile)
	if (!localStorage.getItem('pinnedTabs')) {
		localStorage.setItem('pinnedTabs', ' ')
	}
	try {
		const bounds = await loadWindowBoundsForProfile(activeProfile || 'Default');
		if (bounds && window.electronAPI?.setWindowBounds) {
			const safeBounds = {
				width: Math.max(400, bounds.width || 1200),
				height: Math.max(300, bounds.height || 800),
				...(typeof bounds.x === 'number' ? { x: bounds.x } : {}),
				...(typeof bounds.y === 'number' ? { y: bounds.y } : {}),
			};
			window.electronAPI.setWindowBounds(safeBounds);
		}
	} catch (err) {
		console.warn('Failed to load window bounds for profile:', err);
	}
})();

window.electronAPI.onFullscreenChanged(({ fullscreen }) => {
	if (!fullscreen && isMac) {
		document.body.classList.add('on-mac');
	} else {
		document.body.classList.remove('on-mac');
	}

	if (fullscreen) {
		displayNotification(`Press ${isMac ?
			'<key><i class="material-symbols-rounded">keyboard_command_key</i></key> + <key><i class="material-symbols-rounded">keyboard_option_key</i></key> + <key>F</key>' :
			'<key>Ctrl</key> + <key>Alt</key> + <key>F</key>'}  to exit full screen.`, 'aspect_ratio')
		localStorage.setItem('fullscreen', String(true))
	} else {
		localStorage.setItem('fullscreen', String(false))
	}
})

window.electronAPI.onZoomUpdated(({ id, factor }) => {
	const active = getActive()?.webview;
	const preview = document.getElementById("previewWebview");

	if (active && active.getWebContentsId() === id) {
		showZoomControls(active, factor);
		return;
	}

	if (preview && preview.getWebContentsId() === id) {
		showZoomControls(preview, factor);
		return;
	}
});

window.electronAPI?.openSidebarApp((payload) => {
	console.log(payload);
	openSidebarApp(payload.page, payload.title, payload.iframe);
});

window.electronAPI.onAppVersion((version) => {
	console.log('App version:', version);
	appVersion = version
});

window.windowAPI.onFocusChange(({ focus }) => {
	const body = document.body
	if (focus) {
		body.classList.remove('focused-window')
	} else {
		body.classList.add('focused-window')
	}
});


document.addEventListener('DOMContentLoaded', async function () {
	const allSettings = await loadAllSettings();

	if (!localStorage.getItem(`firstTime-${activeProfile}`)) {
		localStorage.setItem(`firstTime-${activeProfile}`, String(true));
		displayNotification('Welcome to Bluebird Browser.', 'waving_hand')
	}
	// Helper: convert IDBRequest → Promise
	function idbRequest(req) {
		return new Promise((resolve, reject) => {
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}

	// --- 1. Load settings ---

	const startupMode =
		allSettings.find(s => s.key === 'whenOpened')?.value || 'Open New Tab';

	const homepage =
		allSettings.find(s => s.key === 'homepage')?.value ||
		'pages/new-tab/index.html';

	// NEW: renamed setting
	const setTabsRaw =
		allSettings.find(s => s.key === 'setToOpenTabs')?.value || '';

	// Parse comma-separated URLs
	const setTabsList = setTabsRaw
		.split(',')
		.map(u => u.trim())
		.filter(u => u.length > 0);

	// --- 2. Read saved tabs BEFORE clearing ---
	const db = await openDB();

	let tx = db.transaction('tabs', 'readonly');
	let store = tx.objectStore('tabs');

	const savedTabs = await idbRequest(store.getAll());
	await transactionDone(tx);

	// --- 3. Handle startup behavior ---
	setTimeout(function () {

		if (startupMode === 'Restore Tabs' && savedTabs.length > 0) {
			for (const t of savedTabs) {
				createTab(t.url);
				updateOverflow()
			}
		} else if (startupMode === 'Open A Set List of Tabs') {
			if (setTabsList.length > 0) {
				setTabsList.forEach(url => createTab(url));
			} else {
				createTab(homepage);
			}
		} else {
			// Default: Open New Tab
			createTab(homepage);
		}
	}, 200)

	// --- 4. Clear old session AFTER restoring ---
	tx = db.transaction('tabs', 'readwrite');
	store = tx.objectStore('tabs');
	store.clear();
	await transactionDone(tx);

	// --- 5. UI setup ---
	document.querySelector('title').innerHTML =
		`${activeProfile} - Bluebird Browser`;

	if (isMac) {
		const topPart = document.getElementById('top-part');
		if (topPart) topPart.classList.add('on-mac');
		document.body.classList.add('on-mac');
	}

	// --- 6. Restore window size ---
	const saved = localStorage.getItem('windowSize');
	if (saved) {
		const { width, height } = JSON.parse(saved);
		if (window.electronAPI?.resizeWindow) {
			window.electronAPI.resizeWindow(width || 1200, height || 500);
		}
		if (window.electronAPI?.saveWindowBounds) {
			window.electronAPI.saveWindowBounds();
		}
	}

	// --- 7. Load browser settings (themes, toggles, etc.) ---
	loadBrowserSettings();

	const bookmarks = getBookmarks(activeProfile)

	bookmarks.forEach(i => {
		const newE = document.createElement('button');

		newE.innerHTML = `
			${i.favicon ? `<img src="${i.favicon}" alt="icon">` : `<i class="material-symbols-rounded">globe</i>`}
			<span>${i.title}</span>
		`;

		newE.title = `${i.title} / ${i.url}`;
		document.getElementById('bookmarks-bar').appendChild(newE);

		let clickTimer = null;
		const delay = 300;

		newE.addEventListener("click", () => {
			if (clickTimer) {
				clearTimeout(clickTimer);
				clickTimer = null;

				createContextMenu(
					[
						{
							icType: 'GF',
							icon: 'edit',
							name: 'Edit Bookmark',
							category: 'Manage'
						}
					],
					newE
				);

			} else {
				clickTimer = setTimeout(() => {
					clickTimer = null;

					createTab(i.url, i.title, i.favicon);

				}, delay);
			}
		});
	});

	localStorage.setItem('currentProfile', activeProfile)
});

function debounce(fn, delay = 150) {
	let timeout;
	return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => fn(...args), delay);
	};
}

window.onresize = debounce(() => {
	updateOverflow();
	showTabLeftInfo(getActive());
}, 150);

const profileInfoEl = document.getElementById('profile-info');
if (profileInfoEl) {
	profileInfoEl.innerHTML = `
    <i class="material-symbols-rounded">account_circle</i>
    <span id="active-profile-displayed">${activeProfile}</span>
  `;
}

// Profile switcher menu (uses electronAPI for windows)
if (profileInfoEl) {
	profileInfoEl.addEventListener('click', async function () {
		// If you have an api.profiles.list bridge, keep it; otherwise fallback to IndexedDB:
		let profiles = [];
		if (window.api?.profiles?.list) {
			profiles = await window.api.profiles.list();
		} else {
			profiles = await listProfiles();
		}

		console.log(profiles)

		const items = profiles.map(p => {
			let icon;

			if (typeof p.avatar === "string" && p.avatar.startsWith("data:")) {
				// SAFE IMAGE
				icon = {
					type: "image",
					value: p.avatar
				};
			} else {
				// SAFE MONOGRAPH (1 character)
				const letter = (p.avatar || p.name || "?").trim()[0]?.toUpperCase() || "?";
				icon = {
					type: "letter",
					value: letter
				};
			}

			return {
				icon: icon.type == 'image' ? `<img src="${p.avatar}">` : p.avatar,
				name: p.name,
				category: "Profiles",
				action: () => {
					window.electronAPI?.newWindow?.(p.name);
				}
			};
		});

		items.push(
			{
				icon: 'app_registration',
				icType: 'GF',
				name: 'Connected Accounts',
				category: 'Account',
				submenu: [
					{
						icon: 'google',
						icType: 'FAb',
						name: 'Google',
						category: 'Accounts',
						function: () => { window.electronAPI?.openAppPage?.('https://accounts.google.com/v3/signin/accountchooser?continue=https%3A%2F%2Faccounts.google.com%2F&dsh=S-1123994818%3A1767056569165308&followup=https%3A%2F%2Faccounts.google.com%2F&ifkv=Ac2yZaVGCZz3n_XejDlfU5o2JGP332d358iPRpuQj1gXwanZsgDBL4QiVjZXUDT60dQCMbuQ2JwA3g&passive=true&flowName=GlifWebSignIn&flowEntry=ServiceLogin', 900, 700, activeProfile, true, [{ resizable: true, }]); }
					},
					{
						icon: 'microsoft',
						icType: 'FAb',
						name: 'Microsoft',
						category: 'Accounts',
						function: () => { window.electronAPI?.openAppPage?.('https://login.live.com', 900, 700, activeProfile, true, [{ resizable: true, }]); }
					},
					{
						icon: 'apple',
						icType: 'FAb',
						name: 'Apple',
						category: 'Accounts',
						function: () => { window.electronAPI?.openAppPage?.('https://account.apple.com/sign-in', 900, 700, activeProfile, true, [{ resizable: true, }]); }
					},
					{
						icon: 'github',
						icType: 'FAb',
						name: 'GitHub',
						category: 'Accounts',
						function: () => { window.electronAPI?.openAppPage?.('https://github.com/login', 900, 700, activeProfile, true, [{ resizable: true, }]); }
					},
				]
			}
		)

		items.push({
			icon: '⚙',
			name: 'Profile Manager',
			category: 'Manage',
			function: () => {
				window.electronAPI?.openAppPage?.(
					'pages/profilePages/accountMakeSure.html',
					500,
					700,
					'Default'
				);
			}
		});

		items.push({
			icon: 'brush',
			icType: 'GF',
			name: 'Customize Theme',
			category: 'Manage',
			function: () => {
				openSidebarApp('pages/settings/index.html#appearance', 'Settings', true);
			}
		});
		createContextMenu(items, profileInfoEl);
	});
}

// Save window bounds on exit
window.addEventListener('beforeunload', async function () {
	const data = { width: window.innerWidth, height: window.innerHeight };
	try {
		localStorage.setItem('windowSize', JSON.stringify(data))
		await saveWindowBoundsForProfile(activeProfile || 'Default', data);
	} catch (err) {
		console.warn('Failed to save window bounds:', err);
	}

});

// Profiles
async function addProfile(profile) {
	const db = await openDB();
	const tx = db.transaction('profiles', 'readwrite');
	const store = tx.objectStore('profiles');
	store.put({
		...profile,
		id: crypto.randomUUID(),
		createdAt: Date.now(),
		updatedAt: Date.now()
	});
	await transactionDone(tx);
}

async function deleteProfile(name) {
	const db = await openDB();
	const tx = db.transaction('profiles', 'readwrite');
	tx.objectStore('profiles').delete(name);
	await transactionDone(tx);
}

async function editProfile(name, updates) {
	const db = await openDB();
	const tx = db.transaction('profiles', 'readwrite');
	const store = tx.objectStore('profiles');
	const existing = await promisifyRequest(store.get(name));
	if (existing) {
		store.put({ ...existing, ...updates, updatedAt: Date.now() });
	}
	await transactionDone(tx);
}

async function listProfiles() {
	const db = await openDB();
	const tx = db.transaction('profiles', 'readonly');
	const store = tx.objectStore('profiles');
	const req = store.getAll();
	const res = await promisifyRequest(req);
	return res || [];
}

// Settings
async function updateSetting(key, value) {
	const db = await openDB();
	const tx = db.transaction('settings', 'readwrite');
	const store = tx.objectStore('settings');
	store.put({ key, value });
	await transactionDone(tx);

	window.postMessage(
		{ updateSettings: true },
		"*"
	);

	return key;
}

// ===============================
// Generic DB Helpers
// ===============================

async function dbGet(storeName, key) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, "readonly");
		const store = tx.objectStore(storeName);
		const req = store.get(key);

		req.onsuccess = () => resolve(req.result ?? null);
		req.onerror = () => reject(req.error);
	});
}

async function dbSet(storeName, value) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, "readwrite");
		const store = tx.objectStore(storeName);
		const req = store.put(value);

		req.onsuccess = () => resolve(true);
		req.onerror = () => reject(req.error);
	});
}

async function dbGetAll(storeName) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, "readonly");
		const store = tx.objectStore(storeName);

		const results = {};
		const cursorReq = store.openCursor();

		cursorReq.onsuccess = (e) => {
			const cursor = e.target.result;
			if (cursor) {
				results[cursor.key] = cursor.value;
				cursor.continue();
			} else {
				resolve(results);
			}
		};

		cursorReq.onerror = () => reject(cursorReq.error);
	});
}


async function loadSetting(key) {
	const db = await openDB();
	const tx = db.transaction('settings', 'readonly');
	const store = tx.objectStore('settings');
	const res = await promisifyRequest(store.get(key));
	return res?.value;
}

async function loadAllSettings() {
	const db = await openDB();
	const tx = db.transaction('settings', 'readonly');
	const store = tx.objectStore('settings');
	const res = await promisifyRequest(store.getAll());
	return res || [];
}

async function getHistory() {
	const db = await openDB();

	// Helper to convert IDBRequest → Promise
	function idbRequest(req) {
		return new Promise((resolve, reject) => {
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}

	// Read transaction
	const tx = db.transaction('history', 'readonly');
	const store = tx.objectStore('history');

	const items = await idbRequest(store.getAll());
	await transactionDone(tx);

	console.log(items)
	console.log(Array.isArray(items));

	return items;
}


// Window bounds per profile
async function saveWindowBoundsForProfile(profile, bounds) {
	const db = await openDB();
	const tx = db.transaction('window_bounds', 'readwrite');
	const store = tx.objectStore('window_bounds');
	store.put({
		profile,
		bounds: {
			width: Math.max(400, bounds.width || window.innerWidth),
			height: Math.max(300, bounds.height || window.innerHeight),
			x: typeof bounds.x === 'number' ? bounds.x : undefined,
			y: typeof bounds.y === 'number' ? bounds.y : undefined,
		},
		updatedAt: Date.now()
	});
	await transactionDone(tx);
}

async function loadWindowBoundsForProfile(profile) {
	const db = await openDB();
	const tx = db.transaction('window_bounds', 'readonly');
	const store = tx.objectStore('window_bounds');
	const res = await promisifyRequest(store.get(profile));
	return res?.bounds || null;
}

// Permissions
async function savePermission(url, permission, decision) {
	const db = await openDB();
	const tx = db.transaction('permissions', 'readwrite');
	const store = tx.objectStore('permissions');
	const key = `${url}:${permission}`;
	store.put({ url: key, decision, timestamp: Date.now() });
	await transactionDone(tx);
}

async function loadPermission(url, permission) {
	const db = await openDB();
	const tx = db.transaction('permissions', 'readonly');
	const store = tx.objectStore('permissions');
	const key = `${url}:${permission}`;
	const res = await promisifyRequest(store.get(key));
	return res?.decision;
}

async function loadBrowserSettings() {
	const settingsArray = await loadAllSettings();
	if (!settingsArray) {
		console.warn("Settings don't exist.");
		return;
	}
	const settings = {};
	settingsArray.forEach(({ key, value }) => {
		settings[key] = value;
	});

	// Theme
	let theme = settings.theme;
	try {
		theme = JSON.parse(theme);
	} catch { }
	Object.entries(theme).forEach(([key, value]) => {
		document.documentElement.style.setProperty(`--${key}`, value);
	});

	// System Theme
	document.body.style.colorScheme = settings.systemTheme;

	// Bookmark Bar
	const bkMB = document.getElementById("bookmarks-bar");

	if (bkMB) {
		const show = await loadSetting("showBookmarksBar");
		console.log(show)
		bkMB.style.display = show ? "flex" : "none";
		bkMB.classList.toggle("displayed", show);
	}
	await window.battery.getInfo().then((info) => {
		updateBatteryUI(info.level, info.charging)
	});
}

function getBatteryIcon(level, isCharging) {
	if (isCharging) return "battery_android_bolt";

	if (level >= 96) return "battery_android_frame_full";
	if (level >= 86) return "battery_android_frame_6";
	if (level >= 71) return "battery_android_frame_5";
	if (level >= 56) return "battery_android_frame_4";
	if (level >= 36) return "battery_android_frame_3";
	if (level >= 21) return "battery_android_frame_2";
	if (level >= 6) return "battery_android_frame_1";
	if (level >= 0) return "battery_android_alert";

	return "battery_android_question";
}

function updateBatteryUI(level, isCharging) {
	const btn = document.getElementById("btnBattery");
	if (!btn) return;

	btn.onclick = () => {
		openSidebarApp('pages/batteryManager/index.html', 'Battery', true)
	}
	btn.title = `Battery: ${level}%`

	const icon = getBatteryIcon(level, isCharging);
	btn.querySelector("i").innerText = icon;
}

async function initBattery() {
	const info = await window.battery.getInfo();
	updateBatteryUI(info.level, info.charging);

	window.battery.onLevelChange(level => {
		updateBatteryUI(level, info.charging);
		info.level = level;
	});

	window.battery.onChargingChange(isCharging => {
		updateBatteryUI(info.level, isCharging);
		info.charging = isCharging; // keep local state updated
	});
}

initBattery();

function applyAutoThemeValues(key, value) {
	const rgb = parseColorToRgb(value);
	if (!rgb) return;
	const [r, g, b] = rgb;

	const brightness = (r * 299 + g * 587 + b * 114) / 1000;

	const hoverAlpha = 0.10;   // subtle hover overlay
	const borderDarken = 0.12; // slight darkening for borders
	const shadowAlpha = 0.18;  // subtle shadow

	if (key === "main-color") {
		const textColor = brightness < 140 ? "#ffffff" : "#000000";
		document.documentElement.style.setProperty("--main-text-color", textColor);
		document.documentElement.style.setProperty("--accent-text-color", textColor);
	}

	if (key === "sidebar-bg" || key === "toolbar-input-bg") {
		const textColor = brightness < 140 ? "#ffffff" : "#000000";
		// Only set if not explicitly set by user (so we don't override deliberate choices)
		const existingMainText = getComputedStyle(document.documentElement).getPropertyValue("--main-text-color").trim();
		if (!existingMainText) {
			document.documentElement.style.setProperty("--main-text-color", textColor);
		}
	}

	if (key.endsWith("bg") || key.endsWith("color")) {
		const borderRgb = darkenRgb(r, g, b, borderDarken);
		document.documentElement.style.setProperty(`--${key}-border-auto`, `rgb(${borderRgb.join(", ")})`);
	}

	if (key.includes("bg") || key.includes("color")) {
		document.documentElement.style.setProperty(`--${key}-hover-auto`, `rgba(${r}, ${g}, ${b}, ${hoverAlpha})`);
	}

	if (key === "main-color" || key === "sidebar-bg" || key === "titlebar-color") {
		const sr = Math.floor(r * 0.12);
		const sg = Math.floor(g * 0.12);
		const sb = Math.floor(b * 0.12);
		document.documentElement.style.setProperty(`--${key}-shadow-auto`, `rgba(${sr}, ${sg}, ${sb}, ${shadowAlpha})`);
	}
}

function parseColorToRgb(input) {
	if (!input || typeof input !== "string") return null;
	const s = input.trim();

	const rgbMatch = s.match(/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i);
	if (rgbMatch) {
		return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
	}

	if (s[0] === "#") {
		const hex = s.slice(1);
		if (hex.length === 3) {
			const r = parseInt(hex[0] + hex[0], 16);
			const g = parseInt(hex[1] + hex[1], 16);
			const b = parseInt(hex[2] + hex[2], 16);
			return [r, g, b];
		}
		if (hex.length === 4) {
			const r = parseInt(hex[0] + hex[0], 16);
			const g = parseInt(hex[1] + hex[1], 16);
			const b = parseInt(hex[2] + hex[2], 16);
			return [r, g, b];
		}
		if (hex.length === 6) {
			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			return [r, g, b];
		}
		if (hex.length === 8) {
			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			return [r, g, b];
		}
	}

	const varMatch = s.match(/^var\(\s*--([a-z0-9-_]+)\s*\)$/i);
	if (varMatch) {
		const resolved = getComputedStyle(document.documentElement).getPropertyValue(`--${varMatch[1]}`).trim();
		return parseColorToRgb(resolved);
	}

	// Not parseable
	return null;
}

function darkenRgb(r, g, b, amount = 0.15) {
	const nr = Math.max(0, Math.round(r * (1 - amount)));
	const ng = Math.max(0, Math.round(g * (1 - amount)));
	const nb = Math.max(0, Math.round(b * (1 - amount)));
	return [nr, ng, nb];
}

function hexToRgbBitwise(hex) {
	const rgb = parseColorToRgb(hex);
	return rgb || [0, 0, 0];
}

window.addEventListener("message", (event) => {
	if (event.origin !== window.origin) return;

	if (event.data.updateSettings) {
		try {
			loadBrowserSettings();
		} catch (e) {
			prompt(e)
		}
		console.log("Settings updated:");
	} else if (event.data.removeTab) {
		closeTab(event.data.removeTab);
	} else if (event.data.type === 'get-media-list') {
		sendMediaListToSidebar();
	} else if (event.data.type === 'media-control') {
		handleMediaControl(event.data);
	} else if (event.data.type === 'go-to-tab') {
		setActiveTab(event.data.tabId);
	} else if (event.data.type === 'get-download-list') {
		sendDownloadListToSidebar();
	} else if (event.data.type === 'download-control') {
		handleDownloadControl(event.data);
	}
});

// Media Manager Functions
function sendMediaListToSidebar() {
	const mediaTabs = tabs.filter(tab => tab.media && tab.media.isPlaying).map(tab => ({
		tabId: tab.id,
		title: tab.title,
		url: tab.url,
		favicon: tab.favicon,
		isPlaying: tab.media.isPlaying
	}));

	// Send to sidebar iframe
	if (window.sidebarIframe && window.sidebarIframe.contentWindow) {
		window.sidebarIframe.contentWindow.postMessage({ type: 'update-media', mediaTabs }, '*');
	}
}

function handleMediaControl(data) {
	const { action, tabId, value } = data;
	const tab = tabs.find(t => t.id === tabId);
	if (!tab || !tab.webview) return;

	switch (action) {

		case 'toggle-play-pause':
			tab.webview.executeJavaScript(`
                (() => {
                    const media = document.querySelector('video, audio');
                    if (!media) return;
                    media.paused ? media.play() : media.pause();
                })();
            `);
			break;

		case 'seek':
			tab.webview.executeJavaScript(`
                (() => {
                    const media = document.querySelector('video, audio');
                    if (!media || !media.duration) return;
                    media.currentTime = (media.duration * ${value}) / 100;
                })();
            `);
			break;

		case 'skip-back':
			tab.webview.executeJavaScript(`
                (() => {
                    const media = document.querySelector('video, audio');
                    if (!media) return;
                    media.currentTime = Math.max(0, media.currentTime - 10);
                })();
            `);
			break;

		case 'skip-forward':
			tab.webview.executeJavaScript(`
                (() => {
                    const media = document.querySelector('video, audio');
                    if (!media) return;
                    media.currentTime = Math.min(media.duration || 0, media.currentTime + 10);
                })();
            `);
			break;

		case 'pip':
			tab.webview.executeJavaScript(`
                (() => {
                    const video = document.querySelector('video');
                    if (!video) return;

                    if (document.pictureInPictureElement) {
                        document.exitPictureInPicture();
                    } else {
                        video.requestPictureInPicture();
                    }
                })();
            `);
			break;
	}
}

// Download Manager Functions (placeholders)
function sendDownloadListToSidebar() {
	// TODO: Implement download list
	const sidebar = document.querySelector('iframe[src*="download.html"]');
	if (sidebar) {
		sidebar.contentWindow.postMessage({ type: 'update-downloads', downloads: [] }, '*');
	}
	updateDownloadManager();
}

window.electronAPI?.onSwitchProfile?.(async (profileName) => {
	console.log('Switched to profile:', profileName);
	activeProfile = profileName;

	const profileInfo = document.getElementById('profile-info');
	if (profileInfo) {
		profileInfo.innerHTML = `
		<span id="profile-info-pfp">
		  <i class="material-symbols-rounded">account_circle</i>
		</span>
		`
	}
	// <span>${activeProfile}</span>;

	try {
		const profiles = await window.api.profiles.list();
		const selected = profiles.find(p => p.name === profileName);
		if (selected) {
			console.log('Full profile object:', selected);

			const pfpEl = document.getElementById('profile-info-pfp');
			if (pfpEl) {
				if (selected.avatar && selected.avatar.startsWith('data:')) {
					// image avatar
					pfpEl.innerHTML = `<img src="${selected.avatar}" alt="${activeProfile}'s Profile" style="width:24px;height:24px;border-radius:50%">`;
				} else if (selected.avatar) {
					// monograph or custom HTML
					pfpEl.innerHTML = selected.avatar;
				} else {
					// fallback icon
					pfpEl.innerHTML = `<i class="material-symbols-rounded">account_circle</i>`;
				}
			}
		} else {
			console.warn('Profile not found in list:', profileName);
		}
	} catch (err) {
		console.error('Failed to load profiles:', err);
	}

	// existing bounds logic
	try {
		const bounds = await loadWindowBoundsForProfile(profileName);
		if (bounds && window.electronAPI?.setWindowBounds) {
			window.electronAPI.setWindowBounds({
				width: Math.max(400, bounds.width || 1200),
				height: Math.max(300, bounds.height || 800),
				...(typeof bounds.x === 'number' ? { x: bounds.x } : {}),
				...(typeof bounds.y === 'number' ? { y: bounds.y } : {}),
			});
		}
	} catch (err) {
		console.warn('Failed to apply bounds for new profile:', err);
	}
});

// Elements
const tabsBar = document.getElementById('tabs');
const views = document.getElementById('views');
const address = document.getElementById('address');
const addressMore = document.getElementById('address-more');
const moreBtn = document.getElementById('more-btn');
const aiBtn = document.getElementById('aiBtn');

const backBtn = document.getElementById('back');
const fwdBtn = document.getElementById('forward');
const reloadBtn = document.getElementById('reload');
const bookmarkBtn = document.getElementById('bookmark');
const newWindowBtn = document.getElementById('new-window');

const zoomBtn = document.getElementById('zoomBtn')
const bookmarkManagerBtn = document.getElementById('bookmark-manager')
const historyManager = document.getElementById('btnHistory')
const btnSettings = document.getElementById('btnSettings')
const btnPrint = document.getElementById('btnPrint')
const btnDownload = document.getElementById('btnDownloads')
const btnShare = document.getElementById('btnShare')
const btnQRcode = document.getElementById('btnQRCode')
const btnDevTools = document.getElementById('btnDevTools')
const btnMediaManager = document.getElementById('btnMediaManager')
const btnDownloadManager = document.getElementById('btnDownloadManager')

// Global drag state for tab reordering
const dragState = {
	isDragging: false,
	dragStartX: 0,
	dragStartIndex: 0,
	currentDropIndex: 0,
	draggedTab: null,
	draggedEl: null,
	tabWidths: new Map()
};

// Global mousemove handler for tab dragging
document.addEventListener('mousemove', (e) => {
	if (!dragState.isDragging || e.buttons === 0) {
		dragState.isDragging = false;
		return;
	}

	if (!dragState.draggedEl) return;

	const dragDelta = e.clientX - dragState.dragStartX;

	// 🔥 Require at least 10px movement before activating drag
	if (Math.abs(dragDelta) < 10) {
		return; // do nothing yet — user hasn't dragged far enough
	}

	// Now we are officially dragging
	dragState.draggedEl.style.transform = `translateX(${dragDelta}px)`;

	// Find which tab we're hovering over
	const allTabs = Array.from(tabsBar.querySelectorAll('.tab:not(.new-tab)'));
	let newDropIndex = dragState.dragStartIndex;

	for (let i = 0; i < allTabs.length; i++) {
		const rect = allTabs[i].getBoundingClientRect();
		const midpoint = rect.left + rect.width / 2;

		if (e.clientX < midpoint) {
			newDropIndex = i;
			break;
		}

		newDropIndex = i + 1;
	}

	// Update visual positions if drop position changed
	if (newDropIndex !== dragState.currentDropIndex) {
		dragState.currentDropIndex = newDropIndex;
		updateTabPositionsPreview(dragState.dragStartIndex, newDropIndex);
	}
});

// Global mouseup handler for tab dragging
document.addEventListener('mouseup', (e) => {
	if (!dragState.isDragging) return;
	dragState.isDragging = false;
	setTimeout(function () {
		updateOverflow();
	}, 100)

	if (!dragState.draggedEl) {
		dragState.draggedEl = null;
		return;
	}

	const finalDropIndex = Math.max(0, Math.min(dragState.currentDropIndex, tabs.length - 1));

	// Reorder tabs array
	if (finalDropIndex !== dragState.dragStartIndex) {
		const [draggedTab] = tabs.splice(dragState.dragStartIndex, 1);
		tabs.splice(finalDropIndex, 0, draggedTab);
	}

	// Reset all tab transforms with animation
	dragState.draggedEl.style.transition = 'transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1)';
	dragState.draggedEl.style.transform = '';
	dragState.draggedEl.style.zIndex = '';
	dragState.draggedEl.classList.remove('dragging-tab');

	tabsBar.querySelectorAll('.tab:not(.new-tab)').forEach(tabNode => {
		tabNode.style.transition = 'transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1)';
		tabNode.style.transform = '';
	});

	// Wait for animations to complete, then persist
	setTimeout(() => {
		if (finalDropIndex !== dragState.dragStartIndex) {
			// Recreate tab elements in new order
			tabsBar.querySelectorAll('.tab:not(.new-tab)').forEach(node => node.remove());
			tabs.forEach((t) => { addTabElement(t); });

			const newTabBtn = tabsBar.querySelector('.new-tab');
			if (newTabBtn) tabsBar.appendChild(newTabBtn);
		}

		if (activeTab) setActiveTab(activeTab);
		tabs.forEach(updateTabElement);
		dragState.tabWidths.clear();
		dragState.draggedEl = null;
	}, 1);
});

// Helper function to update tab positions during drag preview
function updateTabPositionsPreview(fromIndex, toIndex) {
	const allTabs = Array.from(tabsBar.querySelectorAll('.tab:not(.new-tab)'));

	allTabs.forEach((tabNode, index) => {
		if (tabNode === dragState.draggedEl) return; // Skip the dragged tab

		let offset = 0;
		const tabId = tabNode.dataset.id;

		if (fromIndex < toIndex) {
			// Moving right
			if (index > fromIndex && index < toIndex) {
				offset = -(dragState.tabWidths.get(tabId) || 60);
			}
		} else {
			// Moving left
			if (index >= toIndex && index < fromIndex) {
				offset = dragState.tabWidths.get(tabId) || 60;
			}
		}

		tabNode.style.transition = 'transform 0.2s ease-out';
		tabNode.style.transform = offset !== 0 ? `translateX(${offset}px)` : '';
	});
}

setTimeout(function () {
	console.log(getActive())
	if (backBtn) backBtn.onclick = () => {
		const active = getActive();
		if (active?.webview?.canGoBack && active.webview.canGoBack()) {
			active.webview.goBack();
			setTimeout(() => updateNavButtons(active.webview), 150);
		}
	};
	if (fwdBtn) fwdBtn.onclick = () => {
		const active = getActive();
		if (active?.webview?.canGoForward && active.webview.canGoForward()) {
			active.webview.goForward();
			setTimeout(() => updateNavButtons(active.webview), 150);
		}
	};
	if (reloadBtn) reloadBtn.onclick = () => { getActive()?.webview.reload(); };
	if (bookmarkBtn) bookmarkBtn.onclick = () => { addBookmark() };
	if (newWindowBtn) newWindowBtn.onclick = () => { const profile = activeProfile || 'Default'; if (window.electronAPI?.newWindow) { window.electronAPI.newWindow(profile, 'new-window'); } else if (window.api?.window?.new) { window.api.window.new(profile, 'new-window'); } else { console.warn('No window.new API exposed'); } };
	if (zoomBtn) { zoomBtn.onclick = async () => { const active = getActive(); if (active?.webview) { await showZoomControls(active.webview, active.webview.getZoomFactor()); } } }
	if (bookmarkManagerBtn) bookmarkManagerBtn.onclick = () => { openSidebarApp('pages/managers/index.html?manager=bookmarks', true) };
	if (historyManager) historyManager.onclick = () => { openSidebarApp('pages/managers/index.html?manager=history', true) };
	if (btnSettings) btnSettings.onclick = () => { openSidebarApp('pages/settings/index.html', 'Settings', true) };
	if (btnPrint) btnPrint.onclick = () => { window.print(); };
	if (btnDownload) btnDownload.onclick = () => { console.log("Downloads opened"); };
	if (btnShare) btnShare.onclick = () => { const active = getActive(); if (active) { setUpshareMenu(active.url, active.name); } };
	if (btnQRcode) btnQRcode.onclick = () => { console.log("QR Code shown"); };
	if (btnDevTools) btnDevTools.onclick = () => { getActive()?.webview.openDevTools(); };
	if (btnMediaManager) btnMediaManager.onclick = () => { openSidebarApp('pages/managers/media.html', 'Media Manager', true) };
	if (btnDownloadManager) btnDownloadManager.onclick = () => { openSidebarApp('pages/managers/download.html', 'Download Manager', true) };
}, 300)


let tabs = [];
let activeTab = null;

window.electronAPI.onContextAction(async ({ type, ...payload }) => {
	await runContextAction(type, payload);
});

async function runContextAction(type, payload = {}) {
	const active = getActive();
	if (!active) return;

	const { webview, id: activeId } = active;

	const actions = {
		// ─────────────────────────────────────────────
		// TAB MANAGEMENT
		// ─────────────────────────────────────────────
		newTab: () => createTab('pages/new-tab/index.html'),
		openInNew: () => { createTab(payload.url, { insertAfterActive: true }) },
		newWindow: () => newWindowBtn?.click(),
		duplicateTab,
		closeTab: () => closeTab(activeId),
		closeTabOnRight: () => closeTabsToRight(activeId),
		closeOtherTabs: () => closeOtherTabs(activeId),

		switchTab: ({ id }) => {
			const tab = tabs.find(t => t.id === id);
			if (tab) setActiveTab(tab.id);
		},

		// ─────────────────────────────────────────────
		// TAB NAVIGATION
		// ─────────────────────────────────────────────
		nextTab: () => {
			const list = [...document.querySelectorAll(".tab")];
			if (!list.length) return;

			const idx = list.indexOf(active.tabElement);
			const next = list[(idx + 1) % list.length];
			next?.click();
		},

		previousTab: () => {
			const list = [...document.querySelectorAll(".tab")];
			if (!list.length) return;

			const idx = list.indexOf(active.tabElement);
			const next = list[(idx - 1 + list.length) % list.length];
			next?.click();
		},

		// ─────────────────────────────────────────────
		// PAGE NAVIGATION
		// ─────────────────────────────────────────────
		jumpToSearchBar: () => { document.getElementById('address').focus() },
		goBack: () => webview?.canGoBack() && webview.goBack(),
		goForward: () => webview?.canGoForward() && webview.goForward(),
		reload: () => webview?.reload(),
		hardReload: () => webview?.reloadIgnoringCache(),
		stop: () => webview?.stop(),

		// ─────────────────────────────────────────────
		// PAGE ACTIONS
		// ─────────────────────────────────────────────
		savePage,
		print: () => webview?.print(),
		viewSource,

		translatePage,
		copyPageUrl,
		openInSidebarCurrent,

		// ─────────────────────────────────────────────
		// FRAME ACTIONS
		// ─────────────────────────────────────────────
		reloadFrame: () => webview?.reload(),
		viewFrameSource: () => webview?.openDevTools(),

		// ─────────────────────────────────────────────
		// MEDIA ACTIONS
		// ─────────────────────────────────────────────
		togglePlay: () => webview?.executeJavaScript(`document.activeElement?.paused ? document.activeElement.play() : document.activeElement.pause()`),
		toggleMute: () => webview?.executeJavaScript(`document.activeElement.muted = !document.activeElement.muted`),
		toggleLoop: () => webview?.executeJavaScript(`document.activeElement.loop = !document.activeElement.loop`),
		togglePiP: () => webview?.executeJavaScript(`
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture();
            } else {
                document.activeElement?.requestPictureInPicture?.();
            }
        `),
		toggleVideoFullscreen: () => webview?.executeJavaScript(`if (document.activeElement && document.activeElement.requestFullscreen) document.activeElement.requestFullscreen()`),
		setPlaybackRate: ({ rate }) => webview?.executeJavaScript(`if (document.activeElement && document.activeElement.playbackRate !== undefined) document.activeElement.playbackRate = ${rate}`),
		seekBackward: ({ seconds }) => webview?.executeJavaScript(`if (document.activeElement && document.activeElement.currentTime !== undefined) document.activeElement.currentTime -= ${seconds}`),
		seekForward: ({ seconds }) => webview?.executeJavaScript(`if (document.activeElement && document.activeElement.currentTime !== undefined) document.activeElement.currentTime += ${seconds}`),

		// ─────────────────────────────────────────────
		// ZOOM
		// ─────────────────────────────────────────────
		zoomIn,
		zoomOut,
		zoomReset,

		// ─────────────────────────────────────────────
		// UTILITIES
		// ─────────────────────────────────────────────
		findInPage: () => openFindPopup(addressMore),
		toggleFullscreen,
		openSettings: () => openSidebarApp('pages/settings/index.html', 'Settings', true),

		// Screenshot
		screenshotTab: async () => {
			if (!webview?.capturePage) return;
			const img = await webview.capturePage();
			active.screenshot = img.toDataURL();
		},

		// Bookmarks
		addCBookmark: () => addBookmark(activeProfile || 'Default', {
			title: active.title || active.url,
			url: active.url,
			favicon: active.favicon,
			createdAt: Date.now()
		}),
		addBookmark: ({ url, title }) => addBookmark(activeProfile || 'Default', {
			title,
			url,
			favicon: null,
			createdAt: Date.now()
		}),

		// File / Location
		openFile,
		openLocation,

		// Managers
		tabManager: () => openSidebarApp('pages/managers/index.html?manager=tabs', 'Manager', true),
		bookmarksManager: () => openSidebarApp('pages/managers/index.html?manager=bookmarks', 'Manager', true),
		historyManager: () => openSidebarApp('pages/managers/index.html?manager=history', 'Manager', true),

		openSidebarApp: () => { openSidebarApp(payload.url) },

		// ─────────────────────────────────────────────
		// DEVTOOLS
		// ─────────────────────────────────────────────
		devtools: () => webview?.openDevTools(),
		inspectElement: ({ x, y }) => webview?.inspectElement(x, y),

		// ─────────────────────────────────────────────
		// AUTOFILL
		// ─────────────────────────────────────────────
		autofill: ({ username, password }) => {
			webview?.executeJavaScript(`
				const active = document.activeElement;
				if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
					active.value = '${username}';
					active.dispatchEvent(new Event('input', { bubbles: true }));
					active.dispatchEvent(new Event('change', { bubbles: true }));
					// For password, find next input
					const inputs = Array.from(document.querySelectorAll('input[type="password"]'));
					const idx = inputs.indexOf(active);
					if (idx >= 0 && inputs[idx + 1]) {
						inputs[idx + 1].value = '${password}';
						inputs[idx + 1].dispatchEvent(new Event('input', { bubbles: true }));
						inputs[idx + 1].dispatchEvent(new Event('change', { bubbles: true }));
					}
				}
			`);
		},
		nameWindow: () => {
			const title = prompt("Name Window");
			if (title) document.querySelector("title").innerText = title;
		},
		closeWindow: () => {
			window.close();
		}
	};

	// Execute action
	if (actions[type]) {
		try {
			await actions[type](payload);
		} catch (err) {
			console.error(`Context action failed: ${type}`, err);
		}
	} else {
		console.warn(`Unknown context action: ${type}`);
	}
}


backBtn.addEventListener('contextmenu', function (e) {
	e.preventDefault();

	const activeTab = getActive();
	const allHistoryTab = getTabHistory(activeTab.shortId) || [];
	let eitem = [];

	allHistoryTab.forEach(item => {
		const aItem = {
			name: item.title,
			icType: item.favicon ? 'img' : 'GF',
			icon: item.favicon || 'globe',
			category: 'Tab Category',
			function: () => {
				const tabId = activeTab.shortId;
				const webview = activeTab.webview;

				tabHistory[tabId].suppress = true;
				webview.loadURL(item.url);
			}
		};

		eitem.push(aItem);
	});
	createContextMenu(eitem, backBtn);
});


aiBtn.onclick = async () => {
	const sidebar = await openSidebarApp('https://copilot.com', 'AI Chatbox', false)

	setTimeout(async () => {
		sidebar.querySelector('nav span').innerHTML = ''

		const selectA = document.createElement('select');

		const sO = await loadSetting('ai.selectedModel')

		selectA.innerHTML = `
		<option ${sO == 'gemini' ? 'selected' : ''} value="https://gemini.google.com/">Google Gemini</option>
		<option ${sO == 'deepSearch' ? 'selected' : ''} value="https://www.google.com/search?q=&newwindow=1&sca_esv=d308283755114a51&sxsrf=AE3TifOmNKG2v7pj3yMYdriHgXRz3QlN8Q%3A1767759083726&source=hp&ei=69xdae6UKr7B0PEPiPWVyQQ&iflsig=AOw8s4IAAAAAaV3q-ycDepRgBDssZSvWoe4uNlowuGTw&aep=22&udm=50&ved=0ahUKEwiutu3hx_iRAxW-IDQIHYh6JUkQteYPCBg&oq=&gs_lp=Egdnd3Mtd2l6IgBIAFAAWABwAHgAkAEAmAEAoAEAqgEAuAEByAEAmAIAoAIAmAMAkgcAoAcAsgcAuAcAwgcAyAcAgAgA">Google DeepSearch</option>
		<option ${sO == 'chatgpt' ? 'selected' : ''} value="https://chatgpt.com/">ChatGPT</option>
		<option ${sO == 'copilot' || !sO ? 'selected' : ''} value="https://copilot.microsoft.com/">Microsoft Copilot</option>
		`

		selectA.onchange = () => {
			sidebar.querySelector('webview').src = selectA.value
		}
		sidebar.querySelector('webview').src = selectA.value
		sidebar.querySelector('nav span').appendChild(selectA)
	}, 800)


}

document.getElementById('viewWebsiteInfo').addEventListener('click', async function () {
	const tab = getActive();
	if (!tab?.url || !tab?.webview) return;

	const id = tab.webview.getWebContentsId();
	const certInfo = await window.electronAPI.getWebviewCertificate(id);

	console.log(certInfo);

	// Parse once with URL()
	const u = new URL(tab.url);

	const shortUrl = `${u.protocol}//${u.hostname}/`;

	const items = [
		{ icon: 'link', icType: 'GF', name: tab.url, category: 'Full URL' },
		{ icon: 'link', icType: 'GF', name: shortUrl, category: 'Page' },
	];

	if (certInfo && certInfo.certificate) {
		items.push({
			icon: 'verified', icType: 'GF', name: `Certificate: ${certInfo.certificate.subject || 'Unknown'}`, category: 'Security',
			submenu: [
				{ icon: 'info', icType: 'GF', name: `Issuer: ${certInfo.certificate.issuer || 'Unknown'}`, category: 'Details' },
				{ icon: 'calendar_today', icType: 'GF', name: `Valid until: ${new Date(certInfo.certificate.validTo * 1000).toLocaleDateString()}`, category: 'Details' },
			]
		});
	}

	// Permissions for this site
	const permissions = ['notifications', 'geolocation', 'camera', 'microphone', 'clipboard-read', 'clipboard-write'];
	const permItems = [];
	for (const perm of permissions) {
		const decision = await loadPermission(u.origin, perm);
		permItems.push({
			icon: decision === 'allow' ? 'check_circle' : decision === 'deny' ? 'cancel' : 'help',
			icType: 'GF',
			name: `${perm}: ${decision || 'Not set'}`,
			category: 'Permissions',
			function: () => managePermission(u.origin, perm)
		});
	}
	items.push(
		{
			icon: 'security', icType: 'GF', name: 'Permissions', category: 'Security',
			submenu: permItems
		},
		{ icon: 'search_insights', icType: 'GF', name: 'About this site', category: 'Learn More', function: () => { openSidebarApp(makeSearchUrl(shortUrl), 'About this Site'), false } }
	);

	createContextMenu(items, document.getElementById('viewWebsiteInfo'));
});


document.getElementById('top-part').addEventListener('contextmenu', (e) => {
	e.preventDefault();

	const tabEl = e.target.closest('.tab');
	const clickX = e.clientX;
	const clickY = e.clientY;

	// -----------------------------
	// CASE 1: User right-clicked a TAB
	// -----------------------------
	if (tabEl) {
		const tabId = tabEl.dataset.id;
		const tabObj = tabs.find(t => t.id === tabId);

		if (!tabObj) return; // safety

		const isPinned = !!tabObj.pinned;
		const isMuted = tabObj.webview.isAudioMuted();

		const activeAndSameTab = getActive()?.id === tabId

		console.log(activeAndSameTab + ' ' + '' + isPinned);

		const items = [
			{ icon: 'tab', icType: 'GF', name: 'New Tab', shortcut: 'Ctrl+T', category: 'Tabs', function: () => createTab('about:blank') },

			// Soon to implement
			// { name: "Reload Tab", icon: "refresh", icType: "GF", function: () => runContextAction('tabReload', tabId) },
			{ name: "Duplicate Tab", icon: "tab_duplicate", icType: "GF", function: () => tabObj.url && createTab(tabObj.url) },

			{ name: "Move to Start", icon: "arrow_upward", icType: "GF", function: () => moveTabToStart(tabEl) },
			{ name: "Move to End", icon: "arrow_downward", icType: "GF", function: () => moveTabToEnd(tabEl) },

			{ icon: isMuted ? 'volume_up' : 'volume_off', icType: 'GF', name: isMuted ? 'Unmute Tab' : 'Mute Tab', function: () => toggleMute(tabObj.webview) },

			{ icon: 'push_pin', icType: 'GF', name: 'Pin Tab', disabled: isPinned && activeAndSameTab, function: () => { tabObj.pinned = true; tabEl.classList.add('pinned'); } },
			{ icon: 'push_pin', icType: 'GF', name: 'Unpin Tab', disabled: !isPinned && activeAndSameTab, function: () => { tabObj.pinned = false; tabEl.classList.remove('pinned'); } },

			{ icon: 'close', icType: 'GF', name: 'Close Tab', shortcut: 'Ctrl+W', category: 'Close', disabled: isPinned, function: () => closeTab(tabId) },
			{ icon: 'filter_none', icType: 'GF', name: 'Close Other Tabs', disabled: isPinned, function: () => closeOtherTabs(tabId) },
			{ icon: 'subdirectory_arrow_right', icType: 'GF', name: 'Close Tabs to the Right', disabled: isPinned, function: () => closeTabsToRight(tabId) },

			// { icon: 'restore_page', icType: 'GF', name: 'Reopen Closed Tab', function: reopenClosedTab }
		];

		createContextMenu(items, tabEl, clickX, clickY);
		return;
	}

	// -----------------------------
	// CASE 2: User right-clicked EMPTY TITLEBAR AREA
	// -----------------------------
	const items = [
		{ icon: 'tab', icType: 'GF', name: 'New Tab', shortcut: 'Ctrl+T', function: () => createTab('pages/new-tab/index.html') },
		{ icon: 'open_in_browser', icType: 'GF', name: 'New Window', function: () => runContextAction('newWindow') },

		{
			icon: 'bookmark',
			icType: 'GF',
			name: 'Bookmark All Open Tabs',
			function: () => {
				tabs.forEach(tab => addBookmark(activeProfile, {
					title: tab.title || tab.url,
					url: tab.url,
					favicon: tab.favicon || null,
					createdAt: Date.now()
				}, false));
			}
		},

		{
			icon: 'view_sidebar',
			icType: 'GF',
			name: 'Show/Hide Bookmarks Bar',
			function: () => { updateSetting('showBookmarksBar', false ? true : false); window.postMessage({ updateSettings: true }, "*"); }
		},

		{
			icon: 'settings',
			icType: 'GF',
			name: 'Browser Settings',
			function: () => { btnSettings.click() }
		}
	];

	createContextMenu(items, undefined, clickX, clickY);
});

function toggleBookmarkBar() {
	const current = loadSetting('showBookmarksBar')
	updateSetting('showBookmarksBar', false);
	window.postMessage({ updateSettings: true }, "*");
}

window.permissionsAPI.onRequest(async ({ origin, permission }) => {
	const existing = await loadPermission(origin, permission);
	if (existing === 'allow') {
		e.request.allow();
		return;
	} else if (existing === 'deny') {
		e.request.deny();
		return;
	}

	content = `
		<h4>Requesting Permission</h4>
		<p>${getBaseURL(origin)} is asking for ${permission} permission.</p>
		<div class="flex" style="gap: 10px;">
			<button id="denyPerm">Deny</button>
			<button id="allowOnce">Allow Once</button>
			<button id="allowAlways">Allow Always</button>
			<button id="never">Never</button>
		</div>
		`
	const popup = createPopup(content, document.getElementById('viewWebsiteInfo'), undefined, undefined)
	popup.classList.add('permission-prompt')
	document.getElementById('denyPerm').onclick = () => {
		e.request.deny()
		popup.remove()
	}
	document.getElementById('allowOnce').onclick = () => {
		e.request.allow()
		popup.remove()
	}
	document.getElementById('allowAlways').onclick = async () => {
		await savePermission(origin, permission, 'allow');
		e.request.allow()
		popup.remove()
	}
	document.getElementById('never').onclick = async () => {
		await savePermission(origin, permission, 'deny');
		e.request.deny()
		popup.remove()
	}
});

function getAllTabs() { return tabs; }

function bookmarksKey(profile) { return `bookmarks:${profile}`; }
function getBookmarks(profile) {
	const raw = localStorage.getItem(bookmarksKey(profile));
	return raw ? JSON.parse(raw) : [];
}
function addBookmark(profile = activeProfile, bm, edit = true) {
	if (!profile) profile = activeProfile;

	if (!bm) {
		const active = getActive();
		if (!active || !active.url) {
			return;
		}
		bm = {
			title: active.title || active.url,
			url: active.url,
			favicon: active.favicon || null,
			createdAt: Date.now()
		};
	} else if (typeof bm === 'string') {
		bm = {
			title: bm,
			url: bm,
			favicon: null,
			createdAt: Date.now()
		};
	} else {
		bm = {
			title: bm.title || bm.url || getBaseURL(bm.url || '') || 'Untitled',
			url: bm.url || '',
			favicon: bm.favicon || null,
			folder: bm.folder || '',
			createdAt: bm.createdAt || Date.now()
		};
	}

	if (!bm.url) return;

	try {
		const list = getBookmarks(profile);
		const exists = list.find(x => x.url === bm.url);
		const updated = exists ? list.map(x => x.url === bm.url ? bm : x) : [bm, ...list];
		localStorage.setItem(bookmarksKey(profile), JSON.stringify(updated.slice(0, 500)));
	} catch (error) {
		alert("Couldn't add bookmark")
		console.error('addBookmark failed', error, profile, bm);
		return;
	}

	if (edit) {
		console.log(bm);
		editBookmark(bm, profile);
	} else {
		// optional non-edit popup for silent save
		const pop = createPopup('Bookmark saved', bookmarkBtn);
		const btn = pop.querySelector('button');
		if (btn) {
			btn.addEventListener('click', function () {
				pop.remove();
			});
		}
	}
}
function editBookmark(bookmarkInfo, profile = activeProfile) {
	const content = `
    <div style="display: flex; gap: 20px; align-items: center;">
        ${bookmarkInfo.favicon
			? `<img style="height: 18px;" src="${bookmarkInfo.favicon}">`
			: `<i style="font-size: 18px;" class="material-symbols-rounded">globe</i>`}
        <p>${bookmarkInfo.title}</p>
    </div>

    <h3>Edit Bookmark</h3>

    <form id="editBM">
        <div class="f-i">
            <p>Title</p>
            <input id="editBMtitle" value="${bookmarkInfo.title}">
        </div>

        <div class="f-i">
            <p>URL:</p>
            <input id="editBMurl" value="${bookmarkInfo.url}">
        </div>

        <div class="f-i">
            <p>Folder:</p>
            <input id="editBMfolder" value="${bookmarkInfo.folder || ''}" placeholder="e.g. coding, work/personal">
        </div>

        <div class="btm-strip" style="display: flex; justify-content: right; gap: 5px; width: calc(100% - 50px); margin-top: 20px;">
            <button type="reset">Cancel</button>
            <button type="submit">Save</button>
        </div>
    </form>
    `;

	const pop = createOverlayPopup(content, '600px', '800px', true);

	// Cancel button
	pop.querySelector('form').onreset = () => {
		pop.classList.remove('open');
		setTimeout(() => {
			document.getElementById('backdrop-for-pop')?.remove();
		}, 500);
	};

	// Save button
	pop.querySelector('form').onsubmit = (e) => {
		e.preventDefault();

		const bm = {
			title: pop.querySelector('#editBMtitle').value.trim(),
			url: pop.querySelector('#editBMurl').value.trim(),
			favicon: bookmarkInfo.favicon,
			folder: pop.querySelector('#editBMfolder').value.trim(),
			createdAt: bookmarkInfo.createdAt
		};

		const list = getBookmarks(profile);
		const updated = list.map(x => x.createdAt === bookmarkInfo.createdAt ? bm : x);

		localStorage.setItem(bookmarksKey(profile), JSON.stringify(updated.slice(0, 500)));

		pop.classList.remove('open');
		setTimeout(() => {
			document.getElementById('backdrop-for-pop')?.remove();
		}, 500);
	};
}

function removeBookmark(profile, url) {
	const list = getBookmarks(profile).filter(b => b.url !== url);
	localStorage.setItem(bookmarksKey(profile), JSON.stringify(list));
}

// Keep track of used short IDs
const usedShortIds = new Set();

// Generate a collision-safe short ID (base-36)
function generateUniqueShortId(prefix = 'tab', length = 8) {
	let id;
	do {
		const chunk = Math.random().toString(36).slice(2, 2 + length);
		id = `${prefix}-${chunk}`;
	} while (usedShortIds.has(id) || document.getElementById(id));
	usedShortIds.add(id);
	return id;
}

async function addTabElement(tab, index = undefined, playAnimation = false) {
	if (!tabsBar) return;
	const el = document.createElement('button');
	el.className = 'tab';
	el.dataset.id = tab.id;
	el.dataset.shortId = tab.shortId;
	el.dataset.url = tab.url;
	el.dataset.title = tab.title || tab.url;
	el.dataset.audio = tab.audio || false;

	tab.tabElement = el

	el.style.display = 'flex';
	el.style.alignItems = 'center';
	el.style.gap = '6px';

	// Spinner
	const spinner = document.createElement('div');
	spinner.className = 'spinner';
	spinner.style.display = 'none';
	tab.spinner = spinner;
	spinner.innerHTML = `
	  <div class="load">
		<svg class="load" viewBox="25 25 50 50" class="spinner">
		  <circle r="20" cy="50" cx="50"></circle>
		</svg>
	  </div>
	`;
	el.appendChild(spinner);

	// First container (favicon + globe + title + audio)
	const firstCont = document.createElement('span');
	firstCont.style.display = 'flex';
	firstCont.style.gap = '4px';
	firstCont.style.alignItems = 'center';

	const audIcon = document.createElement('i')
	audIcon.classList.add('material-symbols-rounded', 'audio-icon-tab')
	audIcon.innerHTML = `play_circle`
	firstCont.appendChild(audIcon)

	// favicon placeholder
	const fav = document.createElement('img');
	fav.className = 'tab-favicon';
	Object.assign(fav.style, {
		width: '14px',
		height: '14px',
		borderRadius: '3px',
		objectFit: 'cover'
	});
	fav.style.display = 'none';
	firstCont.appendChild(fav);

	// globe placeholder
	const globe = document.createElement('span');
	globe.className = 'tab-globe';
	globe.innerHTML = `<i class="material-symbols-rounded">globe</i>`;
	firstCont.appendChild(globe);

	// title
	const title = document.createElement('span');
	title.textContent = tab.title || tab.url;
	title.className = 'tab-title';
	Object.assign(title.style, {
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis'
	});
	firstCont.appendChild(title);

	el.appendChild(firstCont);

	// close button
	const closeBtn = document.createElement('button');
	closeBtn.textContent = '✕';
	closeBtn.style.marginLeft = '8px';
	closeBtn.onclick = (e) => {
		e.stopPropagation();
		closeTab(tab.id);
	};
	el.appendChild(closeBtn);

	// click to activate
	el.onclick = () => { setActiveTab(tab.id); };

	// Attach mousedown listener for this tab (per-tab)

	el.addEventListener('mousedown', (e) => {
		if (e.button !== 0 || tab.pinned) return; // Only left mouse button, skip pinned tabs

		setActiveTab(tab.id);

		// Initiate drag with this tab
		dragState.isDragging = true;
		dragState.dragStartX = e.clientX;
		dragState.dragStartIndex = tabs.indexOf(tab);
		dragState.currentDropIndex = dragState.dragStartIndex;
		dragState.draggedTab = tab;
		dragState.draggedEl = el;

		el.style.zIndex = '1000';
		el.classList.add('dragging-tab');

		// Cache tab widths for smooth positioning
		dragState.tabWidths = new Map();
		tabsBar.querySelectorAll('.tab:not(.new-tab)').forEach(tabNode => {
			dragState.tabWidths.set(tabNode.dataset.id, tabNode.getBoundingClientRect().width);
		});
	});

	// --- insertion logic ---
	const newTabBtn = tabsBar.querySelector('.new-tab');

	newTabBtn.onclick = () => {
		createTab('pages/new-tab/index.html')
	}
	let referenceEl = null;

	if (typeof index === 'number') {
		// find the tab element that currently occupies this index
		const nextTab = tabs[index + 1];
		if (nextTab) {
			referenceEl = tabsBar.querySelector(`.tab[data-id="${nextTab.id}"]`);
		}
	}

	if (referenceEl) {
		tabsBar.insertBefore(el, referenceEl);
	} else if (newTabBtn) {
		tabsBar.insertBefore(el, newTabBtn);
	} else {
		tabsBar.appendChild(el);
	}

	if (playAnimation) {
		el.style.overflow = 'hidden';
		el.classList.add('open-animation');

		// Initial collapsed state
		el.style.maxWidth = '0px';
		el.style.minWidth = '0px';

		// Force a reflow so the browser commits the initial state
		el.getBoundingClientRect();

		// Now expand
		requestAnimationFrame(() => {
			el.style.minWidth = '';
			el.style.maxWidth = '';
			setTimeout(() => {
				el.classList.remove('open-animation');
			}, 400)
		});
	}

	const db = await openDB();
	const tx = db.transaction('tabs', 'readwrite');
	const store = tx.objectStore('tabs');
	store.put({
		id: tab.id,
		shortId: tab.shortId,
		title: tab.title || tab.url,
		url: tab.url,
		visitedAt: Date.now()
	});
	await transactionDone(tx);

	return el;
}

async function removeTabElement(id) {
	if (!tabsBar) return;
	const el = tabsBar.querySelector(`.tab[data-id="${id}"]`);
	if (!el) return;

	el.style.overflow = 'hidden';
	el.classList.add('close-animation');

	// Measure the current width BEFORE collapsing
	const width = el.getBoundingClientRect().width;

	// Set the starting width explicitly
	el.style.maxWidth = width + 'px';
	el.style.minWidth = width + 'px';

	// Force reflow so the browser commits the starting width
	el.getBoundingClientRect();

	// Animate to 0
	requestAnimationFrame(() => {
		el.style.maxWidth = '0px';
		el.style.minWidth = '0px';

		// Remove after animation ends
		setTimeout(() => {
			el.remove();
		}, 400);
	});

	// Remove from DB
	const db = await openDB();
	const tx = db.transaction('tabs', 'readwrite');
	const store = tx.objectStore('tabs');
	store.delete(id);
	await transactionDone(tx);
}

async function updateTabElement(tab) {
	if (!tabsBar || !tab) return;
	const el = tabsBar.querySelector(`.tab[data-id="${tab.id}"]`);
	if (!el) return;

	el.dataset.title = tab.title || tab.url;
	el.dataset.url = tab.url;
	el.dataset.audio = tab.audio || false;

	const titleEl = el.querySelector('.tab-title');
	if (titleEl) titleEl.textContent = tab.title || tab.url;

	const favEl = el.querySelector('.tab-favicon');
	const globeEl = el.querySelector('.tab-globe');

	if (tab.id == getActive().id) {
		document.querySelector('title').innerText = `${getBaseURL(tab.url)} - ${activeProfile} - Bluebird Browser`
	}

	if (tab.favicon) {
		if (favEl) {
			favEl.src = tab.favicon;
			favEl.style.display = 'inline';
		}
		if (globeEl) globeEl.style.display = 'none';
	} else {
		if (favEl) favEl.style.display = 'none';

		if (!globeEl) {
			const dot = document.createElement('span');
			dot.className = 'tab-globe';
			dot.innerHTML = `<i class="material-symbols-rounded">globe</i>`;
			const firstCont = el.querySelector('span');
			if (firstCont && titleEl) firstCont.insertBefore(dot, titleEl);
		} else {
			globeEl.style.display = 'inline';
		}
	}

	if (tab.pinned) {
		tab.tabElement.classList.add('pinned');
		tab.tabElement.draggable = false;
		moveTabToStart(tab.tabElement)
	} else {
		tab.tabElement.classList.remove('pinned');
		// tab.tabElement.draggable = true;
	}

	const audIcon = el.querySelector('.audio-icon-tab')
	if (tab.audio) {
		audIcon.style.display = 'unset';
	} else {
		audIcon.style.display = 'none';
	}

	el.dataset.favicon = tab.favicon

	updateTabOnStorage(tab);
	updateOverflow();

	// if (document.getElementById('active-overflow-tag')) {
	// 	document.getElementById('active-overflow-tag').remove()
	// }
}

function showTabLeftInfo(info) {
	setTimeout(() => {
		const active = getActive();
		const existing = document.getElementById("active-overflow-tag");

		if (info.tabElement.dataset.visible === "visible") {
			if (existing) existing.remove();
			return;
		}

		if (active.id !== info.id || info.tabElement.dataset.visible !== "hidden") {
			return;
		}

		const tag = existing || document.createElement("button");
		tag.id = "active-overflow-tag";
		tag.classList.add("hiddenActiveTab");

		tag.innerHTML = `
            <div>
                ${info.favicon
				? `<img src="${info.favicon}">`
				: `<i class="material-symbols-rounded">globe</i>`}
                <span>${info.title}</span>
            </div>
            <i class="material-symbols-rounded">keyboard_arrow_down</i>
        `;

		tag.onclick = () => {
			createContextMenu(
				[
					{ icType: 'GF', icon: "visibility", name: 'Show Preview', category: 'Preview', function: () => { showTabInfo(info.title, info.url, info.favicon, tag, info.shortId) } },

					{ icType: 'GF', icon: "", name: 'Duplicate Tab', category: 'Tab Options', function: () => { createTab(info.url) } },
					{ icType: 'GF', icon: "pin", name: 'Pin Tab', category: 'Tab Options', function: () => { togglePin(info.tabElement) } },
					{ icType: 'GF', icon: "volume_off", name: 'Toggle Mute', category: 'Tab Options', function: () => { toggleMute(info.webview) } },

					{ icType: 'GF', icon: "arrow_left", name: 'Select Previous Tab', category: 'Select Tab', function: () => { runContextAction('previousTab') } },
					{ icType: 'GF', icon: "arrow_right", name: 'Select Next Tab', category: 'Select Tab', function: () => { runContextAction('nextTab') } },

					{ icType: 'GF', icon: "arrow_upward", name: 'Move Tab to Start', category: 'Move Tab', function: () => { moveTabToStart(info.tabElement) } },
					{ icType: 'GF', icon: "arrow_downward", name: 'Move Tab to End', category: 'Move Tab', function: () => { closeTab(info.tabElement) } },

					{ icType: 'GF', icon: "close", name: 'Close Tab', category: 'Close Tab', function: () => { closeTab(info.id) } },
					{ icType: 'GF', icon: "filter_none", name: 'Close Other Tabs', category: 'Close Tab', function: () => { closeOtherTabs(info.id) } },
					{ icType: 'GF', icon: "subdirectory_arrow_right", name: 'Close Tabs to the Right', category: 'Close Tab', function: () => { closeTabsToRight(info.id) } },

					{ icType: 'GF', icon: "settings", name: 'Tab Manager', category: 'Manage', function: () => { openSidebarApp('pages/managers/index.html', 'Manager', true) } }
				], tag
			)
		}

		tabsContainer.prepend(tag);
	}, 50);
}

async function updateTabOnStorage(tab) {
	const db = await openDB();
	const tx = db.transaction('tabs', 'readwrite');
	const store = tx.objectStore('tabs');
	store.put({
		id: tab.id,
		shortId: tab.shortId,
		title: tab.title || tab.url,
		url: tab.url,
		visitedAt: Date.now()
	});
	await transactionDone(tx);
}

window.electronAPI.onNewTab((payload) => {
	const targetUrl = typeof payload === 'string' ? payload : payload?.url;
	if (!targetUrl) return;
	// open immediately to the right of the active tab
	createTab(targetUrl, { insertAfterActive: true });
});


function createTab(url, opts = {}) {
	const id = crypto.randomUUID();
	const shortId = generateUniqueShortId('tab', 8);

	const wv = document.createElement('webview');
	wv.src = url;
	wv.id = shortId;

	wv.setAttribute("preload", "preload.js");
	wv.setAttribute('allowpopups', 'false');
	wv.setAttribute('allow', 'allow="autoplay; picture-in-picture"');
	wv.setAttribute('webpreferences', 'contextIsolation=yes, nativeWindowOpen=yes');
	wv.setAttribute('partition', `persist:${activeProfile}`);

	const userAgent = isMac
		? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
		: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
	wv.setAttribute('useragent', userAgent);

	const isInternal = url.startsWith('file://')
	if (isInternal) {
		wv.preload = 'preload.js';
		const userAgent = isMac
			? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 BluebirdBrowser 1.2.0"
			: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 BluebirdBrowser 1.2.0";
		wv.setAttribute('useragent', userAgent);
	}

	Object.assign(wv.style, {
		zIndex: '-1',
		flex: '1',
		width: '100%',
		border: 'none',
		position: 'absolute'
	});

	const tab = {
		id,
		shortId,
		url,
		title: opts.title || url,
		webview: wv,
		favicon: null,
		audio: false,
		screenshot: null,
		tabElement: null,
		media: {
			isPlaying: false,
			duration: 0,
			currentTime: 0,
			title: '',
			thumbnail: ''
		}
	};

	// Determine insertion index
	let insertIndex;
	if (typeof opts.index === 'number') {
		insertIndex = Math.max(0, Math.min(opts.index, tabs.length));
	} else if (opts.insertAfterActive) {
		const activeIndex = tabs.findIndex(t => t.id === activeTab);
		insertIndex = activeIndex === -1 ? tabs.length : activeIndex + 1;
	} else {
		insertIndex = tabs.length; // append
	}

	// Insert into tabs array at insertIndex
	tabs.splice(insertIndex, 0, tab);

	// Persist open tabs list
	localStorage.setItem('tabsOpen', JSON.stringify(tabs.map(t => ({
		id: t.id,
		shortId: t.shortId,
		url: t.url,
		title: t.title
	}))));

	// Insert webview into views at the same index
	if (views) {
		const referenceView = views.children[insertIndex]; // may be undefined -> append
		if (referenceView) {
			views.insertBefore(wv, referenceView);
		} else {
			views.appendChild(wv);
		}
	}

	if (url == 'pages/new-tab/index.html') {
		setTimeout(function () {
			address.value = ''
			address.focus()
			address.select()
		}, 220)
	}

	// Create and insert tab element at the same index
	addTabElement(tab, insertIndex, true);

	// Activate the new tab
	setActiveTab(id);

	// --- Webview Event Wiring ---
	wv.addEventListener("dom-ready", () => {
		showTabLeftInfo(getActive());

		wv.executeJavaScript(`
			window.alert = (msg) => {
				window.electronAPI.customAlert(msg);
			};
	
			window.confirm = (msg) => {
				return window.electronAPI.customConfirm(msg);
			};
	
			window.prompt = (msg, def = "") => {
				return window.electronAPI.customPrompt(msg, def);
			};
		`);

		if (url === 'pages/new-tab/index.html') {
			wv.executeJavaScript(`localStorage.setItem('currentProfile', '${activeProfile}');`);
		}
	});

	// --- did-start-loading ---
	wv.addEventListener('did-start-loading', () => {
		if (tab.spinner) tab.spinner.style.display = 'inline-block';
	});

	// --- did-stop-loading ---
	wv.addEventListener('did-stop-loading', () => {
		showTabLeftInfo(getActive());

		if (tab.spinner) tab.spinner.style.display = 'none';

		const entry = {
			url: wv.getURL(),
			title: tab.title || wv.getTitle() || wv.getURL(),
			favicon: tab.favicon || `globe`
		};

		setTimeout(() => {
			addHistoryEntry(activeProfile || 'Default', entry);
		}, 1000);

	});

	// --- did-start-navigation ---
	wv.addEventListener('did-start-navigation', (e) => {
		if (!e.isMainFrame) return;

		tab.url = e.url;
		const isInternal = tab.url.startsWith('file://');
		wv.preload = isInternal ? 'preload.js' : '';

		if (id === activeTab) updateAddressBar(e.url);

		updateTabElement(tab);
		address.blur();
		updateNavButtons(wv);

	});

	// --- did-navigate ---
	wv.addEventListener('did-navigate', (e) => {
		showTabLeftInfo(getActive());

		if (!e.isMainFrame) return;

		tab.url = e.url;
		if (id === activeTab) updateAddressBar(e.url);

		updateTabElement(tab);
		updateNavButtons(wv);

	});

	// --- did-navigate-in-page ---
	wv.addEventListener('did-navigate-in-page', (e) => {
		showTabLeftInfo(getActive());

		if (!e.isMainFrame) return;

		tab.url = e.url;
		if (id === activeTab) updateAddressBar(e.url);

		updateTabElement(tab);
		updateNavButtons(wv);

	});

	// --- did-finish-load ---
	wv.addEventListener('did-finish-load', () => {
		showTabLeftInfo(getActive());

		tab.url = wv.getURL();
		if (id === activeTab) updateAddressBar(tab.url);

		wv.capturePage().then(image => {
			tab.screenshot = image.toDataURL();
		}).catch(err => {
			console.warn('Screenshot capture failed for tab:', tab.dataset.id, err);
		});

		updateTabElement(tab);
		updateNavButtons(wv);
	});

	// --- page-title-updated ---
	wv.addEventListener('page-title-updated', (e) => {
		tab.title = e.title || tab.url;
		updateTabElement(tab);
	});

	// --- page-favicon-updated ---
	wv.addEventListener('page-favicon-updated', (e) => {
		tab.favicon = e.favicons?.[0] || null;
		updateTabElement(tab);
	});

	// --- media-started-playing ---
	wv.addEventListener('media-started-playing', () => {
		tab.audio = true;
		tab.media.isPlaying = true;
		updateTabElement(tab);
		updateMediaManager();
	});

	// --- media-paused ---
	wv.addEventListener('media-paused', () => {
		tab.media.isPlaying = false;
		tab.audio = false;
		updateTabElement(tab);
		updateMediaManager();
	});

	// --- permissionrequest ---
	wv.addEventListener("permissionrequest", e => {
		e.preventDefault();

		const content = `
			<h4>Requesting Permission</h4>
			<p>${getBaseURL(url)} is asking ${e.permission} permissions.</p>
			<div class="flex">
				<button id="denyPerm">Deny</button>
				<button id="allowPerm">Allow</button>
			</div>
		`;

		const popup = createPopup(content, document.getElementById('viewWebsiteInfo'));
		popup.classList.add('permission-prompt');

		document.getElementById('denyPerm').onclick = () => {
			e.request.deny();
			popup.remove();
		};

		document.getElementById('allowPerm').onclick = () => {
			e.request.allow();
			popup.remove();
		};
	});

	// --- dom-ready (second listener) ---
	wv.addEventListener('dom-ready', () => {
		try {
			const wcId = wv.getWebContentsId();
			if (window.electronAPI?.registerWebview) {
				window.electronAPI.registerWebview(wcId);
			}
		} catch (err) {
			console.warn('getWebContentsId failed:', err);
		}
	});

	// --- did-attach ---
	wv.addEventListener('did-attach', () => {
		window.electronAPI.registerWebview(wv.getWebContentsId());
	});


	attachFindEvents(wv)

	wv.addEventListener('click', () => {
		removeContextMenus();
	});

	tabHistory[shortId] = {
		stack: [],
		index: -1
	};
	attachHistoryListeners(wv, shortId, tab);
	showTabLeftInfo(tab);

	return tab;
}

window.confirm = () => {
	console.log('Confirm')
}

function attachHistoryListeners(webview, shortId, info) {
	const record = () => {
		if (tabHistory[shortId].suppress) {
			tabHistory[shortId].suppress = false;
			return
		}
		const h = tabHistory[shortId];

		h.stack = h.stack.slice(0, h.index + 1);

		h.stack.push({
			title: info.title,
			url: webview.getURL(),
			title: info.title || webview.getTitle(),
			favicon: info.favicon || ""
		});

		h.index = h.stack.length - 1;
	};


	webview.addEventListener("did-navigate", record);
	webview.addEventListener("did-navigate-in-page", record);
}

function getTabHistory(shortId) {
	return tabHistory[shortId]?.stack || [];
}

async function addHistoryEntry(profile, { url, title, favicon }) {
	if (url.includes('bluebird_browser')) {
		return
	}
	const db = await openDB();
	const tx = db.transaction('history', 'readwrite');
	const store = tx.objectStore('history');
	store.put({
		profile,
		favicon,
		url,
		title,
		visitedAt: Date.now()
	});
	window.electronAPI.send('menu:update');
	await transactionDone(tx);
}

function getTabInfo(identifier) {
	if (!identifier) return null;

	let tab = tabs.find(t => t.id === identifier) || tabs.find(t => t.shortId === identifier);

	if (!tab) return null;

	return {
		id: tab.id,
		shortId: tab.shortId,
		url: tab.url,
		title: tab.title,
		favicon: tab.favicon,
		audio: tab.audio,
		screenshot: tab.screenshot
	};
}

function closeTab(id) {
	const idx = tabs.findIndex(t => t.id === id);
	if (idx === -1) return;

	const tab = tabs[idx];
	if (tab?.pinned) {
		console.warn('Cannot close a pinned tab');
		return;
	}

	tabs.splice(idx, 1);
	tab.webview.remove();
	removeTabElement(id);

	if (activeTab === id) {
		const next = tabs[idx] || tabs[idx - 1] || tabs[0];
		activeTab = next ? next.id : null;
		if (next) setActiveTab(next.id);
	}

	const hasPinned = tabs.some(t => t.pinned);
	if (tabs.length === 0 && !hasPinned) {
		window.close();
	}

	showTabLeftInfo(getActive());
}

function setActiveTab(id) {
	activeTab = id;

	tabs.forEach(t => {
		t.webview.style.zIndex = t.id === id ? '0' : '-1';
		const el = tabsBar?.querySelector(`.tab[data-id="${t.id}"]`);
		if (el) el.classList.toggle('active', t.id === id);
	});

	const tab = tabs.find(t => t.id === id);
	if (tab && address) {
		let displayUrl = tab.url;
		const withoutHttp = displayUrl.split("//");
		if (withoutHttp[1]) {
			displayUrl = withoutHttp[1];
		}
		address.value = displayUrl || tab.url;
	}

	var addUrl = tab.url

	if (tab.url.includes('pages/new-tab/index.html')) {
		// setTimeout(function () {
		address.value = ''
		// }, 100)
	}

	document.querySelector('title').innerText = `${getBaseURL(tab.url)} - ${activeProfile} - Bluebird Browser`

	showTabLeftInfo(tab);
}

function getActive() {
	return tabs.find(t => t.id === activeTab);
}

document.getElementById('bookmarks-bar').oncontextmenu = (e) => {
	e.preventDefault()
	createContextMenu([
		{ icType: 'GF', icon: 'hide', name: 'Hide Bookmarks Bar', category: 'Bookmark Bar', function: () => { updateSetting('showBookmarksBar', false); window.postMessage({ updateSettings: true }, "*"); } },
		{ icType: 'GF', icon: 'settings', name: 'Bookmark Bar Settings', category: 'Bookmark Bar' },
		{ icType: 'GF', icon: 'bookmark_manager', name: 'Bookmark Manager', category: 'Manager', function: () => { bookmarkManagerBtn.click() } }
	], null, e.x, e.y)
}

// --- Bookmarks ---
if (bookmarkBtn) {
	bookmarkBtn.onclick = () => {
		const active = getActive();
		if (!active) return;
		console.log(active)
		addBookmark(activeProfile || 'Default', {
			title: active.title || active.url,
			url: active.url,
			favicon: active.favicon,
			createdAt: Date.now()
		});
		bookmarkBtn.innerHTML = `
			<i title="Bookmark" class="material-symbols-rounded">check</i>
		`;
		setTimeout(() => (bookmarkBtn.innerHTML = `<i title="Bookmark" class="material-symbols-rounded">bookmark_add</i>`), 800);
		window.electronAPI.send('menu:update');
	};
}

document.addEventListener("keydown", (e) => {
	const isMac = navigator.platform.toUpperCase().includes("MAC");
	const mod = isMac ? e.metaKey : e.ctrlKey;

	if (mod) {
		const num = parseInt(e.key, 10);
		if (!isNaN(num) && num >= 1 && num <= 9) {
			const tabs = [...document.querySelectorAll(".tab")];
			if (tabs.length === 0) return;

			let targetIndex;
			if (num === 9) {
				targetIndex = tabs.length - 1;
			} else {
				targetIndex = num - 1;
				if (targetIndex >= tabs.length) return;
			}

			const targetTab = tabs[targetIndex];
			if (!targetTab) return;

			targetTab.click();

			e.preventDefault();
			return;
		}
	}

	if ((e.ctrlKey || e.metaKey) && !e.altKey) {
		if (e.key === '+' || e.key === '=' || e.key === 'Add') {
			e.preventDefault();
			zoomIn();
			return;
		}
		if (e.key === '-' || e.key === 'Subtract') {
			e.preventDefault();
			zoomOut();
			return;
		}
		if (e.key === '0') {
			e.preventDefault();
			zoomReset();
			return;
		}
	}

	if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
		const list = getBookmarks(activeProfile || 'Default');
		const panel = document.createElement('div');
		panel.style.position = 'absolute';
		panel.style.top = '92px';
		panel.style.right = '12px';
		panel.style.background = '#1a1b20';
		panel.style.padding = '12px';
		panel.style.borderRadius = '8px';
		panel.style.maxHeight = '300px';
		panel.style.overflow = 'auto';
		panel.innerHTML = `<strong>Bookmarks</strong>`;
		list.forEach(b => {
			const item = document.createElement('div');
			item.style.marginTop = '8px';
			item.innerHTML = `<a href="#" style="color:#e6e7ea;text-decoration:none">${b.title}</a>`;
			item.querySelector('a').onclick = (ev) => {
				ev.preventDefault();
				createTab(b.url);
				panel.remove();
			};
			panel.appendChild(item);
		});
		document.body.appendChild(panel);
		setTimeout(() => panel.remove(), 5000);
	}
});


// ---- Multiple windows
if (newWindowBtn) {
	newWindowBtn.onclick = () => {
		const profile = activeProfile || 'Default';
		if (window.electronAPI?.newWindow) {
			window.electronAPI.newWindow(profile, 'new-window');
		} else if (window.api?.window?.new) {
			window.api.window.new(profile, 'new-window');
		} else {
			console.warn('No window.new API exposed');
		}
	};
}

(async function init() {
	let profiles = await listProfiles();
	if (!profiles.find(p => p.name === 'Default')) {
		await addProfile({ name: 'Default', theme: 'Light', settings: {} });
		profiles = await listProfiles();
	}
})();

// Tab Overflow (780)

const tabsContainer = document.getElementById("tabs");
const overflowBtn = document.getElementById("top-right-btn");

function updateOverflow() {
	const tabs = [...tabsContainer.querySelectorAll(".tab")];
	const containerWidth = tabsContainer.getBoundingClientRect().width;
	const newTabWidth = document.getElementById("new-tab").getBoundingClientRect().width;
	const overflowBtnWidth = overflowBtn.getBoundingClientRect().width;

	let usedWidth = newTabWidth + overflowBtnWidth + 10;
	if (document.getElementById('active-overflow-tag')) {
		usedWidth += document.getElementById('active-overflow-tag').getBoundingClientRect().width
	}
	let hiddenTabs = [];
	let visibleTabs = [];

	tabs.forEach(tab => {
		const w = tab.getBoundingClientRect().width;

		if (usedWidth + w + 6 > containerWidth - 20) {
			tab.dataset.visible = 'hidden';
			hiddenTabs.push(tab);
			tab.style.position = 'absolute';

			tab.style.zIndex = "-1";
			tab.style.opacity = "0";
		} else {
			tab.style.position = "relative";
			tab.style.zIndex = "0";
			tab.style.opacity = "1";
			tab.dataset.visible = 'visible';
			visibleTabs.push(tab);
			usedWidth += w;
		}
	});

	overflowBtn.hiddenTabs = hiddenTabs;
	overflowBtn.visibleTabs = visibleTabs;
}

window.addEventListener("resize", updateOverflow);

new MutationObserver(updateOverflow).observe(tabsContainer, {
	childList: true,
	subtree: true
});

updateOverflow();

overflowBtn.addEventListener("click", (e) => {
	e.stopPropagation();

	const existing = document.getElementById("tab-pop-man");
	if (existing) existing.remove();

	const pop = createPopup("", overflowBtn);
	pop.id = "tab-pop-man";

	let alive = true;

	const onDocClick = (ev) => {
		if (pop.contains(ev.target)) return;
		if (overflowBtn.contains(ev.target)) return;
		alive = false;
		pop.remove();
		document.removeEventListener("click", onDocClick);
	};

	requestAnimationFrame(() => {
		document.addEventListener("click", onDocClick);
	});

	const hidden = overflowBtn.hiddenTabs || [];
	const visible = overflowBtn.visibleTabs || [];

	const openTabMoreMenu = (tab, target) => {
		const webview = document.getElementById(tab.dataset.shortId);
		const isMuted = !!webview?.isAudioMuted?.();

		const ctM = [
			{
				name: "Show Preview",
				icon: "visibility",
				icType: "GF",
				category: 'Preview',
				function: () => {
					showTabInfo(
						tab.dataset.title,
						tab.dataset.url,
						tab.dataset.favicon,
						tab,
						tab.dataset.shortId
					);

					document.addEventListener("mousemove", removeEventListenerA);
					function removeEventListenerA() {
						setTimeout(() => {
							hideTabInfo();
							document.removeEventListener("mousemove", removeEventListenerA);
						}, 2000);
					}
				}
			},
			{
				name: "Close Others",
				icon: "filter_none",
				icType: "GF",
				category: 'Close',
				function: () => closeOtherTabs(tab.dataset.id)
			},
			{
				name: "Close Tabs to the Right",
				icon: "subdirectory_arrow_right",
				icType: "GF",
				category: 'Close',
				function: () => closeTabsToRight(tab.dataset.id)
			},
			{
				name: "Move to Start",
				icon: "arrow_upward",
				icType: "GF",
				category: 'Move Tab',
				function: () => moveTabToStart(tab)
			},
			{
				name: "Move to End",
				icon: "arrow_downward",
				icType: "GF",
				category: 'Move Tab',
				function: () => moveTabToEnd(tab)
			},
			{
				name: tab.classList.contains("pinned") ? "Unpin Tab" : "Pin Tab",
				icon: "keep",
				icType: "GF",
				category: 'Pin Tab',
				function: () => togglePin(tab)
			},
			{
				name: "Duplicate",
				icon: "content_copy",
				icType: "GF",
				category: 'Manage',
				function: () => duplicateTabO(tab.dataset.id)
			},
			{
				name: isMuted ? "Unmute" : "Mute",
				icon: isMuted ? "volume_up" : "volume_off",
				icType: "GF",
				category: 'Manage',
				function: () => toggleMute(webview)
			}
		];

		createContextMenu(ctM, target);
	};

	if (visible.length) {
		pop.innerHTML += `<h4>Visible Tabs</h4>`;
		visible.forEach(tab => {
			const isAudio = tab.dataset.audio === "true";
			const isMuted = tab.dataset.muted === "true";

			pop.innerHTML += `
                <div class="tab-on-overflow-menu ${getActive()?.id == tab.dataset.id ? "active" : ""}">
                    <span class="icon-wrap">
                        ${isAudio
					? `<i class="material-symbols-rounded">${isMuted ? "volume_off" : "volume_up"}</i>`
					: `<img src="${tab.dataset.favicon}">`
				}
                        <p>${tab.dataset.title}</p>
                    </span>
                    <span>
                        <button class="material-symbols-rounded more-btn">more_vert</button>
                        <button class="material-symbols-rounded close-btn" style="background: rgba(255,2,2,0.2)">close</button>
                    </span>
                </div>
            `;
		});
	}

	if (hidden.length) {
		pop.innerHTML += `<h4>Hidden Tabs</h4>`;
		hidden.forEach(tab => {
			const isAudio = tab.dataset.audio === "true";
			const isMuted = tab.dataset.muted === "true";

			pop.innerHTML += `
                <div class="tab-on-overflow-menu hidden-tab ${getActive()?.id == tab.dataset.id ? "active" : ""}">
                    <span class="icon-wrap">
                        ${isAudio
					? `<i class="material-symbols-rounded">${isMuted ? "volume_off" : "volume_up"}</i>`
					: `<img src="${tab.dataset.favicon}">`
				}
                        <p>${tab.dataset.title}</p>
                    </span>
                    <span>
                        <button class="material-symbols-rounded more-btn">more_vert</button>
                        <button class="material-symbols-rounded close-btn" style="background: rgba(255,2,2,0.2)">close</button>
                    </span>
                </div>
            `;
		});
	}

	requestAnimationFrame(() => {
		pop.querySelector(".closeBtnR").onclick = () => {
			alive = false;
			pop.remove();
		};

		const rows = pop.querySelectorAll(".tab-on-overflow-menu");

		rows.forEach((row, i) => {
			const tab = row.classList.contains("hidden-tab")
				? hidden[i - visible.length]
				: visible[i];

			row.addEventListener("click", () => tab.click());

			row.querySelector(".more-btn").addEventListener("click", (ev) => {
				ev.stopPropagation();
				openTabMoreMenu(tab, ev.target);
			});

			row.querySelector(".close-btn").addEventListener("click", (ev) => {
				ev.stopPropagation();
				closeTab(tab.dataset.id);
				alive = false;
				pop.remove();
				document.removeEventListener("click", onDocClick);
			});
		});
	});

	function updatePopup() {
		if (!alive || !document.body.contains(pop)) return;

		const rows = pop.querySelectorAll(".tab-on-overflow-menu");

		rows.forEach((row, i) => {
			const tab = row.classList.contains("hidden-tab")
				? hidden[i - visible.length]
				: visible[i];

			if (!tab) return;

			const isAudio = tab.dataset.audio === "true";
			const isMuted = tab.dataset.muted === "true";

			const iconWrap = row.querySelector(".icon-wrap");
			const titleEl = row.querySelector("p");

			titleEl.textContent = tab.dataset.title;

			iconWrap.innerHTML = isAudio
				? `<i class="material-symbols-rounded">${isMuted ? "volume_off" : "volume_up"}</i><p>${tab.dataset.title}</p>`
				: `<img src="${tab.dataset.favicon}"><p>${tab.dataset.title}</p>`;
		});

		requestAnimationFrame(updatePopup);
	}

	requestAnimationFrame(updatePopup);
});

function setUpshareMenu(url, name = '', data = {}) {
	const content = `
		<h3>Share</h3>
		<div style="display: flex; gap: 20px;">
			<img src="${data?.favicon || ''}">
			<h5>${name}</h5>
		</div>
		<img id="qrcode">
	`
	createPopup(content, document.getElementById('btnShare'), undefined, undefined,)

	new QRCode(document.getElementById("qrcode"), url);

}

let findPopup = null;
let currentFindText = "";
let currentFindIndex = 0;
let currentFindTotal = 0;
let findOptions = {
	matchCase: false,
	regex: false,
	highlightAll: true
};

function openFindPopup(elementClicked = null, x = 0, y = 0) {
	if (findPopup) findPopup.remove();

	const content = `
        <div style="display:flex; gap:6px; align-items:center;">
            <input id="findInput" type="text" placeholder="Find…" 
                style="padding:6px; width:160px; border-radius:6px;">
				
			<span id="findCount">0/0</span>

            <button id="findPrev" class="material-symbols-rounded">${isMac ? 'chevron_left' : 'arrow_back'}</button>
            <button id="findNext" class="material-symbols-rounded">${isMac ? 'chevron_right' : 'arrow_forward'}</button>
        </div>
    `;


	findPopup = createPopup(content, elementClicked, x, y, {
		position: "absolute",
		background: "var(--popup-bg, #fff)",
		padding: "8px",
		borderRadius: "8px",
		boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
		zIndex: 999999,
		display: 'flex',
	});

	findPopup.classList.add('find-pop')

	document.body.appendChild(findPopup);

	const input = findPopup.querySelector("#findInput");
	const prevBtn = findPopup.querySelector("#findPrev");
	const nextBtn = findPopup.querySelector("#findNext");


	input.focus();

	input.oninput = () => doFind(true);

	nextBtn.onclick = () => doFind(true);
	prevBtn.onclick = () => doFind(false);

	document.querySelector('.closeBtnR').addEventListener('click', function () {
		closeFindPopup();
	});
}

function closeFindPopup() {
	const a = getActive();
	if (a?.webview) a.webview.stopFindInPage("clearSelection");
	if (findPopup) findPopup.remove();
	findPopup = null;
	currentFindText = "";
}

function doFind(forward = true) {
	const a = getActive();
	if (!a?.webview) return;

	const input = findPopup?.querySelector("#findInput");
	if (!input) return;

	const text = input.value;
	if (!text) return;

	if (text !== currentFindText) {
		currentFindText = text;
		currentFindIndex = 0;
	}

	a.webview.findInPage(text, {
		forward,
		findNext: true,
		matchCase: findOptions.matchCase,
		wordStart: false,
		medialCapitalAsWordStart: false
	});
}

function attachFindEvents(wv) {
	wv.addEventListener("found-in-page", (e) => {
		const { activeMatchOrdinal, matches } = e.result;

		currentFindIndex = activeMatchOrdinal;
		currentFindTotal = matches;

		const countEl = findPopup?.querySelector("#findCount");
		if (countEl) {
			countEl.textContent = matches ? `${activeMatchOrdinal}/${matches}` : "0/0";
		}
	});
}

// KEYBOARD SHORTCUTS -------------------------------------------------------

window.addEventListener("keydown", (e) => {
	if (e.key === "Escape") {
		closeFindPopup();
	}
});

function createPopup(content = ``, elementClicked = document.body, x = 0, y = 0, cssStyles = {}) {
	const popup = document.createElement('div');
	popup.classList.add('popup');
	popup.innerHTML = content;

	const closeBtn = document.createElement('button');
	closeBtn.classList.add('closeBtnR');
	closeBtn.innerHTML = `<i class="material-symbols-rounded">close_small</i>`;
	popup.appendChild(closeBtn);

	requestAnimationFrame(() => {
		closeBtn.onclick = () => popup.remove();
	});

	Object.assign(popup.style, cssStyles);

	let top = y;
	let left = x;

	if (elementClicked) {
		const rect = elementClicked.getBoundingClientRect();
		top = rect.bottom + window.scrollY;
		left = rect.left + window.scrollX;
	}

	document.body.appendChild(popup);

	requestAnimationFrame(() => {
		const menuRect = popup.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		if (left + menuRect.width > viewportWidth) {
			left = Math.max(0, viewportWidth - menuRect.width);
		}
		if (top + menuRect.height > viewportHeight) {
			top = Math.max(0, viewportHeight - menuRect.height);
		}

		popup.style.top = `${top}px`;
		popup.style.left = `${left}px`;
		popup.classList.add('open');
	});

	return popup;
}

function createOverlayPopup(content, width, height, closeBtn = true) {
	let overlayPopup = document.getElementById('overlay-pop');
	let backdrop = document.getElementById('backdrop-for-pop');

	// Create backdrop once
	if (!backdrop) {
		backdrop = document.createElement('div');
		backdrop.classList.add('backdrop');
		backdrop.id = 'backdrop-for-pop';
		document.body.appendChild(backdrop);
	}

	// Create popup once
	if (!overlayPopup) {
		overlayPopup = document.createElement('div');
		overlayPopup.classList.add('overlay-popup');
		overlayPopup.id = 'overlay-pop';
		backdrop.appendChild(overlayPopup);
	}

	// Clear previous content safely
	overlayPopup.innerHTML = '';

	// Build nav
	const nav = document.createElement('nav');
	overlayPopup.appendChild(nav);

	// Insert content container
	const contentEl = document.createElement('div');
	contentEl.classList.add('popup-content');
	contentEl.innerHTML = content;
	overlayPopup.appendChild(contentEl);

	// Close button
	if (closeBtn) {
		const btn = document.createElement('button');
		btn.innerHTML = `<i class="material-symbols-rounded">close</i>`;
		btn.classList.add('closeBtn');
		btn.onclick = closePop;
		nav.appendChild(btn);
	}

	// Size
	overlayPopup.style.width = width;
	overlayPopup.style.height = height;

	// Animate open
	requestAnimationFrame(() => {
		overlayPopup.classList.add('open');
	});

	// Close logic
	function closePop() {
		overlayPopup.classList.remove('open');
		setTimeout(() => {
			backdrop.remove();
		}, 500);
	}

	return overlayPopup;
}

const activeMenuKeydownHandlers = new Set();

// Helper globals and cleanup function (added to fix bugs and ensure safe cleanup)
if (!window.activeMenuKeydownHandlers) window.activeMenuKeydownHandlers = new Set();

if (typeof removeContextMenus !== 'function') {
	// If the host page already defines removeContextMenus, this won't overwrite it.
	window.removeContextMenus = function removeContextMenus() {
		// Remove backdrops and menus
		document.querySelectorAll('.context-menu-backdrop, .context-menu, .context-submenu').forEach(el => {
			if (el.parentNode) el.parentNode.removeChild(el);
		});

		// Remove global click listener that we add in createContextMenu
		document.removeEventListener('click', removeContextMenus);

		// Remove any webview mousedown listeners we added (best-effort)
		document.querySelectorAll('webview').forEach(webview => {
			try { webview.removeEventListener('mousedown', removeContextMenus); } catch (e) { }
		});

		// Remove keydown handlers registered for shortcuts
		if (window.activeMenuKeydownHandlers && window.activeMenuKeydownHandlers.size) {
			window.activeMenuKeydownHandlers.forEach(h => window.removeEventListener('keydown', h));
			window.activeMenuKeydownHandlers.clear();
		}
	};
}

function createContextMenu(items = [], elementClicked = null, x = 0, y = 0, passThru = {}) {
	removeContextMenus();
	setTimeout(function () {
		elementClicked?.classList.add('hover-force');
	}, 100)

	setTimeout(() => {
		const backdrop = document.createElement('div');
		backdrop.classList.add('context-menu-backdrop');
		Object.assign(backdrop.style, {
			width: '100%',
			height: '100vh',
			left: '0',
			top: '0',
			position: 'fixed',
			zIndex: '999'
		});
		backdrop.onclick = removeContextMenus;
		backdrop.oncontextmenu = (e) => {
			e.preventDefault();
		};
		document.body.appendChild(backdrop);

		const contextMenu = document.createElement('div');
		contextMenu.classList.add('context-menu');
		// ensure menu is positioned fixed so we can place it anywhere on screen
		contextMenu.style.position = 'fixed';
		contextMenu.style.zIndex = '1000';
		document.body.appendChild(contextMenu);

		let top = y;
		let left = x;

		if (elementClicked) {
			const rect = elementClicked.getBoundingClientRect();
			// Position the menu below the clicked element by default
			top = rect.bottom + window.scrollY;
			left = rect.left + window.scrollX;
		}

		// Start hidden to measure size and avoid flicker
		contextMenu.style.visibility = 'hidden';
		contextMenu.style.opacity = '0';
		contextMenu.style.pointerEvents = 'none';

		// Build items first so menu has size when we measure
		const buildItems = (list, parent) => {
			let currentCategory = null;

			list.forEach(({ icon, icType, name, shortcut, category, innerHtml, submenu, disabled, function: callback, id }) => {

				if (category && category !== currentCategory) {
					currentCategory = category;
					const catDiv = document.createElement('div');
					catDiv.classList.add('context-menu-category');
					catDiv.textContent = category;
					parent.appendChild(catDiv);
				}

				const item = document.createElement('div');
				item.classList.add('context-menu-item');
				if (id) item.id = id;

				if (!innerHtml) {
					if (icType === 'GF') icon = `<i class="material-symbols-rounded">${icon}</i>`;
					else if (icType === 'img') icon = `<img src="${icon}">`;
					else if (icType === 'FAb') icon = `<i class="fa-brands fa-${icon}"></i>`;
					else if (icType === 'FA') icon = `<i class="fa-solid fa-${icon}"></i>`;

					const leftSpan = document.createElement('span');
					leftSpan.innerHTML = `${icon ? `<span class="icon" style="margin-right:6px">${icon}</span>` : ''}${name || ''}`;
					item.appendChild(leftSpan);
				} else {
					item.innerHTML = innerHtml;
				}

				if (submenu) {
					const arrow = document.createElement('span');
					arrow.textContent = '▶';
					arrow.style.opacity = '0.6';
					arrow.style.marginLeft = '8px';
					item.appendChild(arrow);

					if (callback) {
						item.onclick = (e) => {
							e.preventDefault();
							callback?.(passThru);
							removeContextMenus();
						};
					}

					// Create submenu element appended to body so it can be positioned outside the button
					const subMenu = document.createElement('div');
					subMenu.classList.add('context-submenu');
					subMenu.style.position = 'fixed';
					subMenu.style.zIndex = '1001';
					subMenu.style.backdropFilter = 'blur(20px)';
					subMenu.style.opacity = '0';
					subMenu.style.pointerEvents = 'none';
					subMenu.style.transition = 'opacity 120ms ease';
					document.body.appendChild(subMenu);

					// Build submenu items into the submenu element
					buildItems(submenu, subMenu);

					// Position submenu relative to the item on mouseenter
					const positionSubmenu = () => {
						const itemRect = item.getBoundingClientRect();
						const subRect = subMenu.getBoundingClientRect();
						const vw = window.innerWidth;
						const vh = window.innerHeight;

						// Default: place to the right of the item
						let subLeft = itemRect.right + window.scrollX;
						let subTop = itemRect.top + window.scrollY - 20;

						// If it would overflow right, place to the left of the item
						if (subLeft + subRect.width > vw) {
							subLeft = itemRect.left + window.scrollX - subRect.width;
						}

						// If it would overflow bottom, shift up
						if (subTop + subRect.height > vh) {
							subTop = Math.max(0, vh - subRect.height);
						}

						// If it would overflow top, clamp
						if (subTop < 0) subTop = 0;

						subMenu.style.left = `${Math.max(0, subLeft)}px`;
						subMenu.style.top = `${Math.max(0, subTop)}px`;
					};

					let enterTimeout = null;

					item.addEventListener('mouseenter', () => {
						requestAnimationFrame(positionSubmenu)
						// small delay to avoid accidental opens
						clearTimeout(enterTimeout);
						enterTimeout = setTimeout(() => {
							positionSubmenu();
							subMenu.style.opacity = '1';
							subMenu.style.pointerEvents = 'auto';
						}, 50);
					});

					item.addEventListener('mouseleave', () => {
						clearTimeout(enterTimeout);
						// small delay to allow moving into submenu
						setTimeout(() => {
							// If mouse is not over submenu, hide it
							const overSub = document.querySelector(':hover') === subMenu || subMenu.matches(':hover');
							if (!overSub) {
								subMenu.style.opacity = '0';
								subMenu.style.pointerEvents = 'none';
							}
						}, 100);
					});

					// Keep submenu visible while hovering it
					subMenu.addEventListener('mouseenter', () => {
						clearTimeout(enterTimeout);
						subMenu.style.opacity = '1';
						subMenu.style.pointerEvents = 'auto';
					});
					subMenu.addEventListener('mouseleave', () => {
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
						window.activeMenuKeydownHandlers.add(handler);
					}

					item.addEventListener('click', (e) => {
						e.stopPropagation();
						callback?.(passThru);
						removeContextMenus();
					});
				}

				if (!disabled) parent.appendChild(item);
			});
		};

		// Build the menu items into the contextMenu element
		buildItems(items, contextMenu);

		// Now that items are built, measure and position the context menu
		requestAnimationFrame(() => {
			const menuRect = contextMenu.getBoundingClientRect();
			const vw = window.innerWidth;
			const vh = window.innerHeight;

			// If elementClicked was provided, prefer positioning relative to it (already set top/left above)
			// Adjust to keep within viewport
			if (left + menuRect.width > vw) left = Math.max(0, vw - menuRect.width);
			if (top + menuRect.height > vh) top = Math.max(0, vh - menuRect.height);

			contextMenu.style.top = `${Math.max(0, top)}px`;
			contextMenu.style.left = `${Math.max(0, left)}px`;
			contextMenu.style.visibility = 'visible';
			contextMenu.style.opacity = '1';
			contextMenu.style.pointerEvents = 'auto';
			contextMenu.classList.add('open');
		});

		// Global cleanup listeners
		setTimeout(() => {
			document.addEventListener('click', removeContextMenus);

			document.querySelectorAll('webview').forEach(webview => {
				try { webview.addEventListener('mousedown', removeContextMenus); } catch (e) { }
			});
		}, 0);
	}, 50);
}

function removeContextMenus() {
	setTimeout(function () {
		if (document.querySelector('.hover-force')) {
			document.querySelector('.hover-force').classList.remove('hover-force');
		}
	})

	document.querySelectorAll('.context-menu').forEach(menu => menu.remove());

	document.querySelectorAll('.context-submenu').forEach(menu => menu.remove());

	document.querySelectorAll('.context-menu-backdrop').forEach(backdrop => backdrop.remove());

	document.removeEventListener('click', removeContextMenus);

	document.querySelectorAll('webview').forEach(webview => {
		webview.removeEventListener('mousedown', removeContextMenus);
	});

	for (const fn of activeMenuKeydownHandlers) {
		window.removeEventListener('keydown', fn);
	}
	activeMenuKeydownHandlers.clear();
}

function getDisplayUrl(rawUrl = '') {
	if (!rawUrl) return '';
	try {
		const url = new URL(rawUrl);
		return url.host + url.pathname + url.search + url.hash;
	} catch (err) {
		return rawUrl.replace(/^https?:\/\//, '').replace(/^file:\/\//, '');
	}
}

function updateAddressBar(url = '') {
	if (!address) return;
	const displayUrl = getDisplayUrl(url);
	address.value = displayUrl;
}

function updateNavButtons(webview) {
	if (!backBtn || !fwdBtn || !webview) return;
	if (typeof webview.canGoBack === 'function') {
		backBtn.classList.toggle('disabled', !webview.canGoBack());
	}
	if (typeof webview.canGoForward === 'function') {
		fwdBtn.classList.toggle('disabled', !webview.canGoForward());
	}
}

// Zoom Controls (858)

let zoomPopupTimeout = null;
let zoomPopupRef = null;

async function showZoomControls(webview, zoomSize) {
	if (!webview) {
		webview = getActive()?.webview;
	}

	if (!webview) {
		console.warn('No active webview for zoom controls');
		return;
	}

	const currentZoom = typeof zoomSize === 'number' ? zoomSize : (await webview.getZoomFactor?.()) || 1;
	const percent = Math.round(currentZoom * 100);

	const content = `
		<div class="zoom-controls">
			<div class="zoom-percent">${percent}%</div>
			<div class="zoom-buttons">
				<button class="zoom-action" data-action="out"><i class="material-symbols-rounded">zoom_out</i></button>
				<button class="zoom-action" data-action="in"><i class="material-symbols-rounded">zoom_in</i></button>
				<button class="zoom-action" data-action="reset"><i class="material-symbols-rounded">restart_alt</i></button>
			</div>
		</div>
	`;

	dbSet('zoomPercent', { [getBaseURL(webview.getURL())]: percent });

	clearTimeout(zoomPopupTimeout);


	if (!zoomPopupRef) {
		zoomPopupRef = createPopup(content, zoomBtn, 0, 0, {
			minWidth: '170px',
			padding: '10px',
			borderRadius: '10px',
			backgroundColor: 'var(--scheme-2), #1a1a1b)',
			color: 'var(--main-text-color, #fff)',
			boxShadow: '0 6px 25px rgba(0,0,0,0.45)',
			zIndex: '1200'
		});
		if (!zoomPopupRef) return;
		zoomPopupRef.classList.add('zoom-popup');

		zoomPopupRef.querySelectorAll('.zoom-action').forEach(button => {
			button.addEventListener('click', (e) => {
				e.stopPropagation();
				const action = button.dataset.action;
				if (action === 'in') zoomIn();
				else if (action === 'out') zoomOut();
				else if (action === 'reset') zoomReset();
			});
		});

		zoomPopupRef.querySelector('.closeBtnR').onclick = () => {
			clearTimeout(zoomPopupTimeout);
		}

	} else {
		zoomPopupRef.querySelector('.zoom-percent').innerHTML = `${percent}%`;
	}

	zoomPopupTimeout = setTimeout(() => {
		if (zoomPopupRef) {
			zoomPopupRef.remove();
			zoomPopupRef = null;
		}
	}, 3500);
}

let currentInfoBox = null;
let showTimer = null;
let hideTimer = null;
let isShown = false;

if (tabsBar) {
	tabsBar.addEventListener('mouseover', (e) => {
		const tab = e.target.closest('.tab');
		if (!tab) return;

		clearTimeout(hideTimer);

		const { title, url, favicon, shortId } = tab.dataset;
		showTabInfo(title, url, favicon, tab, shortId);
	});

	tabsBar.addEventListener('mouseleave', () => {
		clearTimeout(showTimer);
		hideTimer = setTimeout(() => {
			hideTabInfo();
			isShown = false;
		}, 200);
	});

	tabsBar.addEventListener('click', () => {
		clearTimeout(showTimer);
		hideTimer = setTimeout(() => {
			hideTabInfo();
			isShown = false;
		}, 700);
	});
}

let activeHoverId = null;
// Throttle for capturePage
const lastCaptureAt = new Map();
const CAPTURE_MIN_MS = 750;

function showTabInfo(title, url, favicon, elementHover, shortId) {
	activeHoverId = shortId;

	if (!currentInfoBox) {
		currentInfoBox = document.createElement('div');
		currentInfoBox.classList.add('tab-info');
		document.body.appendChild(currentInfoBox);
	}

	currentInfoBox.innerHTML = "";

	let icon

	const item = tabs.find(t =>
		t.title === title ||
		t.url === url ||
		t.favicon === favicon ||
		t.shortId === shortId
	);

	if (item.audio) {
		const a = document.createElement('t-info-noti')
		a.innerHTML = '<i class="material-symbols-rounded">play_circle</i>  Tab Is Playing Media'
		currentInfoBox.appendChild(a)
	}

	if (favicon) {
		icon = document.createElement('img');
		Object.assign(icon.style, { width: "20px", height: "20px", marginRight: "10px" });
		icon.src = favicon;
		currentInfoBox.appendChild(icon);
	} else {
		icon = document.createElement('i')
		icon.classList.add('material-symbols-rounded')
		icon.textContent = 'globe'
		currentInfoBox.appendChild(icon)
	}

	const titleEl = document.createElement('strong');
	titleEl.textContent = title;
	currentInfoBox.appendChild(titleEl);

	if (url) {
		const urlEl = document.createElement('div');
		urlEl.textContent = getBaseURL(url);
		urlEl.style.fontSize = "12px";
		currentInfoBox.appendChild(urlEl);
	}

	setTimeout(() => {
		const wv = document.getElementById(shortId);
		if (wv && typeof wv.capturePage === "function") {
			const now = Date.now();
			const last = lastCaptureAt.get(shortId) || 0;
			if (now - last >= CAPTURE_MIN_MS) {
				const hoverId = shortId;
				lastCaptureAt.set(shortId, now);
				wv.capturePage().then(image => {
					if (hoverId !== activeHoverId) return;
					const dataUrl = image.toDataURL();
					const img = new Image();
					img.src = dataUrl;
					img.classList.add('img-tab-view');
					currentInfoBox.appendChild(img);
				}).catch(err => {
					console.warn('Tab hover preview capture failed:', err);
				});
			}
		}
	}, 400)

	const rect = elementHover.getBoundingClientRect();
	currentInfoBox.style.position = 'fixed';
	currentInfoBox.style.top = `${rect.bottom + 5}px`;
	currentInfoBox.style.left = `${rect.left}px`;

	if (isShown) {
		currentInfoBox.style.display = "block";
	} else {
		clearTimeout(showTimer);
		showTimer = setTimeout(() => {
			currentInfoBox.style.display = "block";
			isShown = true;
			setTimeout(() => currentInfoBox.classList.add('show'), 10);
		}, 1000);
	}
}

function hideTabInfo() {
	activeHoverId = null;
	if (currentInfoBox) {
		currentInfoBox.classList.remove('show');
		setTimeout(() => {
			currentInfoBox.style.display = "none";
		}, 10);
	}
	isShown = false;
}

function getBaseURL(url) {
	try {
		const u = new URL(url);
		return u.origin.replace(/^https?:\/\//, '');
	} catch {
		if (url.startsWith('file://')) {
			return 'file://';
		}
		return url;
	}
}

if (moreBtn) {
	moreBtn.addEventListener('click', function () {
		openMainContextMenu()
	})
}

if (addressMore) {
	addressMore.addEventListener('click', async () => {
		const currentUrl = (address?.value || getActive()?.url || '').trim();
		if (!currentUrl) return;

		const normalizedCurrentUrl = normalizeUrl(currentUrl);
		const bookmarksList = getBookmarks(activeProfile) || [];
		const existingBookmark = bookmarksList.find(b => normalizeUrl(b.url) === normalizedCurrentUrl);

		const items = [
			navigator.clipboard && address.value ? {
				name: "Copy Address Bar",
				icType: 'GF',
				icon: 'content_copy',
				category: 'Copy & Paste',
				function: () => {
					navigator.clipboard.writeText(address.value);
					displayNotification('Link Copied!', 'content_copy')
				},

			} : { disabled: true },

			navigator.clipboard.readText() ? {
				name: "Paste to Address Bar",
				icType: 'GF',
				icon: 'content_paste',
				category: 'Copy & Paste',
				function: () => {
					navigator.clipboard.readText().then((content) => {
						address.value = content;
					})
				},

			} : { disabled: true },

			navigator.clipboard.readText() ? {
				name: "Paste & Go",
				icType: 'GF',
				icon: 'content_paste_go',
				category: 'Copy & Paste',
				function: () => {
					navigator.clipboard.readText().then((content) => {
						address.value = content;
						address.dispatchEvent(new KeyboardEvent("keydown", {
							key: "Enter",
							code: "Enter",
							keyCode: 13,
							which: 13,
							bubbles: true
						}));
					})
				},
			} : { disabled: true },
			{
				name: "Find",
				icType: 'GF',
				icon: 'search',
				category: 'Zoom',
				function: () => openFindPopup()
			},
			{
				name: "Share Link",
				icType: 'GF',
				icon: isMac ? 'ios_share' : 'share',
				category: 'Share',
				function: () => shareTab(currentUrl)
			},

			...(existingBookmark ? [
				{
					name: "Edit Bookmark",
					icType: 'GF',
					icon: 'bookmark_added',
					category: 'Bookmarks',
					function: () => editBookmark(existingBookmark, activeProfile)
				},
				{
					name: "Remove Bookmark",
					icType: 'GF',
					icon: 'bookmark_remove',
					category: 'Bookmarks',
					function: () => {
						removeBookmark(activeProfile, existingBookmark.url);
						displayNotification('Bookmark removed', 'bookmark_remove', 2500, 2);
					}
				}
			] : [
				{
					name: "Add Bookmark",
					icType: 'GF',
					icon: 'bookmark_add',
					category: 'Bookmarks',
					function: () => {
						addBookmark(activeProfile, {
							title: getActive()?.title || currentUrl,
							url: currentUrl,
							favicon: getActive()?.favicon || null
						}, true);
					}
				}
			])
		];

		createContextMenu(items, addressMore);
	});
}

function openInSidebarCurrent() { const a = getActive(); if (a?.url) openSidebarApp(a.url, a.title || 'Sidebar', false); }
function copyPageUrl() { const a = getActive(); if (a?.url) navigator.clipboard.writeText(a.url); }
function savePage() { const a = getActive(); if (a?.wv?.savePage) a.wv.savePage(a.title || 'page', 'HTMLComplete'); }
function viewSource() { const a = getActive(); if (a?.url) createTab('view-source:' + a.url); }
function duplicateTab() { const a = getActive(); if (a?.url) createTab(a.url); }
function pinTab() {
	const active = getActive();
	const tab = tabs.find(t => t.id === active?.id);

	if (!tab) return;

	// Update tab state + UI
	tab.pinned = true;
	tab.draggable = false;

	const el = tabsBar?.querySelector(`.tab[data-id="${tab.id}"]`);
	if (el) el.classList.add('pinned');

	// Move pinned tab to the start of the bar
	moveTabToStart(tab);

	// Load pinned list safely
	const list = JSON.parse(localStorage.getItem('pinnedTabs') || "[]");

	// Create pinned entry
	const bm = {
		url: tab.url,
		title: tab.title,
		favicon: tab.favicon
	};

	// Add to front (no duplicate check)
	const updated = [bm, ...list];

	// Save
	localStorage.setItem('pinnedTabs', JSON.stringify(updated.slice(0, 500)));
}
function unpinTab() {
	const active = getActive();
	const tab = tabs.find(t => t.id === active?.id);

	if (!tab) return;

	// Update tab state + UI
	tab.pinned = false;
	tab.draggable = false;

	const el = tabsBar?.querySelector(`.tab[data-id="${tab.id}"]`);
	if (el) el.classList.remove('pinned');

	// Remove from pinned list
	try {
		const list = JSON.parse(localStorage.getItem('pinnedTabs') || "[]");

		// Remove by URL (unique enough for pinned tabs)
		const updated = list.filter(x => x.url !== tab.url);

		localStorage.setItem('pinnedTabs', JSON.stringify(updated));
	} catch (err) {
		console.error("Couldn't remove pinned tab", err);
	}
}
function toggleFullscreen() { toggleFullScreen() }

async function zoomIn() {
	const a = getActive();
	if (!a?.webview) return;

	const current = await a.webview.getZoomFactor();
	const next = Math.min(3, current + 0.1);

	a.webview.setZoomFactor(next);

	// Wait for layout to settle after zoom
	requestAnimationFrame(() => {
		showZoomControls(a.webview, next);
	});
}


async function zoomOut() {
	const a = getActive();
	if (!a?.webview) return;

	const current = await a.webview.getZoomFactor();
	const next = Math.max(0.3, current - 0.1);

	a.webview.setZoomFactor(next);
	requestAnimationFrame(async () => {
		await showZoomControls(a.webview, a.webview.getZoomFactor());
	})
}

async function zoomReset() {
	const a = getActive();
	if (!a?.webview) return;
	a.webview.setZoomFactor((await loadSetting('website.dZoomValue') || 1) / 100);
	const z = (typeof a.webview.getZoomFactor === 'function' ? a.webview.getZoomFactor() : 1) - 0.1;

	requestAnimationFrame(async () => {
		await showZoomControls(a.webview, a.webview.getZoomFactor())
	})
}

function translatePage() { const a = getActive(); if (!a?.url) return; const u = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(a.url)}`; createTab(u); }
function downloadsF() { openSidebarApp('pages/downloads/index.html', 'Downloads', true); }
function extensions() { openSidebarApp('pages/extensions/index.html', 'Extensions', true); }
function openFile() { createTab('file://'); }
function openLocation() { address?.focus(); address?.select(); }
function muteTab() {
	const a = getActive();
	if (a?.webview?.setAudioMuted) a.webview.setAudioMuted(true);
}

function unmuteTab() {
	const a = getActive();
	if (a?.webview?.setAudioMuted) a.webview.setAudioMuted(false);
}

async function shareTab(url) {
	// Get tab info from DOM instead of tabs[]
	const el = document.querySelector(`.tab[data-url="${url}"]`);
	const info = {
		url: el?.dataset.url || url,
		title: el?.dataset.title || "Untitled",
		favicon: el?.dataset.favicon || null
	};

	let theme = await loadSetting('theme');
	if (Array.isArray(theme)) {
		theme = Object.fromEntries(theme.map(t => [t.key, t.value]));
	}

	const shareOptions = [
		{ name: "WhatsApp", icon: "fa-brands fa-whatsapp", action: "whatsapp" },
		{ name: "Facebook", icon: "fa-brands fa-facebook", action: "facebook" },
		{ name: "Instagram", icon: "fa-brands fa-instagram", action: "instagram" },
		{ name: "TikTok", icon: "fa-brands fa-tiktok", action: "tiktok" },
		{ name: "X (Twitter)", icon: "fa-brands fa-x-twitter", action: "twitter" },
		{ name: "Telegram", icon: "fa-brands fa-telegram", action: "telegram" },
		{ name: "Reddit", icon: "fa-brands fa-reddit", action: "reddit" },
		{ name: "Discord", icon: "fa-brands fa-discord", action: "discord" },
		{ name: "LinkedIn", icon: "fa-brands fa-linkedin", action: "linkedin" },
		{ name: "Pinterest", icon: "fa-brands fa-pinterest", action: "pinterest" },
		{ name: "Email", icon: "fa-solid fa-envelope", action: "email" },
		{ name: "Copy Link", icon: "fa-solid fa-link", action: "copy" },
	];

	const shareHTML = shareOptions.map(opt => `
        <a class="share-btn" data-action="${opt.action}">
            <i class="${opt.icon}"></i> ${opt.name}
        </a>
    `).join("");

	const content = `
    <div style="display: flex; height: 330px; position: relative;">

        <!-- LEFT SIDE -->
        <div style="width: 100%; padding: 12px; position: sticky; top: 0; left: 0">
            <h4 style="margin: 0 0 10px 0;">Share via QR code</h4>

            <div style="text-align: center;">
                <img style="height: 140px;" 
                     src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(info.url)}&color=${theme.c2.replace('#', '')}&bgcolor=${theme.c9.replace('#', '')}&margin=10" />

                <div style="margin-top: 10px; display: flex; justify-content: center; align-items: center; gap: 6px; color: ${theme.c7}; font-weight: bold;">
                    ${info.favicon ? `<img src="${info.favicon}" style="height: 16px; width: 16px;">` : `<i class="material-symbols-rounded">globe</i>`}
                    ${info.title}
                </div>

                <p title="${info.url}" 
                   style="width: 380px; margin: 4px auto 0 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                   ${info.url}
                </p>
            </div>
        </div>

        <div class="sep"></div>

        <!-- RIGHT SIDE -->
        <div class="share-list" style="width: 100%; padding: 12px;">
            <h4 style="margin: 0 0 10px 0;">Share via</h4>
            ${shareHTML}
        </div>
    </div>
    `;

	let pop = createPopup(content, addressMore, undefined, undefined, {
		borderRadius: '12px',
		width: '650px',
		minHeight: 'fit-content'
	});

	pop.id = 'shareMenu'

	// Attach click handlers AFTER popup is created
	setTimeout(() => attachShareHandlers(info), 50);
}

function attachShareHandlers(info) {
	document.querySelectorAll(".share-btn").forEach(btn => {
		btn.onclick = () => {
			const action = btn.dataset.action;
			const url = encodeURIComponent(info.url);
			const text = encodeURIComponent(info.title);

			switch (action) {
				case "whatsapp":
					window.open(`https://api.whatsapp.com/send?text=${text}%20${url}`);
					break;

				case "facebook":
					window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
					break;

				case "twitter":
					window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`);
					break;

				case "telegram":
					window.open(`https://t.me/share/url?url=${url}&text=${text}`);
					break;

				case "reddit":
					window.open(`https://www.reddit.com/submit?url=${url}&title=${text}`);
					break;

				case "linkedin":
					window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`);
					break;

				case "pinterest":
					window.open(`https://pinterest.com/pin/create/button/?url=${url}`);
					break;

				case "email":
					window.location.href = `mailto:?subject=${text}&body=${url}`;
					break;

				case "copy":
					navigator.clipboard.writeText(info.url);
					break;

				case "instagram":
				case "tiktok":
				case "discord":
					alert("This platform does not support direct URL sharing. Link copied instead.");
					navigator.clipboard.writeText(info.url);
					break;
			}
			document.getElementById('shareMenu').remove();
		};
	});
}

function toggleFullScreen() {
	if (!document.fullscreenElement) {
		document.getElementById('main-for-view').requestFullscreen().catch(err => {
			console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
		});
	} else {
		document.exitFullscreen();
	}
}

// Overflow Context Menu Options

function moveTabToStart(tab) {
	tabsContainer.insertBefore(tab, tabsContainer.children[0]);
	updateOverflow();
}

function moveTabToEnd(tab) {
	tabsContainer.insertBefore(tab, tabsContainer.querySelector('.new-tab'));
	updateOverflow();
}

function togglePin(tab) {
	tab.classList.toggle("pinned");
	moveTabToStart(tab);
	updateOverflow();
}

function duplicateTabO(id) {
	const webview = document.querySelector(`webview[data-id="${id}"]`);
	if (webview) createTab(webview.getURL());
}

function toggleMute(webview) {
	if (!webview) return;
	webview.setAudioMuted(!webview.isAudioMuted());
}

function closeOtherTabs(id) {
	document.querySelectorAll(".tab").forEach(tab => {
		if (tab.dataset.id !== id) closeTab(tab.dataset.id);
	});
}

function closeTabsToRight(id) {
	let found = false;
	document.querySelectorAll(".tab").forEach(tab => {
		if (tab.dataset.id === id) found = true;
		else if (found) closeTab(tab.dataset.id);
	});
}

async function openMainContextMenu(elementClicked = moreBtn, x = 0, y = 0) {
	const profile = activeProfile || 'Default';
	const active = getActive();
	const wv = active?.webview;

	const canGoBack = !!wv?.canGoBack?.();
	const canGoForward = !!wv?.canGoForward?.();
	const isLoading = !!wv?.isLoading?.();
	const isMuted = !!wv?.isAudioMuted?.();
	const isPinned = !!active?.pinned;

	const zoomFactor = typeof wv?.getZoomFactor === 'function' ? (wv.getZoomFactor() || 1) : 1;

	const bookmarks = getBookmarks(profile) || [];

	const db = await openDB();
	const tx = db.transaction('history', 'readonly');
	const store = tx.objectStore('history');
	const res = await promisifyRequest(store.getAll());
	const history = (res || [])
		.sort((a, b) => b.visitedAt - a.visitedAt)
		.slice(0, 15);

	const items = [
		{ icon: 'tab', icType: 'GF', name: 'New tab', shortcut: 'Ctrl+T', category: 'Tabs', function: () => createTab('about:blank') },
		{ icon: 'window', icType: 'GF', name: 'New window', shortcut: 'Ctrl+N', category: 'Tabs', function: () => newWindowBtn?.click() },
		{ icon: 'tab_duplicate', icType: 'GF', name: 'Duplicate tab', category: 'Tabs', function: duplicateTab },
		// { icon: 'restore_page', icType: 'GF', name: 'Reopen closed tab', category: 'Tabs', function: reopenClosedTab },
		{ icon: 'push_pin', icType: 'GF', name: 'Pin tab', category: 'Tabs', disabled: isPinned, function: pinTab },
		{ icon: 'push_pin', icType: 'GF', name: 'Unpin tab', category: 'Tabs', disabled: !isPinned, function: unpinTab },
		{
			icon: 'close', icType: 'GF', name: 'Close Tab', category: 'Tabs',
			submenu: [
				{ icon: 'close', icType: 'GF', name: 'Close tab', shortcut: 'Ctrl+W', function: () => closeTab(activeTab) },
				{ icon: 'filter_none', icType: 'GF', name: 'Close Other Tabs', function: () => { closeOtherTabs(activeTab.id) } },
				{ icon: 'subdirectory_arrow_right', icType: 'GF', name: 'Close Tabs to the Right', function: () => { closeTabsToRight(activeTab.id) } }
			]
		},

		{ icon: 'arrow_back', icType: 'GF', name: 'Back', shortcut: 'Alt+Left', category: 'Navigation', disabled: !canGoBack, function: () => wv?.goBack() },
		{ icon: 'arrow_forward', icType: 'GF', name: 'Forward', shortcut: 'Alt+Right', category: 'Navigation', disabled: !canGoForward, function: () => wv?.goForward() },
		{ icon: 'refresh', icType: 'GF', name: 'Reload', shortcut: 'Ctrl+R', category: 'Navigation', disabled: !!isLoading, function: () => wv?.reload() },
		{ icon: 'stop', icType: 'GF', name: 'Stop loading', shortcut: 'Esc', category: 'Navigation', disabled: !isLoading, function: () => wv?.stop() },
		// { icon: 'chrome_reader_mode', icType: 'GF', name: 'Open in sidebar', category: 'Navigation', function: openInSidebarCurrent },
		{
			icon: 'history', icType: 'GF', name: 'History', category: 'Lists',
			submenu: [
				{
					icon: 'history', icType: 'GF', name: 'Show full history', category: 'Show all History',
					function: () => openSidebarApp('pages/managers/index.html?manager=history', 'Manager', true)
				},

				...history.map(h => {
					console.log(isHttp(h.favicon))
					return {
						icon: isHttp(h.favicon) ? h.favicon : 'globe',
						icType: isHttp(h.favicon) ? 'img' : 'GF',
						name: h.title.replace(/`/g, "") || h.url,
						category: 'All History',
						function: () => createTab(h.url)
					};
				})
			]
		},
		{
			icon: 'bookmark', icType: 'GF', name: 'Bookmarks & Saved Pages', category: 'Lists',
			submenu: [
				{
					icon: 'star', icType: 'GF', name: 'Bookmark this page', shortcut: 'Ctrl+D', category: "Add",
					function: () => {
						const a = getActive();
						if (!a) return;
						addBookmark(profile, {
							title: a.title || a.url,
							url: a.url,
							favicon: a.favicon,
							createdAt: Date.now()
						});
					}
				},

				// dynamically inject bookmarks
				...bookmarks.map(b => {
					return {
						icon: b.favicon || 'bookmark',
						icType: b.favicon ? 'img' : 'GF',
						name: b.title || b.url,
						category: "All Bookmarks",
						function: () => createTab(b.url)
					};
				}),

				{
					icon: 'collections_bookmark', icType: 'GF', name: 'Manage Bookmarks', category: "Manage",
					function: () => openSidebarApp('pages/managers/index.html?manager=bookmarks', 'Manager', true)
				}
			]
		},

		{ icon: 'content_copy', icType: 'GF', name: 'Copy page URL', category: 'Page', function: copyPageUrl },
		{
			icon: 'print', icType: 'GF', name: 'Print & find', category: 'Page',
			submenu: [
				{ icon: 'print', icType: 'GF', name: 'Print…', shortcut: 'Ctrl+P', function: () => wv?.print() },
				{ icon: 'search', icType: 'GF', name: 'Find on page', shortcut: 'Ctrl+F', function: () => openFindPopup(addressMore) }
			]
		},

		{
			icon: 'tune', icType: 'GF', name: `Zoom (${Math.round(zoomFactor * 100)}%)`, category: 'View',
			submenu: [
				{ icon: 'zoom_in', icType: 'GF', category: 'Zoom Factor', name: 'Zoom in', shortcut: 'Ctrl++', function: zoomIn },
				{ icon: 'zoom_out', icType: 'GF', category: 'Zoom Factor', name: 'Zoom out', shortcut: 'Ctrl+-', function: zoomOut },
				{ icon: 'zoom_in_map', icType: 'GF', category: 'Reset', name: 'Reset zoom', shortcut: 'Ctrl+0', function: zoomReset },
				{ icon: 'fullscreen', icType: 'GF', category: 'Fullscreen', name: document.fullscreenEnabled ? 'Exit Fullscreen' : 'Enter Fullscreen', shortcut: 'F11', function: toggleFullScreen }
			]
		},

		{
			icon: 'build', icType: 'GF', name: 'More tools', category: 'Advanced',
			submenu: [
				{ icon: 'developer_mode', icType: 'GF', name: 'Developer tools', shortcut: 'Ctrl+Shift+I', category: 'Developer', function: () => wv?.openDevTools() },
				{ icon: 'source', icType: 'GF', name: 'View source', shortcut: 'Ctrl+U', category: 'Developer', function: viewSource },
				{ icon: 'volume_off', icType: 'GF', name: 'Mute tab', category: 'Page Settings', disabled: isMuted, function: muteTab },
				{ icon: 'volume_up', icType: 'GF', name: 'Unmute tab', category: 'Page Settings', disabled: !isMuted, function: unmuteTab },
				{ icon: 'translate', icType: 'GF', name: 'Translate page', category: 'Page Settings', function: translatePage },
				// { icon: 'monitor_heart', icType: 'GF', name: 'Task manager', function: () => console.log('Task Manager') },
				// { icon: 'delete_sweep', icType: 'GF', name: 'Clear cache', function: () => console.log('Clear cache') },
				// { icon: 'download', icType: 'GF', name: 'Downloads', function: downloads },
				// { icon: 'extension', icType: 'GF', name: 'Extensions', function: extensions },
				// { icon: 'screenshot', icType: 'GF', name: 'Screenshot tab', function: async () => { const a = getActive(); if (!a?.webview?.capturePage) return; const img = await a.webview.capturePage(); a.screenshot = img.toDataURL(); } },
				// { icon: 'save', icType: 'GF', name: 'Save page', category: 'Page', function: savePage },
			]
		},

		{ icon: 'settings', icType: 'GF', name: 'Settings', shortcut: 'Ctrl+,', category: 'App', function: () => openSidebarApp('pages/settings/index.html', 'Settings', true) },
	];

	createContextMenu(items, elementClicked, x, y);
}

// Search and autocomplete
function performSearch(input) {
	const isLikelyURL = /^[a-zA-Z]+:\/\//.test(input) || /^[\w-]+\.[\w]{2,}/.test(input);
	const url = isLikelyURL
		? (input.startsWith('http') ? input : 'https://' + input)
		: `https://www.google.com/search?q=${encodeURIComponent(input)}`;

	const active = getActive();
	if (active && active.webview) {
		active.webview.src = url;
		active.url = url;
		if (address) address.value = url;
		updateTabElement(active);
	} else {
		createTab(url);
	}
}

function isHttp(url) {
	return url.startsWith('http') || url.startsWith('file://')
}

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

function getBookmarksProfile(profile = 'Default') {
	try { return getBookmarks(profile) || []; } catch (e) { return []; }
}
async function getHistoryProfile(profile = 'Default', limit = 50) {
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
		case 'math': wrapper.innerHTML = `<span class="material-symbols-rounded">calculate</span>`; break;
		case 'weather': wrapper.innerHTML = `<span class="material-symbols-rounded">cloud</span>`; break;
		case 'flag': wrapper.innerHTML = `<span class="material-symbols-rounded">flag</span>`; break;
		case 'convert': wrapper.innerHTML = `<span class="material-symbols-rounded">swap_horiz</span>`; break;
		case 'define': wrapper.innerHTML = `<span class="material-symbols-rounded">menu_book</span>`; break;
		case 'fact': wrapper.innerHTML = `<span class="material-symbols-rounded">info</span>`; break;
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

function isMathExpression(str) {
	if (!str || looksLikeUrl(str) || looksLikeIp(str) || str.startsWith('file://')) return false;
	return /^[\d\s\+\-\*\/\(\)\.\^\√]+$/.test(str.trim());
}

function evaluateMath(expr) {
	try {
		// Replace ^ with ** for exponentiation
		let safeExpr = expr.replace(/\^/g, '**').replace(/√/g, 'Math.sqrt');
		// Use Function to avoid global scope
		const result = new Function('return ' + safeExpr)();
		if (typeof result === 'number' && isFinite(result)) return result;
	} catch (e) { }
	return null;
}

const countryFlags = {
	'united states': '🇺🇸',
	'usa': '🇺🇸',
	'us': '🇺🇸',
	'france': '🇫🇷',
	'germany': '🇩🇪',
	'japan': '🇯🇵',
	'china': '🇨🇳',
	'india': '🇮🇳',
	'brazil': '🇧🇷',
	'russia': '🇷🇺',
	'uk': '🇬🇧',
	'united kingdom': '🇬🇧',
	'canada': '🇨🇦',
	'australia': '🇦🇺',
	'italy': '🇮🇹',
	'spain': '🇪🇸',
	'mexico': '🇲🇽',
	'south korea': '🇰🇷',
	'netherlands': '🇳🇱',
	'sweden': '🇸🇪',
};

function getCountryFlag(country) {
	return countryFlags[country.toLowerCase()] || null;
}

async function fetchWeather(city, apiKey) {
	if (!apiKey) return null;
	try {
		const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`);
		if (!res.ok) return null;
		const data = await res.json();
		return {
			temp: data.main.temp,
			desc: data.weather[0].description,
			city: data.name
		};
	} catch (e) {
		return null;
	}
}

function convertUnits(expr) {
	const conversions = {
		'c to f': (v) => `${(v * 9 / 5 + 32).toFixed(1)}°F`,
		'f to c': (v) => `${((v - 32) * 5 / 9).toFixed(1)}°C`,
		'km to mi': (v) => `${(v * 0.621371).toFixed(1)} mi`,
		'mi to km': (v) => `${(v / 0.621371).toFixed(1)} km`,
		'm to ft': (v) => `${(v * 3.28084).toFixed(1)} ft`,
		'ft to m': (v) => `${(v / 3.28084).toFixed(1)} m`,
		'kg to lb': (v) => `${(v * 2.20462).toFixed(1)} lb`,
		'lb to kg': (v) => `${(v / 2.20462).toFixed(1)} kg`,
	};
	const lowerExpr = expr.toLowerCase();
	for (const [key, fn] of Object.entries(conversions)) {
		if (lowerExpr.includes(key)) {
			const match = expr.match(/(\d+(?:\.\d+)?)/);
			if (match) {
				const val = parseFloat(match[1]);
				return fn(val);
			}
		}
	}
	return null;
}

async function fetchDefinition(word) {
	try {
		const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
		if (!res.ok) return null;
		const data = await res.json();
		return data[0]?.meanings?.[0]?.definitions?.[0]?.definition || null;
	} catch (e) {
		return null;
	}
}

function getQuickFact(query) {
	const lower = query.toLowerCase();
	if (lower === 'what is pi') return '3.1415926535';
	if (lower === 'what is the capital of france') return 'Paris';
	if (lower === 'what is the capital of japan') return 'Tokyo';
	if (lower === 'what day is today') return new Date().toLocaleDateString();
	if (lower === 'what time is it') return new Date().toLocaleTimeString();
	return null;
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
	// Math calculations
	if (isMathExpression(q)) {
		const result = evaluateMath(q);
		if (result !== null) {
			results.unshift({ text: q, label: `${q} = ${result}`, type: 'math', sub: 'Calculation' });
		}
	}
	// Country flags
	const flag = getCountryFlag(q);
	if (flag) {
		results.unshift({ text: `https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`, label: `${q} ${flag}`, type: 'flag', sub: 'Country' });
	}
	// Weather
	const weatherMatch = lower.match(/^weather(?:\s+in\s+|\s+for\s+)(.+)$/);
	if (weatherMatch) {
		const city = weatherMatch[1].trim();
		const allSettings = await loadAllSettings();
		const apiKey = allSettings.find(s => s.key === 'openweather_api_key')?.value;
		if (apiKey) {
			const weather = await fetchWeather(city, apiKey);
			if (weather) {
				results.unshift({ text: makeSearchUrl(`weather in ${weather.city}`, 'google'), label: `${weather.temp}°C, ${weather.desc}`, type: 'weather', sub: weather.city });
			}
		}
	}
	// Unit conversions
	const convertMatch = lower.match(/^convert\s+(.+)$/);
	if (convertMatch) {
		const conv = convertMatch[1];
		const result = convertUnits(conv);
		if (result) {
			results.unshift({ text: conv, label: `${conv} = ${result}`, type: 'convert', sub: 'Conversion' });
		}
	}
	// Dictionary
	const defineMatch = lower.match(/^define\s+(.+)$/);
	if (defineMatch) {
		const word = defineMatch[1].trim();
		const def = await fetchDefinition(word);
		if (def) {
			results.unshift({ text: makeSearchUrl(`define ${word}`, 'google'), label: def, type: 'define', sub: word });
		}
	}
	// Quick facts
	const fact = getQuickFact(q);
	if (fact) {
		results.unshift({ text: fact, label: fact, type: 'fact', sub: 'Fact' });
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
	const bookmarks = (typeof getBookmarksProfile === 'function') ? getBookmarksProfile(activeProfile || 'Default') : [];
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
		box.classList.remove('show');

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
	const searchCont = document.getElementById('search-container')
	const rect = (typeof searchCont !== 'undefined' && searchCont && typeof searchCont.getBoundingClientRect === 'function') ? searchCont.getBoundingClientRect() : null;
	if (rect) {
		box.style.position = 'fixed';
		box.style.top = `${rect.bottom - 2}px`;
		box.style.left = `${rect.left}px`;
		box.style.width = `${rect.width - 18}px`;
		box.style.display = 'block';
		box.setAttribute('aria-hidden', 'false');

		box.classList.add('show');
	} else {
		box.style.position = 'fixed';
		box.style.top = '48px';
		box.style.left = '8px';
		box.style.width = '320px';
		box.style.display = 'block';
		box.setAttribute('aria-hidden', 'false');

		box.classList.remove('show');
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

	box.classList.remove('show');
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
		const tab = getActive();
		const webUrl = tab.webview.getURL()
		if (tab?.webview) {
			address.select()
		}
		if (!webUrl.includes('pages/new-tab/index.html')) {
			address.value = tab.webview.getURL();
		}
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
			box.classList.remove('show');
		}, 200);
	});

	address.addEventListener('input', () => {
		clearTimeout(suggestionTimer);
		const q = address.value.trim();
		if (!q) {
			hideSuggestions();
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
			} catch (err) {
				console.error('Suggestion error:', err);
				hideSuggestions();
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
			const openInBackground = e.ctrlKey || e.metaKey;

			const target = selectedIndex >= 0 ? suggestions[selectedIndex]?.text : val;
			const isUrl = looksLikeUrl(target) || looksLikeIp(target);
			const finalUrl = isUrl ? normalizeUrl(target) : makeSearchUrl(target);

			if (openInNewTab) {
				createTab(finalUrl);
			} else if (openInBackground) {
				const newTab = createTab(finalUrl);
				const current = getActive();
				if (current) setActiveTab(current.id);
			} else {
				const active = getActive();
				if (active && active.webview) {
					active.webview.src = finalUrl;
					active.url = finalUrl;
					address.value = finalUrl;
					updateTabElement(active);
				} else {
					createTab(finalUrl);
				}
			}

			hideSuggestions();
		}
	});

	document.addEventListener('click', (e) => {
		const box = ensureSuggestionsBox();
		if (!box.contains(e.target) && e.target !== address) hideSuggestions();
	});
}

// Sidebar
async function openSidebarApp(url, title, iframe = false) {
	const existing = document.getElementById('sidebarApp');
	let timeout
	if (existing) {
		closeSidebarApp();
		timeout = 800
	}

	const sBAe = document.createElement('div');
	sBAe.className = 'sidebar-app';
	sBAe.id = 'sidebarApp';
	sBAe.innerHTML = `
    <nav>
      <span class="sidebarTitle">
        <h4>${title}</h4>
      </span>
      <span>
        <button id="ctxt-menu-sidebar">
          <i class="material-symbols-rounded">more_vert</i>
        </button>
        <button id="close-sidebarBtn">
          <i class="material-symbols-rounded">close</i>
        </button>
      </span>
    </nav>
  `;

	const handle = document.createElement('div');
	handle.className = 'drag-handle';
	handle.innerHTML = `<i class="material-symbols-rounded">drag_indicator</i>`;
	handle.setAttribute('role', 'separator');
	handle.setAttribute('aria-orientation', 'vertical');

	const savedWidth = await loadSetting('sidebarWidth');
	const sidebarWidth = typeof savedWidth === 'number' ? `${savedWidth}px` : '350px';

	const mainView = document.getElementById('main-for-view');
	if (!mainView) return sBAe;

	mainView.style.display = 'grid';
	mainView.style.gridTemplateColumns = `1fr 16px ${sidebarWidth}`;
	setTimeout(function () {

		mainView.append(handle, sBAe);

		const web = document.createElement(iframe ? 'iframe' : 'webview');
		web.setAttribute('partition', `persist:${activeProfile}`);
		web.classList.add('web-sidebar-app')
		web.src = url;
		sBAe.appendChild(web);

		// Store reference to sidebar iframe for message passing
		window.sidebarIframe = web;

		let isDragging = false;

		setTimeout(function () {
			const sideCtxM = document.getElementById('ctxt-menu-sidebar')
			sideCtxM.onclick = () => {
				createContextMenu(
					[
						{ icon: 'add', icType: "GF", name: 'Open In New Tab', category: 'Open', function: () => { createTab(document.querySelector('.web-sidebar-app').src); closeSidebarApp() } },
						{ icon: 'refresh', icType: "GF", name: 'Reload', category: 'Navigation', function: () => { web.src = web.src } },
					]
					, sideCtxM)
			}
		}, 100)

		const onMouseMove = (e) => {
			if (!isDragging) return;
			const mainRect = mainView.getBoundingClientRect();
			const newSidebarWidth = mainRect.right - e.clientX;
			if (newSidebarWidth > 150 && newSidebarWidth < 800) {
				updateSetting('sidebarWidth', newSidebarWidth);
				mainView.style.gridTemplateColumns = `1fr 16px ${newSidebarWidth}px`;
			}
		};

		const onMouseUp = () => {
			if (!isDragging) return;
			isDragging = false;
			document.body.style.cursor = '';
			sBAe.classList.remove('dragging');
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		};

		handle.addEventListener('mousedown', (e) => {
			isDragging = true;
			document.body.style.cursor = 'col-resize';
			sBAe.classList.add('dragging');
			e.preventDefault();
			window.addEventListener('mousemove', onMouseMove);
			window.addEventListener('mouseup', onMouseUp);
		});

		sBAe.querySelector('#close-sidebarBtn').onclick = () => closeSidebarApp();
	}, timeout)

	return sBAe;
}

function closeSidebarApp() {
	const main = document.getElementById('main-for-view');
	const handle = document.querySelector('.drag-handle');
	const app = document.getElementById('sidebarApp');

	if (!main || !handle || !app) return null;

	main.style.gridTemplateColumns = '1fr 0 0';

	setTimeout(function () {
		handle.remove();
		app.remove();
		// Clear sidebar iframe reference
		window.sidebarIframe = null;
	}, 450);
}

function updateTabsMenu() {
	const list = tabs.map(t => ({
		id: t.id,
		title: t.title || t.url || 'New Tab'
	}));

	window.electronAPI.updateTabsMenu(list);
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
	notification.classList.remove('open')
	void notification.offsetHeight; // force reflow

	// Set content
	notification.innerHTML = `<i class="material-symbols-rounded">${icon}</i> ${message}`;

	// Animate in
	notification.classList.add('open')

	isDisplaying = true;

	if (currentTimeout) clearTimeout(currentTimeout);

	currentTimeout = setTimeout(() => {
		notification.classList.remove('open')

		setTimeout(() => {
			isDisplaying = false;
			processQueue();
		}, 300);
	}, timeout);
}

function addLongPress(element, callback, delay = 500) {
	let timer = null;

	const start = () => {
		timer = setTimeout(() => {
			timer = null;
			callback();
		}, delay);
	};

	const cancel = () => {
		setTimeout(function () {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		}, 1000)
	};

	element.addEventListener("mousedown", start);
	element.addEventListener("touchstart", start);

	element.addEventListener("mouseup", cancel);
	element.addEventListener("mouseleave", cancel);
	element.addEventListener("touchend", cancel);
	element.addEventListener("touchcancel", cancel);
}

function showDialog({ title, message, type = "alert", defaultValue = "" }) {
	return new Promise(resolve => {

		// --- Overlay ---
		const overlay = document.createElement("div");
		overlay.style.position = "fixed";
		overlay.style.inset = "0";
		overlay.style.background = "rgba(0,0,0,0.4)";
		overlay.style.display = "flex";
		overlay.style.alignItems = "center";
		overlay.style.justifyContent = "center";
		overlay.style.zIndex = "99999";

		// --- Dialog Box ---
		const box = document.createElement("div");
		box.style.background = "var(--context-menu-bg)";
		box.style.color = "var(--context-menu-color, white)";
		box.style.padding = "20px";
		box.style.borderRadius = "12px";
		box.style.width = "320px";
		box.style.boxShadow = "0 8px 30px rgba(0,0,0,0.3)";
		box.style.fontFamily = "sans-serif";

		// --- Title ---
		const titleEl = document.createElement("div");
		titleEl.textContent = title;
		titleEl.style.fontSize = "18px";
		titleEl.style.marginBottom = "10px";

		// --- Message ---
		const msgEl = document.createElement("div");
		msgEl.textContent = message;
		msgEl.style.marginBottom = "15px";

		// --- Input (Prompt Only) ---
		const input = document.createElement("input");
		input.type = "text";
		input.value = defaultValue;
		input.style.width = "100%";
		input.style.padding = "8px";
		input.style.marginBottom = "15px";
		input.style.borderRadius = "6px";
		input.style.border = "1px solid var(--context-menu-border)";
		input.style.display = type === "prompt" ? "block" : "none";

		// --- Buttons Row ---
		const btnRow = document.createElement("div");
		btnRow.style.display = "flex";
		btnRow.style.justifyContent = "flex-end";
		btnRow.style.gap = "10px";

		const okBtn = document.createElement("button");
		okBtn.textContent = "OK";

		const cancelBtn = document.createElement("button");
		cancelBtn.textContent = "Cancel";
		cancelBtn.style.display = type === "alert" ? "none" : "inline-block";

		btnRow.appendChild(okBtn);
		btnRow.appendChild(cancelBtn);

		// --- Build Dialog ---
		box.appendChild(titleEl);
		box.appendChild(msgEl);
		box.appendChild(input);
		box.appendChild(btnRow);
		overlay.appendChild(box);
		document.body.appendChild(overlay);

		// --- Cleanup ---
		const cleanup = () => overlay.remove();

		// --- Button Logic ---
		okBtn.onclick = () => {
			cleanup();
			if (type === "prompt") resolve(input.value);
			else resolve(true);
		};

		cancelBtn.onclick = () => {
			cleanup();
			resolve(false);
		};

		// --- Autofocus for prompt ---
		if (type === "prompt") {
			setTimeout(() => {
				input.focus();
				input.setSelectionRange(input.value.length, input.value.length);
			}, 10);
		}
	});
}

// Public API
window.customAlert = (msg) =>
	showDialog({ title: "Alert", message: msg, type: "alert" });

window.customConfirm = (msg) =>
	showDialog({ title: "Confirm", message: msg, type: "confirm" });

window.customPrompt = async (msg, def = "") =>
	await showDialog({ title: "Prompt", message: msg, type: "prompt", defaultValue: def });// Media Manager Functions
function updateMediaManager() {
	const mediaTabs = tabs.filter(t => t.media.isPlaying).map(t => ({
		tabId: t.id,
		title: t.title,
		url: t.url,
		favicon: t.favicon,
		media: t.media
	}));
	// Send to sidebar if open
	if (window.sidebarIframe && window.sidebarIframe.contentWindow) {
		window.sidebarIframe.contentWindow.postMessage({ type: 'update-media', mediaTabs }, '*');
	}
}

// Permission management
async function managePermission(origin, permission) {
	const decision = await loadPermission(origin, permission);
	const content = `
        <h4>Manage Permission</h4>
        <p>${origin} - ${permission}</p>
        <p>Current: ${decision || 'Not set'}</p>
        <div class="flex" style="gap: 10px;">
            <button id="allow">Allow</button>
            <button id="deny">Deny</button>
            <button id="reset">Reset</button>
        </div>
    `;
	const popup = createPopup(content, document.getElementById('viewWebsiteInfo'));
	document.getElementById('allow').onclick = async () => {
		await savePermission(origin, permission, 'allow');
		popup.remove();
	};
	document.getElementById('deny').onclick = async () => {
		await savePermission(origin, permission, 'deny');
		popup.remove();
	};
	document.getElementById('reset').onclick = async () => {
		const db = await openDB();
		const tx = db.transaction('permissions', 'readwrite');
		const store = tx.objectStore('permissions');
		store.delete(`${origin}:${permission}`);
		await transactionDone(tx);
		popup.remove();
	};
}// Download Manager Functions
let downloads = [];

function updateDownloadManager() {
	// Send to sidebar if open
	if (window.sidebarIframe && window.sidebarIframe.contentWindow) {
		window.sidebarIframe.contentWindow.postMessage({ type: 'update-downloads', downloads }, '*');
	}
}

function handleDownloadControl(data) {
	const { action, id } = data;
	// Placeholder: In real implementation, communicate with main process
	console.log('Download control:', action, id);
}

// Simulate adding a download (for testing)
function addDownload(download) {
	downloads.push(download);
	updateDownloadManager();
}