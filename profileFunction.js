let db

function openDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('BrowserProfilesDB', 5);

		request.onupgradeneeded = (event) => {
			db = event.target.result;

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
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function addProfile(profile) {
	const db = await openDB();
	const tx = db.transaction('profiles', 'readwrite');
	tx.objectStore('profiles').put({
		...profile,
		createdAt: Date.now(),
		updatedAt: Date.now()
	});
	return tx.complete;
}

async function deleteProfile(name) {
	const db = await openDB();
	const tx = db.transaction('profiles', 'readwrite');
	tx.objectStore('profiles').delete(name);
	return tx.complete;
}

async function editProfile(name, updates) {
	const db = await openDB();
	const tx = db.transaction('profiles', 'readwrite');
	const store = tx.objectStore('profiles');
	const existing = await store.get(name);
	if (existing) {
		store.put({ ...existing, ...updates, updatedAt: Date.now() });
	}
	return tx.complete;
}

async function listProfiles() {
	const db = await openDB();
	const tx = db.transaction('profiles', 'readonly');
	return tx.objectStore('profiles').getAll();
}

async function updateSetting(key, value) {
	const db = await openDB();
	const tx = db.transaction('settings', 'readwrite');
	tx.objectStore('settings').put({ key, value });
	return tx.complete;
}

async function loadSetting(key) {
	const db = await openDB();
	const tx = db.transaction('settings', 'readonly');
	return tx.objectStore('settings').get(key);
}

async function loadAllSettings() {
	const db = await openDB();
	const tx = db.transaction('settings', 'readonly');
	return tx.objectStore('settings').getAll();
}

async function addTheme(theme) {
	const db = await openDB();
	const tx = db.transaction('themes', 'readwrite');
	tx.objectStore('themes').put(theme);
	return tx.complete;
}

async function getTheme(name) {
	const db = await openDB();
	const tx = db.transaction('themes', 'readonly');
	return tx.objectStore('themes').get(name);
}

async function listThemes() {
	const db = await openDB();
	const tx = db.transaction('themes', 'readonly');
	return tx.objectStore('themes').getAll();
}