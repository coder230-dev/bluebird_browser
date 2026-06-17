const isMac = navigator.platform.toLowerCase().includes('mac');

document.addEventListener('DOMContentLoaded', async () => {
	// Load and apply theme first
	const theme = await loadSetting('theme');
	if (theme) {
		Object.entries(theme).forEach(([key, value]) => {
			document.documentElement.style.setProperty(`--${key}`, value);
		});
	}
	
	// Then load all values
	await loadValues();
	await loadProfileSetting();
})

// ---------- IndexedDB helpers (fixed and robust) ----------
function openDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('BrowserProfilesDB', 6);

		request.onupgradeneeded = (event) => {
			const db = event.target.result; // fixed: scoped const
			if (!db.objectStoreNames.contains('profiles')) {
				db.createObjectStore('profiles', { keyPath: 'name' });
			}
			if (!db.objectStoreNames.contains('settings')) {
				db.createObjectStore('settings', { keyPath: 'key' });
			}
			if (!db.objectStoreNames.contains('themes')) {
				db.createObjectStore('themes', { keyPath: 'name' });
			}
			if (!db.objectStoreNames.contains('history')) {
				db.createObjectStore('history', { autoIncrement: true });
			}
			if (!db.objectStoreNames.contains('bookmarks')) {
				db.createObjectStore('bookmarks', { autoIncrement: true });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function withTx(storeName, mode, handler) {
	return openDB().then(db =>
		new Promise((resolve, reject) => {
			const tx = db.transaction(storeName, mode);
			const store = tx.objectStore(storeName);

			handler(store);

			tx.oncomplete = () => resolve(true);
			tx.onerror = () => reject(tx.error);
		})
	);
}

async function addProfile(profile) {
	return withTx('profiles', 'readwrite', (store) => {
		store.put({ ...profile, createdAt: Date.now(), updatedAt: Date.now() });
	});
}

async function deleteProfile(name) {
	return withTx('profiles', 'readwrite', (store) => store.delete(name));
}

async function editProfile(name, updates) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('profiles', 'readwrite');
		const store = tx.objectStore('profiles');
		const req = store.get(name);
		req.onsuccess = () => {
			const existing = req.result;
			if (existing) store.put({ ...existing, ...updates, updatedAt: Date.now() });
		};
		tx.oncomplete = () => resolve(true);
		tx.onerror = () => reject(tx.error);
	});
}

async function listProfiles() {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('profiles', 'readonly');
		const store = tx.objectStore('profiles');
		const req = store.getAll();

		req.onsuccess = () => resolve(req.result || []);
		req.onerror = () => reject(req.error);
	});
}

async function updateSetting(key, value) {
	const db = await openDB();
	const tx = db.transaction('settings', 'readwrite');
	const store = tx.objectStore('settings');
	store.put({ key, value });
	await transactionDone(tx);

	const message = {
		updateSettings: true,
		key,
		value
	};

	if (window.settingsAPI?.sendUpdate) {
		window.settingsAPI.sendUpdate(message);
	} else if (window.parent && window.parent !== window) {
		window.parent.postMessage(message, "*");
	}

	if (window.api?.settings?.save) {
		window.api.settings.save({ [key]: value }).catch(() => { });
	}

	console.log('Settings Saved.')
	return key;
}

const settingsView = document.getElementById("settingsView");

function sendToSettings(msg) {
	settingsView.send("from-browser", msg);
}


async function loadSetting(key) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('settings', 'readonly');
		const store = tx.objectStore('settings');
		const req = store.get(key);
		req.onsuccess = () => resolve(req.result?.value);
		req.onerror = () => reject(req.error);
	});
}

async function loadAllSettings() {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('settings', 'readonly');
		const store = tx.objectStore('settings');
		const req = store.getAll();

		req.onsuccess = () => resolve(req.result || []);
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

async function loadProfileSetting() {
	let profileName = localStorage.getItem('currentProfile')
	try {
		const PROFILES = await window.api?.profiles.list();
		if (!PROFILES) {
			console.error(PROFILES)
		}
		const SELECTED = PROFILES.find(p => p.name === profileName);
		if (SELECTED) {
			document.getElementById('curProfileInfo').innerHTML = `
			<div class="flex">
				<span id="profile-pfp">
				</span>
				<b style="font-size: 24px;">${SELECTED.name}</b>
			</div>
			<hr>
			<button class="wide-btn flex-sb">
				<span>Manage & Edit Profile Info</span>
				<i class="material-symbols-rounded">open_in_new</i>
			</button>
			<button class="wide-btn flex-sb" onclick="window.electronAPI?.openAppPage?.('pages/profilePages/profileManager.html',800,800,'Default');">
				<span>Open Profile Manager</span>
				<i class="material-symbols-rounded">open_in_new</i>
			</button>
			<button class="wide-btn flex-sb" onclick="importBookmarksFromHTML()">
				<span>Import Bookmarks</span>
				<i class="material-symbols-rounded">upload</i>
			</button>
			`;

			let pfpEl = document.getElementById('profile-pfp')
			if (SELECTED.avatar && SELECTED.avatar.startsWith('data:')) {
				// image avatar
				pfpEl.innerHTML = `<img src="${SELECTED.avatar}" alt="${SELECTED.name}'s Profile" style="width:36px;height:36px;border-radius:50%">`;
			} else if (SELECTED.avatar) {
				// monograph or custom HTML
				pfpEl.innerHTML = SELECTED.avatar;
			} else {
				// fallback icon
				pfpEl.innerHTML = `<i class="material-symbols-rounded">account_circle</i>`;
			}
		} else {
			console.warn('Profile not found in list:', profileName);
		}
	} catch (err) {
		console.error('Failed to load profiles:', err);
	}
}

async function loadValues() {
	const settingsArray = await loadAllSettings();
	if (!settingsArray) {
		console.warn("Settings don't exist.");
		return;
	}
	const settings = {};
	settingsArray.forEach(({ key, value }) => {
		settings[key] = value;
	});

	// System Theme
	const theme = await loadSetting('systemTheme')

	// Map saved value → radio input ID
	const map = {
		"light": "light-appearance",
		"dark": "dark-appearance",
		"light dark": "light-dark-appearance"
	};

	const id = map[theme];
	if (id) {
		const input = document.getElementById(id);
		if (input) input.checked = true;
	}

	const adblockToggle = document.getElementById('adblock-toggle');
	if (adblockToggle) {
		const enabled = await loadSetting('adBlockEnabled');
		adblockToggle.checked = Boolean(enabled);
		adblockToggle.addEventListener('change', (event) => {
			updateSetting('adBlockEnabled', event.target.checked);
		});
	}

	// Load General Settings
	const startupOption = await loadSetting('startup') || 'homepage';
	updateStartupUI(startupOption);

	const homepage = await loadSetting('homepage') || '';
	const homepageInput = document.getElementById('homepage-input');
	if (homepageInput) {
		homepageInput.value = homepage;
	}

	const searchEngine = await loadSetting('searchEngine') || 'google';
	const searchEngineSelect = document.getElementById('search-engine');
	if (searchEngineSelect) {
		searchEngineSelect.value = searchEngine;
		searchEngineSelect.addEventListener('change', (event) => {
			saveSearchEngine();
		});
	}

	// Autofill settings
	const autofillAddresses = await loadSetting('autofillAddresses');
	const autofillAddressesToggle = document.getElementById('autofill-addresses-toggle');
	if (autofillAddressesToggle) {
		autofillAddressesToggle.checked = Boolean(autofillAddresses);
		autofillAddressesToggle.addEventListener('change', (event) => {
			updateSetting('autofillAddresses', event.target.checked);
		});
	}

	const autofillPayments = await loadSetting('autofillPayments');
	const autofillPaymentsToggle = document.getElementById('autofill-payments-toggle');
	if (autofillPaymentsToggle) {
		autofillPaymentsToggle.checked = Boolean(autofillPayments);
		autofillPaymentsToggle.addEventListener('change', (event) => {
			updateSetting('autofillPayments', event.target.checked);
		});
	}

	// Behavior settings
	const smoothScrolling = await loadSetting('smoothScrolling');
	const smoothScrollingToggle = document.getElementById('smooth-scrolling-toggle');
	if (smoothScrollingToggle) {
		smoothScrollingToggle.checked = Boolean(smoothScrolling);
		smoothScrollingToggle.addEventListener('change', (event) => {
			updateSetting('smoothScrolling', event.target.checked);
		});
	}

	const restoreTabs = await loadSetting('restoreTabs');
	const restoreTabsToggle = document.getElementById('restore-tabs-toggle');
	if (restoreTabsToggle) {
		restoreTabsToggle.checked = Boolean(restoreTabs);
		restoreTabsToggle.addEventListener('change', (event) => {
			updateSetting('restoreTabs', event.target.checked);
		});
	}

	const language = await loadSetting('language') || 'en';
	const languageSelect = document.getElementById('language-select');
	if (languageSelect) {
		languageSelect.value = language;
		languageSelect.addEventListener('change', (event) => {
			updateSetting('language', event.target.value);
		});
	}

	// Performance Settings
	const memorySaver = await loadSetting('memorySaver');
	const memorySaverToggle = document.getElementById('memory-saver-toggle');
	if (memorySaverToggle) {
		memorySaverToggle.checked = Boolean(memorySaver);
		memorySaverToggle.addEventListener('change', (event) => {
			updateSetting('memorySaver', event.target.checked);
		});
	}

	const hardwareAccel = await loadSetting('hardwareAcceleration');
	const hardwareAccelToggle = document.getElementById('hardware-acceleration-toggle');
	if (hardwareAccelToggle) {
		hardwareAccelToggle.checked = Boolean(hardwareAccel);
		hardwareAccelToggle.addEventListener('change', (event) => {
			updateSetting('hardwareAcceleration', event.target.checked);
		});
	}

	const tabThrottling = await loadSetting('backgroundTabThrottling');
	const tabThrottlingToggle = document.getElementById('tab-throttling-toggle');
	if (tabThrottlingToggle) {
		tabThrottlingToggle.checked = Boolean(tabThrottling);
		tabThrottlingToggle.addEventListener('change', (event) => {
			updateSetting('backgroundTabThrottling', event.target.checked);
		});
	}

	const preloadPages = await loadSetting('preloadPages');
	const preloadPagesToggle = document.getElementById('preload-pages-toggle');
	if (preloadPagesToggle) {
		preloadPagesToggle.checked = Boolean(preloadPages);
		preloadPagesToggle.addEventListener('change', (event) => {
			updateSetting('preloadPages', event.target.checked);
		});
	}

	const performanceAlerts = await loadSetting('performanceAlerts');
	const performanceAlertsToggle = document.getElementById('performance-alerts-toggle');
	if (performanceAlertsToggle) {
		performanceAlertsToggle.checked = Boolean(performanceAlerts);
		performanceAlertsToggle.addEventListener('change', (event) => {
			updateSetting('performanceAlerts', event.target.checked);
		});
	}

	// Privacy Settings
	const trackingPrevention = await loadSetting('trackingPrevention');
	const trackingPreventionToggle = document.getElementById('tracking-prevention-toggle');
	if (trackingPreventionToggle) {
		trackingPreventionToggle.checked = Boolean(trackingPrevention);
		trackingPreventionToggle.addEventListener('change', (event) => {
			updateSetting('trackingPrevention', event.target.checked);
		});
	}

	const dnt = await loadSetting('doNotTrack');
	const dntToggle = document.getElementById('dnt-toggle');
	if (dntToggle) {
		dntToggle.checked = Boolean(dnt);
		dntToggle.addEventListener('change', (event) => {
			updateSetting('doNotTrack', event.target.checked);
		});
	}

	const httpsOnly = await loadSetting('httpsOnly');
	const httpsOnlyToggle = document.getElementById('https-only-toggle');
	if (httpsOnlyToggle) {
		httpsOnlyToggle.checked = Boolean(httpsOnly);
		httpsOnlyToggle.addEventListener('change', (event) => {
			updateSetting('httpsOnly', event.target.checked);
		});
	}

	const passwordManager = await loadSetting('passwordManager');
	const passwordManagerToggle = document.getElementById('password-manager-toggle');
	if (passwordManagerToggle) {
		passwordManagerToggle.checked = Boolean(passwordManager);
		passwordManagerToggle.addEventListener('change', (event) => {
			updateSetting('passwordManager', event.target.checked);
		});
	}

	const dangerousSites = await loadSetting('dangerousSitesWarning');
	const dangerousSitesToggle = document.getElementById('dangerous-sites-toggle');
	if (dangerousSitesToggle) {
		dangerousSitesToggle.checked = Boolean(dangerousSites);
		dangerousSitesToggle.addEventListener('change', (event) => {
			updateSetting('dangerousSitesWarning', event.target.checked);
		});
	}

	// Downloads Settings
	const warnDangerousDownload = await loadSetting('warnDangerousDownload');
	const warnDangerousDownloadToggle = document.getElementById('warn-dangerous-download-toggle');
	if (warnDangerousDownloadToggle) {
		warnDangerousDownloadToggle.checked = Boolean(warnDangerousDownload);
		warnDangerousDownloadToggle.addEventListener('change', (event) => {
			updateSetting('warnDangerousDownload', event.target.checked);
		});
	}

	const pdfInBrowser = await loadSetting('openPDFInBrowser');
	const pdfInBrowserToggle = document.getElementById('pdf-in-browser-toggle');
	if (pdfInBrowserToggle) {
		pdfInBrowserToggle.checked = Boolean(pdfInBrowser);
		pdfInBrowserToggle.addEventListener('change', (event) => {
			updateSetting('openPDFInBrowser', event.target.checked);
		});
	}

	const saveDownloadsHistory = await loadSetting('saveDownloadsHistory');
	const saveDownloadsHistoryToggle = document.getElementById('save-downloads-history-toggle');
	if (saveDownloadsHistoryToggle) {
		saveDownloadsHistoryToggle.checked = Boolean(saveDownloadsHistory);
		saveDownloadsHistoryToggle.addEventListener('change', (event) => {
			updateSetting('saveDownloadsHistory', event.target.checked);
		});
	}

	// Site Settings - Permissions
	const permissions = await loadSetting('permissions') || {};
	const cameraPerm = document.getElementById('camera-perm');
	if (cameraPerm) cameraPerm.value = permissions.camera || 'ask';

	const microphonePerm = document.getElementById('microphone-perm');
	if (microphonePerm) microphonePerm.value = permissions.microphone || 'ask';

	const locationPerm = document.getElementById('location-perm');
	if (locationPerm) locationPerm.value = permissions.location || 'ask';

	const notificationsPerm = document.getElementById('notifications-perm');
	if (notificationsPerm) notificationsPerm.value = permissions.notifications || 'ask';

	const clipboardPerm = document.getElementById('clipboard-perm');
	if (clipboardPerm) clipboardPerm.value = permissions.clipboard || 'ask';

	// More permissions
	const javascript = await loadSetting('permissions.javascript');
	const javascriptToggle = document.getElementById('javascript-toggle');
	if (javascriptToggle) {
		javascriptToggle.checked = javascript !== false;
		javascriptToggle.addEventListener('change', (event) => {
			updateSetting('permissions.javascript', event.target.checked);
		});
	}

	const autoplay = await loadSetting('permissions.autoplay') || 'allow';
	const autoplaySelect = document.getElementById('autoplay-perm');
	if (autoplaySelect) {
		autoplaySelect.value = autoplay;
		autoplaySelect.addEventListener('change', (event) => {
			updateSetting('permissions.autoplay', event.target.value);
		});
	}

	const popups = await loadSetting('permissions.popups');
	const popupsToggle = document.getElementById('popups-toggle');
	if (popupsToggle) {
		popupsToggle.checked = Boolean(popups);
		popupsToggle.addEventListener('change', (event) => {
			updateSetting('permissions.popups', event.target.checked);
		});
	}

	const usb = await loadSetting('permissions.usb');
	const usbToggle = document.getElementById('usb-toggle');
	if (usbToggle) {
		usbToggle.checked = Boolean(usb);
		usbToggle.addEventListener('change', (event) => {
			updateSetting('permissions.usb', event.target.checked);
		});
	}

	const serial = await loadSetting('permissions.serial');
	const serialToggle = document.getElementById('serial-toggle');
	if (serialToggle) {
		serialToggle.checked = Boolean(serial);
		serialToggle.addEventListener('change', (event) => {
			updateSetting('permissions.serial', event.target.checked);
		});
	}

	const midi = await loadSetting('permissions.midi');
	const midiToggle = document.getElementById('midi-toggle');
	if (midiToggle) {
		midiToggle.checked = Boolean(midi);
		midiToggle.addEventListener('change', (event) => {
			updateSetting('permissions.midi', event.target.checked);
		});
	}

	// Cookies setting
	const cookiesSetting = await loadSetting('cookies.setting') || 'all';
	updateCookiesUI(cookiesSetting);

	// Experimental features
	const aiSearch = await loadSetting('experimental.aiSearch');
	const aiSearchToggle = document.getElementById('ai-search-toggle');
	if (aiSearchToggle) {
		aiSearchToggle.checked = Boolean(aiSearch);
		aiSearchToggle.addEventListener('change', (event) => {
			updateSetting('experimental.aiSearch', event.target.checked);
		});
	}

	const aiTabOrg = await loadSetting('experimental.aiTabOrganization');
	const aiTabOrgToggle = document.getElementById('ai-tab-org-toggle');
	if (aiTabOrgToggle) {
		aiTabOrgToggle.checked = Boolean(aiTabOrg);
		aiTabOrgToggle.addEventListener('change', (event) => {
			updateSetting('experimental.aiTabOrganization', event.target.checked);
		});
	}

	const verticalTabs = await loadSetting('experimental.verticalTabs');
	const verticalTabsToggle = document.getElementById('vertical-tabs-toggle');
	if (verticalTabsToggle) {
		verticalTabsToggle.checked = Boolean(verticalTabs);
		verticalTabsToggle.addEventListener('change', (event) => {
			updateSetting('experimental.verticalTabs', event.target.checked);
		});
	}

	const compactMode = await loadSetting('experimental.compactMode');
	const compactModeToggle = document.getElementById('compact-mode-toggle');
	if (compactModeToggle) {
		compactModeToggle.checked = Boolean(compactMode);
		compactModeToggle.addEventListener('change', (event) => {
			updateSetting('experimental.compactMode', event.target.checked);
		});
	}

	const cookieIsolation = await loadSetting('experimental.cookieIsolation');
	const cookieIsolationToggle = document.getElementById('cookie-isolation-toggle');
	if (cookieIsolationToggle) {
		cookieIsolationToggle.checked = Boolean(cookieIsolation);
		cookieIsolationToggle.addEventListener('change', (event) => {
			updateSetting('experimental.cookieIsolation', event.target.checked);
		});
	}

	const fingerprintProtection = await loadSetting('experimental.fingerprintProtection');
	const fingerprintProtectionToggle = document.getElementById('fingerprint-protection-toggle');
	if (fingerprintProtectionToggle) {
		fingerprintProtectionToggle.checked = Boolean(fingerprintProtection);
		fingerprintProtectionToggle.addEventListener('change', (event) => {
			updateSetting('experimental.fingerprintProtection', event.target.checked);
		});
	}

	const debugInfo = await loadSetting('experimental.debugInfo');
	const debugInfoToggle = document.getElementById('debug-info-toggle');
	if (debugInfoToggle) {
		debugInfoToggle.checked = Boolean(debugInfo);
		debugInfoToggle.addEventListener('change', (event) => {
			updateSetting('experimental.debugInfo', event.target.checked);
		});
	}
}

const sidebarLinks = document.querySelectorAll('#settingSidebar a');
const sections = document.querySelectorAll('.setting-section');

// Track the currently active section
let currentActiveSection = null;

const observer = new IntersectionObserver((entries) => {
	// Find the section with the highest intersection ratio (most visible)
	let maxRatio = 0;
	let mostVisibleSection = null;

	entries.forEach(entry => {
		if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
			maxRatio = entry.intersectionRatio;
			mostVisibleSection = entry.target;
		}
	});

	// Only update if we found a section and it's different from current
	if (mostVisibleSection && mostVisibleSection !== currentActiveSection) {
		currentActiveSection = mostVisibleSection;
		const id = mostVisibleSection.id;

		// Clear all active states first
		sidebarLinks.forEach(link => {
			link.classList.remove('active');
		});

		// Set active state for the current section
		sidebarLinks.forEach(link => {
			if (link.dataset.target === id) {
				link.classList.add('active');
			}
		});
	}
}, {
	root: document.getElementById('main-content'),
	threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], // Multiple thresholds for better detection
	rootMargin: '-10% 0px -10% 0px' // Trigger when section is near the center
});

sections.forEach(section => observer.observe(section));

// Hue (for theme selector)

const hueBar = document.getElementById("hue-bar");
const hueCursor = document.getElementById("hue-cursor");

window.addEventListener("load", () => {
	const rect = hueBar.getBoundingClientRect();

	// Use your saved hue (globHue) or default to 200
	const hue = globHue ?? 200;

	// Convert hue → x position
	let x = (hue / 360) * rect.width;

	// Clamp
	x = Math.max(0, Math.min(x, rect.width));

	// Move cursor
	hueCursor.style.left = x + "px";
});


let globHue;

function updateHueFromEvent(e) {
	const rect = hueBar.getBoundingClientRect();
	let x = e.clientX - rect.left;

	// clamp between 0 and width
	x = Math.max(0, Math.min(x, rect.width));

	// move cursor
	hueCursor.style.left = x + "px";

	// convert to hue (0–360)
	const hue = (x / rect.width) * 360;

	globHue = hue;

	// --- convert hue → hex (inline, no new functions) ---
	// HSL → RGB
	let s = 1;   // 100%
	let l = 0.5; // 50%

	const k = n => (n + hue / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = n =>
		l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

	const r = Math.round(255 * f(0));
	const g = Math.round(255 * f(8));
	const b = Math.round(255 * f(4));

	// RGB → HEX
	const hex =
		"#" +
		r.toString(16).padStart(2, "0") +
		g.toString(16).padStart(2, "0") +
		b.toString(16).padStart(2, "0");

	updateSetting('theme', generateColorScale(hex));

	return { hue, hex };
}

hueBar.addEventListener("mousedown", (e) => {
	const move = (e) => updateHueFromEvent(e);

	hueCursor.style.display = 'unset';

	move(e); // initial click
	window.addEventListener("mousemove", move);

	window.addEventListener("mouseup", () => {
		window.removeEventListener("mousemove", move);
		hueCursor.style.display = 'none';
	}, { once: true });
});

// The function the generates the scheme
function generateColorScale(baseHex) {
	// --- helpers ---
	function hexToRgb(hex) {
		hex = hex.replace("#", "");
		if (hex.length === 3) hex = hex.split("").map(x => x + x).join("");
		const num = parseInt(hex, 16);
		return [
			(num >> 16) & 255,
			(num >> 8) & 255,
			num & 255
		];
	}

	function rgbToHsl(r, g, b) {
		r /= 255; g /= 255; b /= 255;
		const max = Math.max(r, g, b), min = Math.min(r, g, b);
		let h, s, l = (max + min) / 2;

		if (max === min) {
			h = s = 0;
		} else {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
				case g: h = ((b - r) / d + 2); break;
				case b: h = ((r - g) / d + 4); break;
			}
			h *= 60;
		}
		return [h, s * 100, l * 100];
	}

	function hslToHex(h, s, l) {
		s /= 100; l /= 100;
		const k = n => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = n =>
			l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

		const r = Math.round(255 * f(0));
		const g = Math.round(255 * f(8));
		const b = Math.round(255 * f(4));

		return "#" + [r, g, b]
			.map(x => x.toString(16).padStart(2, "0"))
			.join("");
	}

	// --- convert base color to HSL ---
	const [r, g, b] = hexToRgb(baseHex);
	const [h, s, l] = rgbToHsl(r, g, b);

	// --- generate 10 steps ---
	const scale = {};

	for (let i = 1; i <= 10; i++) {
		const t = (i - 1) / 9; // 0 → 1

		// Darkest → Lightest curve
		let lightness = l * 0.25 + t * (97 - l * 0.25);

		// Saturation curve:
		// - keep strong in mid tones
		// - reduce for c10 but never to zero
		let saturation = s * (1 - t * 0.6) + 10 * t;

		// Ensure c10 has color (not white)
		if (i === 10) {
			saturation = Math.max(s * 0.25, 12); // minimum tint
			lightness = 96; // near-white but colored
		}

		scale[`c${i}`] = hslToHex(h, Math.min(saturation, 100), lightness);

		scale['base'] = baseHex;
		scale['hue'] = globHue;
	}

	return scale;
}

// General Settings Functions
function updateStartup(option) {
	updateSetting('startup', option);
	updateStartupUI(option);
}

function updateStartupUI(option) {
	['homepage', 'last-session', 'new-tab'].forEach(opt => {
		const btn = document.getElementById(`startup-${opt}-btn`);
		if (btn) {
			btn.classList.toggle('active', opt === option);
		}
	});
}

function saveHomepage() {
	const input = document.getElementById('homepage-input');
	if (input && input.value) {
		updateSetting('homepage', input.value);
		alert('Homepage saved!');
	} else {
		alert('Please enter a valid URL.');
	}
}

function saveSearchEngine() {
	const select = document.getElementById('search-engine');
	if (select) {
		updateSetting('searchEngine', select.value);
		alert('Search engine updated!');
	}
}

// Cookies Functions
function updateCookiesSetting(setting) {
	updateSetting('cookies.setting', setting);
	updateCookiesUI(setting);
}

function updateCookiesUI(setting) {
	['all', 'third-party', 'all-block'].forEach(opt => {
		const btn = document.getElementById(`cookies-${opt}-btn`);
		if (btn) {
			btn.classList.toggle('active', opt === setting);
		}
	});
}

// Privacy Functions
function clearBrowsingData() {
	if (confirm('Are you sure? This will clear your history, cookies, and cached files.')) {
		if (window.settingsAPI?.sendUpdate) {
			window.settingsAPI.sendUpdate({
				action: 'clear-browsing-data',
				clearHistory: true,
				clearCookies: true,
				clearCache: true
			});
		} else if (window.api?.settings?.clearData) {
			window.api.settings.clearData();
		}
		alert('Browsing data cleared!');
	}
}

// Download Functions
function clearDownloadHistory() {
	if (confirm('Clear your download history?')) {
		if (window.settingsAPI?.sendUpdate) {
			window.settingsAPI.sendUpdate({
				action: 'clear-download-history'
			});
		}
		alert('Download history cleared!');
	}
}

// About Functions
function checkForUpdates() {
	alert('Checking for updates...');
	if (window.api?.updates?.check) {
		window.api.updates.check();
	}
}

function viewLicenses() {
	if (window.electronAPI?.openExternal) {
		window.electronAPI.openExternal('about:licenses');
	} else {
		alert('Licenses information not available');
	}
}

function resetBrowser() {
	if (confirm('This will reset all settings to their default values. Are you sure?\n\nBookmarks and history will NOT be deleted.')) {
		if (window.settingsAPI?.sendUpdate) {
			window.settingsAPI.sendUpdate({
				action: 'reset-settings'
			});
		}
		alert('Settings reset to defaults!');
	}
}

// Site Settings Functions
function updatePermission(permission, value) {
	updateSetting(`permissions.${permission}`, value);
}

// Utility function
function openLink(url) {
	if (window.electronAPI?.openExternal) {
		window.electronAPI.openExternal(url);
	} else {
		window.open(url, '_blank');
	}
}

function toggleSidebar() {
	let sidebar = document.querySelector('aside');

	if (sidebar.classList.contains('open')) {
		sidebar.classList.remove('open');
	} else {
		sidebar.classList.add('open');
	}
}

// Import Bookmarks
function importBookmarksFromHTML() {
	let input = document.getElementById("bookmarkImportInput");
	if (!input) {
		input = document.createElement("input");
		input.type = "file";
		input.accept = ".html,.htm";
		input.id = "bookmarkImportInput";
		input.style.display = "none";
		document.body.appendChild(input);
	}

	input.onchange = async () => {
		const file = input.files[0];
		if (!file) return;

		try {
			const text = await file.text();
			const parser = new DOMParser();
			const doc = parser.parseFromString(text, "text/html");

			const anchors = [...doc.querySelectorAll("a")];

			if (anchors.length === 0) {
				alert("No bookmarks found in this file.");
				return;
			}

			let imported = 0;

			for (const a of anchors) {
				setTimeout(function () {

					const url = a.getAttribute("href");
					const title = a.textContent.trim();

					if (url) {
						const payload = {
							type: "add-bookmark",
							bookmark: {
								title,
								url,
								favicon: null,
								createdAt: Date.now()
							}
						};

						if (window.settingsAPI?.sendBookmark) {
							window.settingsAPI.sendBookmark(payload);
						} else if (window.parent && window.parent !== window) {
							window.parent.postMessage(payload, "*");
						}

						imported++;
					}
				}, imported * 10)
			}

			alert(`Imported ${imported} bookmarks.`);
		} catch (err) {
			console.error("Bookmark import failed:", err);
			alert("Failed to import bookmarks.");
		}

		input.value = "";
	};

	input.click();
}