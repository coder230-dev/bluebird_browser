const { app, BrowserWindow, ipcMain, Menu, MenuItem, screen, shell, webContents, clipboard, session, dialog, nativeImage, systemPreferences, Tray } = require('electron');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { autoUpdater } = require("electron-updater");
const { type } = require('os');

const isMac = process.platform === 'darwin';
let windows = [];
let currentProfile = 'Default';
let mainWindow = null;
let allowClose = true;

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const profilesPath = path.join(app.getPath('userData'), 'profiles.json');
const boundsPath = path.join(app.getPath('userData'), 'window-bounds.json');
const passwordsPath = path.join(app.getPath('userData'), 'passwords.json');

let openTabs = [];
const webviews = new Set();

// ============= UTILITY FUNCTIONS =============
function loadProfilesJSON() {
	if (!fs.existsSync(profilesPath)) return [];
	try {
		const data = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
		return Array.isArray(data) ? data : [];
	} catch (err) {
		console.warn('Failed to parse profiles.json:', err.message);
		return [];
	}
}

function loadWindowBounds() {
	if (!fs.existsSync(boundsPath)) return null;
	try {
		return JSON.parse(fs.readFileSync(boundsPath, 'utf-8'));
	} catch (err) {
		console.warn('Failed to parse window bounds:', err.message);
		return null;
	}
}

function switchProfile(profileName) {
	currentProfile = profileName;
	ensureProfile(profileName);
	saveSettings({ ...loadSettings(), lastProfile: profileName });
}

function sendToWindow(target, channel, data = {}) {
	if (target && !target.isDestroyed()) {
		target.webContents.send(channel, data);
	}
}

function getSafeWindow() {
	const target = BrowserWindow.getFocusedWindow();
	return (target && !target.isDestroyed()) ? target : null;
}

async function updateApplicationMenu(win) {
	const menu = await buildAppMenu(win);
	Menu.setApplicationMenu(menu);
}

// ============= PASSWORD MANAGER =============
function loadPasswords() {
	if (!fs.existsSync(passwordsPath)) return [];
	try {
		const data = fs.readFileSync(passwordsPath, 'utf-8');
		return JSON.parse(data);
	} catch (err) {
		console.warn('Failed to load passwords:', err.message);
		return [];
	}
}

function savePasswords(passwords) {
	try {
		fs.writeFileSync(passwordsPath, JSON.stringify(passwords, null, 2));
	} catch (err) {
		console.warn('Failed to save passwords:', err.message);
	}
}

function encrypt(text, key) {
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
	let encrypted = cipher.update(text, 'utf8', 'hex');
	encrypted += cipher.final('hex');
	return { encrypted, iv: iv.toString('hex') };
}

function decrypt(encrypted, key, iv) {
	const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
	let decrypted = decipher.update(encrypted, 'hex', 'utf8');
	decrypted += decipher.final('utf8');
	return decrypted;
}

async function promptBiometric() {
	if (isMac && systemPreferences.canPromptTouchID()) {
		try {
			await systemPreferences.promptTouchID('Authenticate to access passwords');
			return true;
		} catch (err) {
			return false;
		}
	}
	// For Windows/Linux, could use other methods, but for now return true
	return true;
}

// ============= PROFILES =============
function ensureProfile(name) {
	let profiles = loadProfilesJSON();

	if (profiles.find(p => p && typeof p.name === 'string' && p.name === name)) return name;

	const newProfile = { name: String(name), avatar: null, createdAt: Date.now(), updatedAt: Date.now() };
	profiles.push(newProfile);
	try { fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2)); } catch (err) {
		console.warn('Failed to write profiles.json:', err.message);
	}
	return name;
}

async function listProfiles() {
	const arr = loadProfilesJSON();
	const cleaned = arr
		.filter(p => p && typeof p.name === 'string' && p.name.trim().length)
		.map(p => ({ name: p.name.trim(), avatar: p.avatar ?? null }));
	return cleaned.length ? cleaned : [{ name: 'Default', avatar: null }];
}

// Register IPC handlers for window close control (once at module level)
ipcMain.on("block-close", () => {
	allowClose = false;
});
ipcMain.on("allow-close", () => {
	allowClose = true;
	if (mainWindow) mainWindow.close();
});

// ---------------- Settings ----------------
function loadSettings() {
	if (!fs.existsSync(settingsPath)) {
		const defaults = { homepage: 'https://example.com', lastProfile: 'Default' };
		try { fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2)); } catch (err) {
			console.warn('Failed to write default settings:', err.message);
		}
		return defaults;
	}
	try {
		return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
	} catch (err) {
		console.warn('Failed to parse settings.json:', err.message);
		return { homepage: 'https://example.com', lastProfile: 'Default' };
	}
}

function saveSettings(newSettings) {
	try {
		fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));
	} catch (err) {
		console.warn('Failed to save settings:', err.message);
	}
}

// ---------------- Context menu for BrowserWindow ----------------
function setupContextMenu(win) {
	win.webContents.on("context-menu", (event, params) => {
		const menu = buildContextMenu(params, win.webContents);
		menu.popup({ window: win });
	});

	win.webContents.on("did-attach-webview", (event, wc) => {
		wc.on("context-menu", (event, params) => {
			const parentWin = BrowserWindow.fromWebContents(wc);
			const menu = buildContextMenu(params, wc);
			menu.popup({ window: parentWin });
		});
	});
}

const sendAction = (type, data = {}) => {
	const target = BrowserWindow.getFocusedWindow();
	if (target && !target.isDestroyed()) {
		target.webContents.send('context-action', { type, ...data });
	}
};

function buildContextMenu(params, wc) {
	const searchGoogle = (text) =>
		wc.loadURL(`https://www.google.com/search?q=${encodeURIComponent(text)}`);

	const template = [];

	// ─────────────────────────────────────────────
	// SPELLCHECK
	// ─────────────────────────────────────────────
	if (params.misspelledWord) {
		const spellcheckTemp = [
			{ label: `Replace "${params.misspelledWord}" with:`, enabled: false },
			...params.dictionarySuggestions.map(suggestion => ({
				label: suggestion,
				click: () => wc.replaceMisspelling(suggestion)
			})),
			{ type: "separator" },
			{ label: "Ignore", click: () => wc.ignoreSpelling(params.misspelledWord) },
			{ label: "Ignore All", click: () => wc.ignoreSpelling(params.misspelledWord, { all: true }) },
			{ label: `Search Google for "${params.misspelledWord}"`, click: () => searchGoogle(params.misspelledWord) },
			{ type: "separator" },
			{ role: "toggleSpellChecker" },
			{ label: "Add to Dictionary", click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord) },
			{ type: "separator" }
		];

		template.push({ label: "Spelling", submenu: spellcheckTemp });
		template.push({ type: "separator" });
	}

	// ─────────────────────────────────────────────
	// LINK ACTIONS
	// ─────────────────────────────────────────────
	if (params.linkURL) {
		template.push(
			{ label: "Open Link", click: () => wc.loadURL(params.linkURL) },
			{ label: "Open Link in New Tab", click: () => sendAction("openInNew", { url: params.linkURL }) },
			{ label: "Open Link in Sidebar", click: () => sendAction("openSidebarApp", { url: params.linkURL }) },
			{ label: "Copy Link", click: () => clipboard.writeText(params.linkURL) },
			{ label: "Bookmark Link", click: () => sendAction("addBookmark", { url: params.linkURL, title: params.linkText || params.linkURL }) },
			{ type: "separator" }
		);
	}

	// ─────────────────────────────────────────────
	// IMAGE ACTIONS
	// ─────────────────────────────────────────────
	if (params.mediaType === "image" && params.srcURL) {
		template.push(
			{
				label: "Copy Image",
				click: async () => {
					const buffer = await fetch(params.srcURL).then(r => r.arrayBuffer());
					const img = nativeImage.createFromBuffer(Buffer.from(buffer));
					clipboard.writeImage(img);
				}
			},
			{ label: "Copy Image URL", click: () => clipboard.writeText(params.srcURL) },
			{ label: "Open Image in New Tab", click: () => sendAction("openInNew", { url: params.srcURL }) },
			{ label: "Open Image in Sidebar", click: () => sendAction("openSidebarApp", { url: params.srcURL }) },
			{ type: "separator" },
			{
				label: "Download Image As…",
				click: async () => {
					const { filePath } = await dialog.showSaveDialog({
						title: "Save Image As",
						defaultPath: "image.png",
						filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }]
					});
					if (!filePath) return;
					const buffer = Buffer.from(await fetch(params.srcURL).then(r => r.arrayBuffer()));
					fs.writeFileSync(filePath, buffer);
				}
			},
			{ type: "separator" },
			{ label: "Search Google for Image", click: () => sendAction("openInNew", { url: `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(params.srcURL)}` }) },
			{ type: "separator" }
		);
	}

	// ─────────────────────────────────────────────
	// VIDEO ACTIONS
	// ─────────────────────────────────────────────
	if (params.mediaType === "video" && params.srcURL) {
		template.push(
			{ label: "Play/Pause", click: () => sendAction("togglePlay") },
			{ label: "Mute/Unmute", click: () => sendAction("toggleMute") },
			{ label: "Loop", click: () => sendAction("toggleLoop") },
			{ label: "Picture-in-Picture", click: () => sendAction("togglePiP") },
			{ label: "Fullscreen", click: () => sendAction("toggleVideoFullscreen") },
			{ type: "separator" },
			{ label: "Copy Video URL", click: () => clipboard.writeText(params.srcURL) },
			{ label: "Open Video in New Tab", click: () => sendAction("openInNew", { url: params.srcURL }) },
			{ label: "Open Video in Sidebar", click: () => sendAction("openSidebarApp", { url: params.srcURL }) },
			{ type: "separator" },
			{
				label: "Download Video As…",
				click: async () => {
					const { filePath } = await dialog.showSaveDialog({
						title: "Save Video As",
						defaultPath: "video.mp4",
						filters: [{ name: "Videos", extensions: ["mp4", "webm", "avi", "mkv"] }]
					});
					if (!filePath) return;
					const buffer = Buffer.from(await fetch(params.srcURL).then(r => r.arrayBuffer()));
					fs.writeFileSync(filePath, buffer);
				}
			},
			{ type: "separator" },
			{
				label: "Playback Speed",
				submenu: [
					{ label: "0.25x", click: () => sendAction("setPlaybackRate", { rate: 0.25 }) },
					{ label: "0.5x", click: () => sendAction("setPlaybackRate", { rate: 0.5 }) },
					{ label: "0.75x", click: () => sendAction("setPlaybackRate", { rate: 0.75 }) },
					{ label: "1x (Normal)", click: () => sendAction("setPlaybackRate", { rate: 1 }) },
					{ label: "1.25x", click: () => sendAction("setPlaybackRate", { rate: 1.25 }) },
					{ label: "1.5x", click: () => sendAction("setPlaybackRate", { rate: 1.5 }) },
					{ label: "2x", click: () => sendAction("setPlaybackRate", { rate: 2 }) }
				]
			},
			{ type: "separator" },
			{ label: "Seek Backward 10s", click: () => sendAction("seekBackward", { seconds: 10 }) },
			{ label: "Seek Forward 10s", click: () => sendAction("seekForward", { seconds: 10 }) },
			{ label: "Seek Backward 30s", click: () => sendAction("seekBackward", { seconds: 30 }) },
			{ label: "Seek Forward 30s", click: () => sendAction("seekForward", { seconds: 30 }) },
			{ type: "separator" }
		);
	}

	// ─────────────────────────────────────────────
	// AUDIO ACTIONS
	// ─────────────────────────────────────────────
	if (params.mediaType === "audio" && params.srcURL) {
		template.push(
			{ label: "Play/Pause", click: () => sendAction("togglePlay") },
			{ label: "Mute/Unmute", click: () => sendAction("toggleMute") },
			{ label: "Loop", click: () => sendAction("toggleLoop") },
			{ type: "separator" },
			{ label: "Copy Audio URL", click: () => clipboard.writeText(params.srcURL) },
			{ label: "Open Audio in New Tab", click: () => sendAction("openInNew", { url: params.srcURL }) },
			{ label: "Open Audio in Sidebar", click: () => sendAction("openSidebarApp", { url: params.srcURL }) },
			{ type: "separator" },
			{
				label: "Download Audio As…",
				click: async () => {
					const { filePath } = await dialog.showSaveDialog({
						title: "Save Audio As",
						defaultPath: "audio.mp3",
						filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a"] }]
					});
					if (!filePath) return;
					const buffer = Buffer.from(await fetch(params.srcURL).then(r => r.arrayBuffer()));
					fs.writeFileSync(filePath, buffer);
				}
			},
			{ type: "separator" },
			{
				label: "Playback Speed",
				submenu: [
					{ label: "0.25x", click: () => sendAction("setPlaybackRate", { rate: 0.25 }) },
					{ label: "0.5x", click: () => sendAction("setPlaybackRate", { rate: 0.5 }) },
					{ label: "0.75x", click: () => sendAction("setPlaybackRate", { rate: 0.75 }) },
					{ label: "1x (Normal)", click: () => sendAction("setPlaybackRate", { rate: 1 }) },
					{ label: "1.25x", click: () => sendAction("setPlaybackRate", { rate: 1.25 }) },
					{ label: "1.5x", click: () => sendAction("setPlaybackRate", { rate: 1.5 }) },
					{ label: "2x", click: () => sendAction("setPlaybackRate", { rate: 2 }) }
				]
			},
			{ type: "separator" },
			{ label: "Seek Backward 10s", click: () => sendAction("seekBackward", { seconds: 10 }) },
			{ label: "Seek Forward 10s", click: () => sendAction("seekForward", { seconds: 10 }) },
			{ label: "Seek Backward 30s", click: () => sendAction("seekBackward", { seconds: 30 }) },
			{ label: "Seek Forward 30s", click: () => sendAction("seekForward", { seconds: 30 }) },
			{ type: "separator" }
		);
	}

	// ─────────────────────────────────────────────
	// EDITABLE FIELDS
	// ─────────────────────────────────────────────
	if (params.isEditable) {
		template.push(
			{ role: "undo" }, { role: "redo" }, { type: "separator" },
			{ role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }, { role: "delete" },
			{ type: "separator" },
			{ label: "Services", role: "services", submenu: [] },
			{ type: "separator" }
		);

		// Autofill submenu
		const url = wc.getURL();
		const passwords = loadPasswords().filter(p => p.url === url && p.profile === currentProfile);
		if (passwords.length > 0) {
			const autofillSubmenu = passwords.map(p => ({
				label: `Username: ${p.username}`,
				click: () => {
					// Send autofill action to renderer
					sendAction("autofill", { username: p.username, password: p.password });
				}
			}));
			template.push({
				label: "Autofill",
				submenu: autofillSubmenu
			});
			template.push({ type: "separator" });
		}
	}

	// ─────────────────────────────────────────────
	// TEXT SELECTION
	// ─────────────────────────────────────────────
	else if (params.selectionText) {
		template.push(
			{ role: "copy" },
			{ type: "separator" },
			{ label: "Search with Google", click: () => searchGoogle(params.selectionText) },
			{ label: "Translate with Google", click: () => sendAction("openInNew", { url: `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(params.selectionText)}&op=translate` }) },
			{ label: "Search Wikipedia", click: () => sendAction("openInNew", { url: `https://en.wikipedia.org/wiki/${encodeURIComponent(params.selectionText)}` }) },
			{ type: "separator" },
			{
				label: "Speech",
				submenu: [
					{ role: "startSpeaking" },
					{ role: "stopSpeaking" }
				]
			},
			{ type: "separator" }
		);
	}

	// ─────────────────────────────────────────────
	// FRAME ACTIONS
	// ─────────────────────────────────────────────
	if (params.frameURL && params.frameURL !== params.pageURL) {
		template.push(
			{ label: "Reload Frame", click: () => sendAction("reloadFrame") },
			{ label: "Open Frame in New Tab", click: () => sendAction("openInNew", { url: params.frameURL }) },
			{ label: "View Frame Source", click: () => sendAction("viewFrameSource") },
			{ type: "separator" }
		);
	}

	// ─────────────────────────────────────────────
	// PAGE ACTIONS
	// ─────────────────────────────────────────────
	template.push(
		{ type: "separator" }
	);

	// ─────────────────────────────────────────────
	// NAVIGATION
	// ─────────────────────────────────────────────
	template.push(
		{ label: "Back", click: () => sendAction("goBack") },
		{ label: "Forward", click: () => sendAction("goForward") },
		{ label: "Reload", click: () => sendAction("reload") },
		{ label: "Save Page As…", click: () => sendAction("savePage") },
		{ label: "Print Page", click: () => sendAction("print") },
		{ type: "separator" }
	);

	// ─────────────────────────────────────────────
	// ZOOM
	// ─────────────────────────────────────────────
	template.push({
		label: "Zoom",
		submenu: [
			{ label: `Current Zoom: ${Math.round(wc.getZoomFactor() * 100)}%`, enabled: false },
			{ type: "separator" },
			{ label: "Zoom In", click: () => sendAction("zoomIn") },
			{ label: "Zoom Out", click: () => sendAction("zoomOut") },
			{ label: "Reset Zoom", click: () => sendAction("zoomReset") }
		]
	});

	template.push({ type: "separator" });

	// ─────────────────────────────────────────────
	// DEVELOPER TOOLS
	// ─────────────────────────────────────────────
	template.push(
		{ label: "Inspect", click: () => sendAction("devtools") },
		{ label: "View Page Source", click: () => sendAction("viewSource") },
	);

	return Menu.buildFromTemplate(template.filter(Boolean));
}


// ---------------- Menu ----------------
async function buildProfilesMenu(win) {
	const profiles = await listProfiles();

	return profiles.map(p => ({
		label: p.name,
		type: 'radio',
		checked: p.name === currentProfile,
		click: async () => {

			let target = windows.find(w => w.profileName === p.name && !w.isDestroyed());

			if (target) {
				target.focus();
				currentProfile = p.name;
			} else {
				switchProfile(p.name);
				target = await createWindow(p.name);
			}

			await updateApplicationMenu(target);

			if (target && !target.isDestroyed()) {
				target.webContents.send('switch-profile', p.name);
			}
		}
	}));
}

async function getTargetOfWv() {
	return getSafeWindow();
}

async function openSidebarApp(type, payload) {
	const target = getSafeWindow();
	if (target) {
		target.webContents.send('context-action', { type, ...payload });
	}
}

async function buildAppMenu(win) {
	const profilesSubmenu = await buildProfilesMenu(win);

	const send = (type, payload = {}) => {
		const target = getSafeWindow();
		if (target) {
			target.webContents.send('context-action', { type, ...payload });
		}
	};

	const menuOptions = [
		{
			label: app.name,
			submenu: [
				{ role: 'about' },
				{ type: 'separator' },
				{ role: 'services' },
				{ label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => send('openSettings') },
				{ type: 'separator' },
				{ role: 'hide' },
				{ role: 'hideOthers' },
				{ role: 'unhide' },
				{ type: 'separator' },
				{ label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', click: () => send('closeWindow') },
				isMac ? { role: 'quit' } : { role: 'close' }
			]
		},

		{
			label: 'Edit',
			submenu: [
				{ role: 'undo' },
				{ role: 'redo' },
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				{ role: 'delete' },
				{ type: 'separator' },
				{ role: 'selectAll' }
			]
		},

		{
			label: 'View',
			submenu: [
				{ label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => send('reload') },
				{ label: 'Stop Loading', accelerator: 'Esc', click: () => send('stop') },
				{ type: 'separator' },
				{ label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => send('zoomIn') },
				{ label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => send('zoomOut') },
				{ label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => send('zoomReset') },
				{ type: 'separator' },
				{ label: 'Toggle Fullscreen', accelerator: 'CmdOrCtrl+Alt+F', click: () => send('toggleFullscreen') },
			]
		},

		{
			label: 'Navigate',
			submenu: [
				{ label: 'Jump to Search Bar', accelerator: 'CmdOrCtrl+/', click: () => send('jumpToSearchBar') },
				{ type: 'separator' },
				{ label: 'Back', accelerator: 'Alt+Left', click: () => send('goBack') },
				{ label: 'Forward', accelerator: 'Alt+Right', click: () => send('goForward') },
				{ type: 'separator' },
				{ label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => send('findInPage') },
				{ type: 'separator' },
				{ label: 'Open in Sidebar', click: () => send('openInSidebarCurrent') }
			]
		},

		{
			label: 'Tools',
			submenu: [
				{ label: 'History', click: () => send('historyManager') },
				{
					label: 'Bookmarks',
					submenu: [
						{ label: 'Bookmark this Page', accelerator: 'CmdOrCtrl+D', click: () => send('addCBookmark') },
						{ label: 'Bookmarks Manager', click: () => send('bookmarksManager') }
					]
				},
				{ type: 'separator' },
				{ label: 'Developer Tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => send('devtools') },
				{ label: 'View Source', accelerator: 'CmdOrCtrl+U', click: () => send('viewSource') },
				{ type: 'separator' },
				{ label: 'Mute Tab', click: () => send('muteTab') },
				{ label: 'Unmute Tab', click: () => send('unmuteTab') },
				{ label: 'Translate Page', click: () => send('translatePage') }
			]
		},

		{
			label: 'Tabs',
			submenu: [
				{ label: 'Tabs Manager', accelerator: 'CmdOrCtrl+Alt+T', click: () => send('tabManager') },
				{ type: 'separator' },
				{ label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => send('newWindow') },
				{ type: 'separator' },
				{ label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => send('newTab') },
				{ label: 'Duplicate Tab', click: () => send('duplicateTab') },
				{ type: 'separator' },
				{ label: 'Next Tab', accelerator: 'Ctrl+Tab', click: () => send('nextTab') },
				{ label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: () => send('previousTab') },
				{ type: 'separator' },
				{ label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => send('closeTab') },
				{ label: 'Close Tab To the Right', accelerator: 'CmdOrCtrl+Alt+Shift+W', click: () => send('closeTabOnRight') },
				{ label: 'Close Other Tabs', accelerator: 'CmdOrCtrl+Shift+E', click: () => send('closeOtherTabs') },
			]
		},

		{ role: 'windowMenu' },

		{
			label: 'Profiles',
			submenu: [
				...profilesSubmenu,
				{ type: 'separator' },
				{ label: 'Add Profile…', click: () => loadBrowserWindow('pages/profilePages/addProfile.html', 550, 750) },
				{ label: 'Profile Manager…', click: () => loadBrowserWindow('pages/profilePages/accountMakeSure.html', 500, 700) }
			]
		},
		{
			role: 'help',
			submenu: [
				{ label: `Browser ver. ${app.getVersion()}`, enabled: false },
				{ type: 'separator' },
				{ label: `Built with Electron & Chromium`, enabled: false },
				{
					label: 'Learn More about Electron',
					click: async () => {
						sendAction("openInNew", { url: 'https://electronjs.org' })
					}
				},
				{
					label: 'Learn More about The Chromium Project',
					click: async () => {
						sendAction("openInNew", { url: 'https://chromium.org' });
					}
				},
				{
					label: 'About this Browser',
					click: () => loadBrowserWindow('', 750, 750, undefined, true, { resizeable: true }, [])
				},
				{ type: 'separator' },
				{ label: `Open Source`, enabled: false },
				{
					label: 'GitHub Project',
					click: async () => {
						sendAction("openInNew", { url: 'https://github.com/coder230-dev/bluebird_browser' });
					}
				},
				{ role: 'toggleDevTools' }
			]
		}
	];


	return Menu.buildFromTemplate(menuOptions);
}

// ---------------- Windows ----------------
async function createWindow(profile = 'Default') {
	const bounds = loadWindowBounds();

	const win = new BrowserWindow({
		width: bounds?.width || 1200,
		height: bounds?.height || 800,
		x: bounds?.x,
		y: bounds?.y,
		minWidth: 602,
		minHeight: 300,
		frame: isMac,
		titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
		trafficLightPosition: isMac ? { x: 12, y: 15 } : undefined,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			icon: path.join(__dirname, 'pages/profilePages/images/Copilot_20251122_223052.png'),
			contextIsolation: true,
			nodeIntegration: false,
			webviewTag: true,
			partition: `persist:${profile}`,
			experimentalFeatures: true,
			enableBlinkFeatures: 'WebAuthn SmoothScrolling',
			nativeWindowOpen: true,
			scrollBounce: true, // macOS-like bounce
		}
	});

	setupContextMenu(win);

	win.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith('http:') || url.startsWith('https:')) {
			win.webContents.send('new-tab', url); // string only
		} else if (url.startsWith('mailto:') || url.startsWith('tel:')) {
			shell.openExternal(url);
		}
		return { action: 'deny' };
	});

	win.loadFile('index.html');
	windows.push(win);


	win.on('focus', async () => {
		sendToWindow(win, 'focus-change', { focus: true });
		// Ensure this window's menu is displayed since it's now focused
		await updateApplicationMenu(win);
	});

	win.on('blur', () => {
		sendToWindow(win, 'focus-change', { focus: false });
	});

	win.on('closed', () => {
		windows = windows.filter(w => w !== win);
	});

	win.webContents.on('did-finish-load', () => {
		win.webContents.send('switch-profile', profile);
	});

	if (win && !win.isDestroyed()) {
		win.webContents.send('app-version', app.getVersion());
	}

	win.on('enter-full-screen', () => sendFullScreen(win, true));
	win.on('leave-full-screen', () => sendFullScreen(win, false));

	win.on('enter-html-full-screen', () => {
		setTimeout(function () {
			showOverlayNotification('Press <span class="key">ESC</span> to exit full screen.', win, `aspect_ratio`)
		}, 700)
	});

	win.on('leave-html-full-screen', () => {
		win.webContents.send('html-fullscreen', false);
	});

	if (isMac) {
		win.commandLine.appendSwitch("enable-smooth-scrolling");
		win.commandLine.appendSwitch("disable-features", "ScrollPredictor");
	}



	win.profileName = profile;
	currentProfile = profile;
	mainWindow = win;

	await updateApplicationMenu(win);

	return win;
}

ipcMain.on('update-progress', (event, value) => {
	const win = BrowserWindow.fromWebContents(event.sender);

	if (value === null || value === -1) {
		// Remove the progress bar
		win.setProgressBar(-1);
		return;
	}

	// Otherwise update normally
	win.setProgressBar(value / 100);
});


let overlayWin = null;

// Register overlay-resize handler once at module level
ipcMain.on("overlay-resize", (_event, { width, height }) => {
	if (overlayWin && !overlayWin.isDestroyed()) {
		overlayWin.setSize(Math.round(width), Math.round(height));
	}
});

function showOverlayNotification(messageHtml, parentWin, icon, timeout = 5) {
	if (overlayWin) {
		overlayWin.webContents.send("overlay-message", messageHtml, icon, timeout);
		return;
	}

	const [parentX, parentY] = parentWin.getPosition();
	const [parentW] = parentWin.getSize();


	overlayWin = new BrowserWindow({
		width: 400,
		height: 60,
		x: parentX + Math.round(parentW / 2 - 200),
		y: parentY + 40,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		resizable: false,
		movable: false,
		focusable: false,
		skipTaskbar: true,
		parent: parentWin,
		hasShadow: false,
		modal: false,
		show: false,
		fullscreenable: false,
		simpleFullscreen: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true
		}
	});

	overlayWin.loadFile("overlay.html");

	overlayWin.once("ready-to-show", () => {
		overlayWin.webContents.send("overlay-message", messageHtml, icon, timeout);
		overlayWin.showInactive();
	});

	setTimeout(() => {
		if (overlayWin) {
			overlayWin.close();
			overlayWin = null;
		}
	}, timeout * 1000);
}

function deepMerge(target, source) {
	for (const key in source) {
		if (
			source[key] &&
			typeof source[key] === "object" &&
			!Array.isArray(source[key])
		) {
			if (!target[key]) target[key] = {};
			deepMerge(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
	return target;
}

function loadBrowserWindow(
	file,
	width = 500,
	height = 500,
	profile = null,
	showCustomTitle = false,
	customSettings = []
) {
	const display = screen.getPrimaryDisplay().workAreaSize;

	const defaultSettings = {
		width: 200,
		height: 400,
		minWidth: 200,
		minHeight: 400,
		x: Math.floor((display.width - 200) / 2),
		y: Math.floor((display.height - 400) / 2),
		frame: !showCustomTitle,
		titleBarStyle: showCustomTitle ? "hidden" : "hiddenInset",
		trafficLightPosition: { x: 16, y: 20 },
		resizable: false,
		movable: true,
		minimizable: true,
		maximizable: false,
		icon: path.join(
			__dirname,
			"pages/profilePages/images/Copilot_20251122_223052.png"
		),
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			partition: profile ? `persist:${profile}` : undefined,
			webviewTag: true,
			experimentalFeatures: true,
			enableBlinkFeatures: "WebAuthn",
			nativeWindowOpen: true,
			spellcheck: true,
			additionalArguments: showCustomTitle ? ["--showCustomTitle"] : []
		}
	};

	let finalSettings = { ...defaultSettings };
	for (const override of customSettings) {
		finalSettings = deepMerge(finalSettings, override);
	}

	const win = new BrowserWindow(finalSettings);

	// Load file or URL
	if (/^https?:\/\//.test(file)) {
		win.loadURL(file);
	} else if (file.startsWith("file://")) {
		win.loadURL(file);
	} else if (/^\d{1,3}(\.\d{1,3}){3}/.test(file)) {
		win.loadURL("http://" + file);
	} else {
		win.loadFile(file);
	}

	// Events
	win.webContents.on("page-title-updated", (_e, title) => {
		win.webContents.send("update-title", title);
	});

	win.webContents.on("page-favicon-updated", (_e, favicons) => {
		win.webContents.send("update-favicon", favicons[0] || null);
	});

	win.webContents.on("did-navigate", (_e, url) => {
		win.webContents.send("update-url", url);
	});



	windows.push(win);

	setTimeout(() => {
		if (!win.isDestroyed()) {
			win.setSize(width, height);
			win.center();
		}
	}, 100);

	// Context menu
	win.webContents.on("context-menu", (event, params) => {
		const menu = new Menu();

		if (params.isEditable && process.platform === "darwin") {
			menu.append(
				new MenuItem({
					label: "Spelling and Grammar",
					submenu: [
						{ role: "toggleSpelling" },
						{ role: "toggleGrammar" },
						{ role: "toggleContinuousSpellCheck" },
						{ role: "toggleAutocorrect" }
					]
				})
			);

			menu.append(
				new MenuItem({
					label: "Substitutions",
					submenu: [
						{ role: "toggleSmartQuotes" },
						{ role: "toggleSmartDashes" },
						{ role: "toggleTextReplacement" },
						{ role: "toggleSmartLinks" }
					]
				})
			);

			menu.append(
				new MenuItem({
					label: "Transformations",
					submenu: [
						{ role: "transformUppercase" },
						{ role: "transformLowercase" },
						{ role: "transformCapitalize" }
					]
				})
			);

			menu.append(
				new MenuItem({
					label: "Speech",
					submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }]
				})
			);

			menu.append(new MenuItem({ type: "separator" }));
		}

		// Standard edit actions
		[
			{ role: "undo" },
			{ role: "redo" },
			{ type: "separator" },
			{ role: "cut" },
			{ role: "copy" },
			{ role: "paste" },
			{ role: "pasteAndMatchStyle" },
			{ role: "delete" },
			{ type: "separator" },
			{ role: "selectAll" }
		].forEach(item => menu.append(new MenuItem(item)));

		menu.popup({ window: win });
	});

	// App menu
	const menuOptions = [
		{ role: "appMenu" },
		{ role: "fileMenu" },
		{ role: "editMenu" },
		{ role: "viewMenu" },
		{ role: "windowMenu" }
	];

	Menu.setApplicationMenu(Menu.buildFromTemplate(menuOptions));

	win.on('focus', () => {
		Menu.setApplicationMenu(Menu.buildFromTemplate(menuOptions));
	})

	return win;
}

function sendFullScreen(win, fullscreen) {
	win.webContents.send('fullscreen-changed', { fullscreen });
}

function broadcastOpenSidebarApp(payload) {
	for (const id of webviews) {
		const wc = webContents.fromId(id);
		if (wc) wc.send('openSidebarApp', payload);
	}
}

// ---------------- App Lifecycle ----------------
app.whenReady().then(async () => {
	// app.setAsDefaultProtocolClient('http');
	// app.setAsDefaultProtocolClient('https');
	app.setAsDefaultProtocolClient("bluebird");
	const settings = loadSettings();
	currentProfile = settings.lastProfile || 'Default';
	ensureProfile(currentProfile);

	// Open the account manager window first and build menu with that win
	const mgrWin = loadBrowserWindow('pages/profilePages/accountMakeSure.html', 500, 700, undefined);
	const menu = await buildAppMenu(mgrWin);
	Menu.setApplicationMenu(menu);

	const ses = session.defaultSession

	ses.setPermissionRequestHandler((webContents, permission, callback) => {
		if (autoGrant(permission, webContents.getURL())) {
			callback(true)
		} else {
			callback(false)
		}
	})

	const dockMenu = Menu.buildFromTemplate([
		{
			label: 'New Window',
			click: () => { createWindow(currentProfile) }
		},
		{
			label: 'Profile',
			submenu: [
				{ label: 'Profile Manager…', click: () => loadBrowserWindow('pages/profilePages/accountMakeSure.html', 500, 700) }
			]
		}
	])

	app.dock.setMenu(dockMenu)

});

app.on("open-url", (event, url) => {
	event.preventDefault();
	mainWindow.webContents.send("google-auth-callback", url);
});

ipcMain.on("custom-alert", (event, msg) => {
	mainWindow.webContents.send("show-custom-alert", msg);
});

ipcMain.handle("custom-confirm", async (event, msg) => {
	return await mainWindow.webContents.executeJavaScript(`
        customConfirm(${JSON.stringify(msg)})
    `);
});

ipcMain.handle("custom-prompt", async (event, data) => {
	return await mainWindow.webContents.executeJavaScript(`
        customPrompt(${JSON.stringify(data.msg)}, ${JSON.stringify(data.def)})
    `);
});

ipcMain.handle('app:getVersion', () => {
	return app.getVersion();
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		const mgrWin = loadBrowserWindow('pages/profilePages/accountMakeSure.html', 900, 900, undefined);
		buildAppMenu(mgrWin).then(menu => Menu.setApplicationMenu(menu));
	}
});

ipcMain.handle('toggle-fullscreen', () => {
	const isFull = win.isFullScreen();
	win.setFullScreen(!isFull);
});

app.on('window-all-closed', () => {
	if (!isMac) app.quit();
});

ipcMain.on('sidebar:open-app', (event, payload) => {
	console.log(payload)
	broadcastOpenSidebarApp(payload);
});

ipcMain.on('permission-response', (event, { origin, permission, allow }) => {
	console.log(`User decision for ${origin} ${permission}: ${allow}`);
});

ipcMain.handle('site-info:get', async (_event, webviewId) => {
	const wc = webContents.fromId(webviewId);
	if (!wc) return null;

	const url = wc.getURL();

	try {
		// Security info (async)
		const securityInfo = await wc.getSecurityInfo();

		// Certificate (async)
		const cert = await wc.getCertificate();

		// If no certificate (HTTP or local file)
		if (!cert) {
			return {
				url,
				securityInfo,
				certificate: null
			};
		}

		return {
			url,
			securityInfo,
			certificate: {
				subject: cert.subjectName,
				issuer: cert.issuerName,
				validFrom: cert.validStart,
				validTo: cert.validExpiry,
				fingerprint: cert.fingerprint
			}
		};

	} catch (err) {
		return {
			url,
			error: String(err)
		};
	}
});

// ---------------- IPC ----------------
ipcMain.on('quit-app', () => { app.quit(); });

ipcMain.on('openAppPage', (_e, page, width, height, profile, showCustomTitle = false, customSettings = []) => {
	const win = loadBrowserWindow(page, width, height, profile ? profile : 'Default', showCustomTitle, customSettings);
	const menuOptions = [
		{ role: "appMenu" },
		{ role: "fileMenu" },
		{ role: "editMenu" },
		{ role: "viewMenu" },
		{
			role: 'help',
			submenu: [
				{ label: `Browser ver. ${app.getVersion()}`, enabled: false },
				{ type: 'separator' },
				{ label: `Built with Electron, which includes Chromium`, enabled: false },
				{
					label: 'Learn More about Electron',
					click: async () => {
						await shell.openExternal('https://electronjs.org');
					}
				},
				{
					label: 'Learn More about The Chromium Project',
					click: async () => {
						await shell.openExternal('https://chromium.org');
					}
				},
				{
					label: 'About this Browser',
					click: () => loadBrowserWindow('', 750, 750, undefined, true, { resizeable: true }, [])
				},
				{ type: 'separator' },
				{ label: `Open Source`, enabled: false },
				{
					label: 'GitHub Project',
					click: async () => {
						await shell.openExternal('https://github.com/coder230-dev/bluebird_browser');
					}
				},
				{ role: 'toggleDevTools' }
			]
		}
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(menuOptions));
});

ipcMain.handle('settings:load', () => loadSettings());

ipcMain.handle('settings:save', (_e, s) => {
	const merged = { ...loadSettings(), ...s };
	saveSettings(merged);
	return merged;
});

ipcMain.handle('app:restart', () => {
	app.relaunch();
	app.exit(0);
});

ipcMain.handle('window:new', async (_e, profile, action) => {
	const name = profile || currentProfile || 'Default';
	let existing = windows.find(w => w.profileName === name && !w.isDestroyed());

	if (action === 'new-window') {
		switchProfile(name);
		const win = await createWindow(name);
		return win.id;
	}

	if (existing) {
		existing.focus();
		currentProfile = name;
		await updateApplicationMenu(existing);
		return existing.id;
	}

	switchProfile(name);
	const win = await createWindow(name);
	return win.id;
});

ipcMain.handle('profiles:list', async () => {
	const profiles = await listProfiles();
	return profiles;
});

ipcMain.handle('profiles:create', (_e, profile) => {
	const profiles = loadProfilesJSON();
	const newProfile = {
		name: String(profile?.name || `Profile-${Date.now()}`),
		avatar: profile?.avatar ?? null,
		createdAt: Date.now(),
		updatedAt: Date.now()
	};
	profiles.push(newProfile);
	try {
		fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
	} catch (err) {
		console.warn('Failed to write profiles.json:', err.message);
	}
	return newProfile;
});

ipcMain.handle('profiles:delete', (_e, name) => {
	if (!name) return false;

	const profiles = loadProfilesJSON();
	const updated = profiles.filter(p => p.name !== name);

	try {
		fs.writeFileSync(profilesPath, JSON.stringify(updated, null, 2));
	} catch (err) {
		console.warn('Failed to write profiles.json:', err.message);
		return false;
	}

	if (currentProfile === name) {
		switchProfile('Default');
	}

	return true;
});

// ============= PASSWORD IPC =============
ipcMain.handle('passwords:list', async () => {
	if (!(await promptBiometric())) return [];
	const passwords = loadPasswords();
	return passwords.filter(p => p.profile === currentProfile);
});

ipcMain.handle('passwords:save', async (_e, { url, username, password }) => {
	if (!(await promptBiometric())) return false;
	const passwords = loadPasswords();
	const existing = passwords.find(p => p.url === url && p.username === username && p.profile === currentProfile);
	if (existing) {
		existing.password = password;
		existing.updatedAt = Date.now();
	} else {
		passwords.push({
			id: crypto.randomUUID(),
			url,
			username,
			password,
			profile: currentProfile,
			createdAt: Date.now(),
			updatedAt: Date.now()
		});
	}
	savePasswords(passwords);
	return true;
});

ipcMain.handle('passwords:delete', async (_e, id) => {
	if (!(await promptBiometric())) return false;
	const passwords = loadPasswords();
	const filtered = passwords.filter(p => p.id !== id);
	savePasswords(filtered);
	return true;
});

ipcMain.handle('passwords:get', async (_e, url) => {
	if (!(await promptBiometric())) return null;
	const passwords = loadPasswords();
	return passwords.find(p => p.url === url && p.profile === currentProfile) || null;
});

ipcMain.on('resize-window', (_event, { width, height }) => {
	const win = BrowserWindow.getFocusedWindow();
	if (win && !win.isDestroyed()) {
		win.setSize(Math.max(200, width), Math.max(200, height));
	}
});

ipcMain.handle('restore-window-bounds', () => {
	return loadWindowBounds();
});

ipcMain.on('save-window-bounds', () => {
	const win = BrowserWindow.getFocusedWindow();
	if (!win || win.isDestroyed()) return;
	const bounds = win.getBounds();
	try {
		fs.writeFileSync(boundsPath, JSON.stringify(bounds, null, 2));
	} catch (err) {
		console.warn('Failed to save window bounds:', err.message);
	}
});

ipcMain.on('update-tabs-menu', (_e, tabs) => {
	openTabs = tabs;
	buildAppMenu(win);
});

ipcMain.on('register-webview', (_event, id) => {
	const wc = webContents.fromId(id);
	if (!wc) return;

	wc.on('zoom-changed', async () => {
		const factor = await wc.getZoomFactor();
		const parentWin = BrowserWindow.fromWebContents(wc);
		parentWin.webContents.send('zoom-updated', { id: wc.id, factor });
	});

	wc.on('context-menu', (_event, params) => {
		const menu = buildContextMenu(params, wc);
		const parentWin = BrowserWindow.fromWebContents(wc);
		if (parentWin && !parentWin.isDestroyed()) {
			menu.popup({ window: parentWin });
		}
	});

	wc.setWindowOpenHandler(({ url }) => {
		const parentWin = BrowserWindow.fromWebContents(wc);
		if (parentWin && !parentWin.isDestroyed()) {
			parentWin.webContents.send('new-tab', url); // string only
		}
		return { action: 'deny' };
	});
});

// Detach tab into a new window
ipcMain.on('new-window-with-tab', (_e, tab) => {
	const win = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			partition: `persist:${tab.profile}`,
		}
	});
	win.loadFile('index.html');
	win.webContents.once('did-finish-load', () => {
		win.webContents.send('new-tab', tab.url);
	});
});

// autoUpdater.checkForUpdates();

// autoUpdater.on("update-available", () => {
// 	if (mainWindow && !mainWindow.isDestroyed()) {
// 		mainWindow.webContents.send("update-available");
// 	}
// });

// autoUpdater.on("update-downloaded", () => {
// 	if (mainWindow && !mainWindow.isDestroyed()) {
// 		mainWindow.webContents.send("update-downloaded");
// 	}
// });

// ipcMain.on("install-update", () => {
// 	autoUpdater.quitAndInstall();
// });