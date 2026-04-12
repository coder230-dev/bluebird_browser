// preload.js
const { contextBridge, webFrame, webContents, ipcRenderer } = require("electron");

const showCustomTitle = process.argv.includes("--showCustomTitle");
const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";
const isLinux = process.platform === "linux";

if (showCustomTitle) {
	window.addEventListener("DOMContentLoaded", () => {
		// Root bar container
		const bar = document.createElement("div");
		bar.id = "custom-titlebar";

		// Top row: favicon + title on left, menu on right
		const topRow = document.createElement("div");
		topRow.id = "titlebar-top";

		const leftGroup = document.createElement("div");
		leftGroup.id = "titlebar-left-group";

		const faviconImg = document.createElement("img");
		faviconImg.id = "titlebar-favicon";
		faviconImg.width = 16;
		faviconImg.height = 16;

		const titleText = document.createElement("div");
		titleText.id = "titlebar-title";
		titleText.textContent = "";

		leftGroup.appendChild(faviconImg);
		leftGroup.appendChild(titleText);

		const right = document.createElement("div");
		right.id = "titlebar-right";
		right.textContent = "...";

		topRow.appendChild(leftGroup);
		topRow.appendChild(right);

		// Second row: base URL (mac only, but we still create the node)
		const baseURL = document.createElement("div");
		baseURL.id = "titlebar-baseurl";
		baseURL.textContent = "";

		// Assemble bar
		bar.appendChild(topRow);
		bar.appendChild(baseURL);

		// Inject into page
		document.body.prepend(bar);

		// Styles
		const style = document.createElement("style");
		style.textContent = `
      #custom-titlebar {
        height: ${isMac ? "55px" : "32px"};
        width: 100%;
        background: black;
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 0 12px;
        font-family: sans-serif;
        -webkit-user-select: none;
        -webkit-app-region: drag;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 999999;
      }

      /* Top row: favicon + title on left, menu on right */
      #titlebar-top {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        height: ${isMac ? "28px" : "32px"};
        padding-left: ${isMac ? "70px" : "0px"};  /* space for macOS traffic lights */
        padding-right: ${isWin || isLinux ? "60px" : "0px"}; /* space for Win/Linux buttons */
      }

      #titlebar-left-group {
        display: flex;
        align-items: center;
        gap: 8px;
        -webkit-app-region: no-drag;
      }

      #titlebar-favicon {
        width: 16px;
        height: 16px;
      }

      #titlebar-title {
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 400px;
      }

      #titlebar-right {
        font-size: 18px;
        -webkit-app-region: no-drag;
        cursor: pointer;
        padding: 2px 6px;
      }

      #titlebar-right:hover {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }

      /* Base URL row (mac only) */
      #titlebar-baseurl {
        display: ${isMac ? "block" : "none"};
        font-size: 11px;
        opacity: 0.7;
        margin-left: ${isMac ? "70px" : "0px"};
        margin-top: 2px;
        -webkit-app-region: no-drag;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: calc(100% - 82px);
      }

      body {
        padding-top: ${isMac ? "55px" : "32px"} !important;
      }
    `;
		document.head.appendChild(style);

		// Menu click
		right.addEventListener("click", () => {
			ipcRenderer.send("show-titlebar-menu");
		});

		// Title update
		ipcRenderer.on("update-title", (_e, title) => {
			setTimeout(function () {
				titleText.textContent = title || "";
			}, 500)
		});

		// Favicon update
		ipcRenderer.on("update-favicon", (_e, url) => {
			if (url) {
				faviconImg.src = url;
				faviconImg.style.display = "inline-block";
			} else {
				faviconImg.removeAttribute("src");
				faviconImg.style.display = "none";
			}
		});

		// URL update → base hostname
		ipcRenderer.on("update-url", (_e, url) => {
			if (!isMac) return;
			try {
				const u = new URL(url);
				baseURL.textContent = u.hostname;
			} catch {
				baseURL.textContent = "";
			}
		});
	});
}

contextBridge.exposeInMainWorld('electronAPI', {
	updateProgress: (value) => ipcRenderer.send('update-progress', value),
	// --- App version
	onAppVersion: (callback) => {
		const handler = (_event, version) => callback(version);
		ipcRenderer.on('app-version', handler);
		return handler;
	},
	offAppVersion: (handler) => ipcRenderer.removeListener('app-version', handler),

	// --- Fullscreen
	onFullscreenChanged: (callback) => { ipcRenderer.on('fullscreen-changed', (_event, data) => callback(data)); },

	// --- Window bounds
	resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),
	saveWindowBounds: () => ipcRenderer.send('save-window-bounds'),
	restoreWindowBounds: () => ipcRenderer.invoke('restore-window-bounds'),

	// --- Tabs
	onNewTab: (callback) => {
		const handler = (_event, url) => callback(url);
		ipcRenderer.on('new-tab', handler);
		return handler;
	},
	offNewTab: (handler) => ipcRenderer.removeListener('new-tab', handler),

	// --- Context menus
	sendContextMenu: (info) => ipcRenderer.send('webview-context-menu', info),
	registerWebview: (webContentsId) => ipcRenderer.send('register-webview', webContentsId),
	clearBrowsingData: () => ipcRenderer.invoke('clear-browsing-data'),

	// --- Profiles
	onSwitchProfile: (callback) => {
		const handler = (_event, profileName) => callback(profileName);
		ipcRenderer.on('switch-profile', handler);
		return handler;
	},
	offSwitchProfile: (handler) => ipcRenderer.removeListener('switch-profile', handler),

	onContextAction: (callback) => {
		const handler = (_event, payload) => callback(payload);
		ipcRenderer.on('context-action', handler);
		return handler;
	},
	offContextAction: (handler) => ipcRenderer.removeListener('context-action', handler),

	// --- Windows
	newWindow: (profile, action) => ipcRenderer.invoke('window:new', profile, action),
	quitApp: () => ipcRenderer.send('quit-app'),
	openAppPage: (page, width, height, profile, showCustomTitle, customSettings) => ipcRenderer.send('openAppPage', page, width, height, profile, showCustomTitle, customSettings),
	newWindowWithTab: (tab) => ipcRenderer.send('new-window-with-tab', tab),

	// --- Sidebar
	openSidebarApp: (callback) => {
		const handler = (_event, payload) => callback(payload);
		ipcRenderer.on('openSidebarApp', handler);
		return handler;
	},

	offSidebarApp: (handler) => ipcRenderer.removeListener('openSidebarApp', handler),

	onUpdateChecking: (callback) => {
		const handler = () => callback();
		ipcRenderer.on('update-checking', handler);
		return handler;
	},

	onUpdateAvailable: (callback) => {
		const handler = (_event, data) => callback(data);
		ipcRenderer.on('update-available', handler);
		return handler;
	},

	onUpdateNotAvailable: (callback) => {
		const handler = () => callback();
		ipcRenderer.on('update-not-available', handler);
		return handler;
	},

	onUpdateDownloadProgress: (callback) => {
		const handler = (_event, data) => callback(data);
		ipcRenderer.on('update-download-progress', handler);
		return handler;
	},

	onUpdateDownloaded: (callback) => {
		const handler = (_event, data) => callback(data);
		ipcRenderer.on('update-downloaded', handler);
		return handler;
	},

	onUpdateError: (callback) => {
		const handler = (_event, data) => callback(data);
		ipcRenderer.on('update-error', handler);
		return handler;
	},

	installUpdate: () => ipcRenderer.send('install-update'),
	checkForUpdates: () => ipcRenderer.send('check-for-updates'),

	send: (channel, data) => ipcRenderer.send(channel, data),

	updateTabsMenu: (tabs) => ipcRenderer.send('update-tabs-menu', tabs),

	getWebviewCertificate: (id) => ipcRenderer.invoke('site-info:get', id),

	toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

	// Listen for zoom updates from main
	onZoomUpdated(callback) {
		ipcRenderer.on("zoom-updated", (_event, data) => callback(data));
	},

	// Optional: remove listener if needed
	removeZoomUpdated(callback) {
		ipcRenderer.removeListener("zoom-updated", callback);
	},

	customAlert: (msg) => ipcRenderer.send("custom-alert", msg),
	customConfirm: (msg) => ipcRenderer.invoke("custom-confirm", msg),
	customPrompt: (msg, def) => ipcRenderer.invoke("custom-prompt", { msg, def })

});

contextBridge.exposeInMainWorld("windowControl", {
	requestBlockClose: () => ipcRenderer.send("block-close"),
	requestAllowClose: () => ipcRenderer.send("allow-close")
});

contextBridge.exposeInMainWorld("overlayAPI", {
	onMessage: (cb) => ipcRenderer.on("overlay-message", (_e, msg, icon, timeout) => cb(msg, icon, timeout)),
	resize: (width, height) => ipcRenderer.send("overlay-resize", { width, height })
});


contextBridge.exposeInMainWorld('siteInfoAPI', {
	get: (url) => ipcRenderer.invoke('site-info:get', url)
});

contextBridge.exposeInMainWorld('api', {
	settings: {
		load: () => ipcRenderer.invoke('settings:load'),
		save: (s) => ipcRenderer.invoke('settings:save', s)
	},
	window: {
		new: (profile, action) => ipcRenderer.invoke('window:new', profile, action)
	},
	profiles: {
		list: () => ipcRenderer.invoke('profiles:list'),
		create: (profile) => ipcRenderer.invoke('profiles:create', profile),
		delete: (name) => ipcRenderer.invoke('profiles:delete', name)
	},

	restartApp: () => ipcRenderer.invoke('app:restart'),

	getAppVersion: () => ipcRenderer.invoke('app:getVersion')
});

contextBridge.exposeInMainWorld('windowAPI', {
	onFocusChange: (callback) => {
		ipcRenderer.on('focus-change', (_event, focus) => callback(focus));
	}
})

contextBridge.exposeInMainWorld('passkeyAPI', {
	createCredential: async (options) => navigator.credentials.create({ publicKey: options }),
	getCredential: async (options) => navigator.credentials.get({ publicKey: options })
});

contextBridge.exposeInMainWorld('permissionsAPI', {
	onRequest: (callback) => {
		ipcRenderer.on('permission-request', (_event, data) => callback(data));
	},
	respond: (requestId, origin, permission, allow) => {
		ipcRenderer.send('permission-response', { requestId, origin, permission, allow });
	}
});

contextBridge.exposeInMainWorld('settingsAPI', {
	sendUpdate: (message) => ipcRenderer.sendToHost('settings-update', message),
	sendBookmark: (message) => ipcRenderer.sendToHost('add-bookmark', message)
});

contextBridge.exposeInMainWorld("battery", {
	getInfo: async () => {
		const b = await navigator.getBattery();
		return {
			level: b.level * 100,
			charging: b.charging,
			chargingTime: b.chargingTime,
			dischargingTime: b.dischargingTime
		};
	},

	onLevelChange: (callback) => {
		navigator.getBattery().then(battery => {
			callback(battery.level * 100); // initial
			battery.addEventListener("levelchange", () => {
				callback(battery.level * 100);
			});
		});
	},

	onChargingChange: (callback) => {
		navigator.getBattery().then(battery => {
			callback(battery.charging);
			battery.addEventListener("chargingchange", () => {
				callback(battery.charging);
			});
		});
	},

	onChargingTimeChange: (callback) => {
		navigator.getBattery().then(battery => {
			callback(battery.chargingTime);
			battery.addEventListener("chargingtimechange", () => {
				callback(battery.chargingTime);
			});
		});
	},

	onDischargingTimeChange: (callback) => {
		navigator.getBattery().then(battery => {
			callback(battery.dischargingTime);
			battery.addEventListener("dischargingtimechange", () => {
				callback(battery.dischargingTime);
			});
		});
	}
});

contextBridge.exposeInMainWorld('passwordAPI', {
	list: () => ipcRenderer.invoke('passwords:list'),
	save: (data) => ipcRenderer.invoke('passwords:save', data),
	delete: (id) => ipcRenderer.invoke('passwords:delete', id),
	get: (url) => ipcRenderer.invoke('passwords:get', url)
});
