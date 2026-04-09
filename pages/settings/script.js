const isMac = navigator.platform.toLowerCase().includes('mac');

document.addEventListener('DOMContentLoaded', () => {
	if (loadSetting('theme')) {
		Object.entries(loadSetting('theme')).forEach(([key, value]) => {
			document.documentElement.style.setProperty(`--${key}`, value);
		});
		loadValues();
	}
})

// ---------- IndexedDB helpers (fixed and robust) ----------
function openDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('BrowserProfilesDB', 5);

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
	window.parent.postMessage({ updateSettings: true }, window.origin);
	return key;
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
	if (!id) return; // safety

	// Check the correct radio button
	const input = document.getElementById(id);
	if (input) input.checked = true;
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

function toggleSidebar() {
	let sidebar = document.querySelector('aside');

	if (sidebar.classList.contains('open')) {
		sidebar.classList.remove('open');
	} else {
		sidebar.classList.add('open');
	}
}