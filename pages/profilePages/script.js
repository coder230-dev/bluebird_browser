// --- IndexedDB setup ---
let db;
function openDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('BrowserProfilesDB', 5);

		request.onupgradeneeded = (event) => {
			db = event.target.result;

			if (!db.objectStoreNames.contains('profiles')) {
				db.createObjectStore('profiles', { keyPath: 'id' });
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

function promisifyRequest(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
function transactionDone(tx) {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => { resolve(); changePage() }
		tx.onerror = () => reject(tx.error || new Error('Transaction error'));
		tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
	});
}

// --- Profile CRUD ---
async function addProfile(profile) {
	if (!profile?.name) throw new Error("Profile must have a 'name' field");

	const profiles = await window.api.profiles.list();
	const existingIds = new Set(profiles.map(p => p.id));
	let id;
	do {
		id = crypto.randomUUID();
	} while (existingIds.has(id));

	const db = await openDB();
	const tx = db.transaction('profiles', 'readwrite');
	const store = tx.objectStore('profiles');
	store.put({
		id,
		...profile,
		createdAt: Date.now(),
		updatedAt: Date.now()
	});
	await api.profiles.create(profile);
	await transactionDone(tx);
	return profile.name;
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

async function profileExists(name) {
	const db = await openDB();
	const tx = db.transaction('profiles', 'readonly');
	const store = tx.objectStore('profiles');
	const req = store.get(name); // look up by keyPath 'name'
	const result = await promisifyRequest(req);
	return !!result; // true if found, false if not
}

async function loadProfiles() {
	const db = await openDB();
	const tx = db.transaction('profiles', 'readonly');
	const store = tx.objectStore('profiles');
	const req = store.getAll();
	return promisifyRequest(req).then(res => res || []);
}

// --- Page navigation ---
function changePage(num, useFlex) {
	document.querySelectorAll('.page').forEach((one, index) => {
		one.style.display = 'none';
		if (index === num) one.style.display = useFlex ? 'flex' : 'unset';
	});
}

// --- DOMContentLoaded wiring ---
document.addEventListener('DOMContentLoaded', async function () {
	console.log(await loadProfiles());

	// Profile selection page
	if (document.getElementById('makeSurePage')) {
		window.addEventListener('focus', function() {
			this.location.reload()
			console.log('Focuses')
		})
		const profiles = await window.api.profiles.list();
		console.log(profiles);
		const container = document.getElementById('profiles'); // should be a <div>

		if (container && profiles.length > 0) {
			// use for...of with await
			for (const [index, profile] of profiles.entries()) {
				const btn = document.createElement('button');
				btn.style.textAlign = 'left';
				btn.innerHTML = `
			<div id="main-profile-${index}" style="display: flex; gap: 10px; width: 100%">
			  <span class="profile-img">
				<i class="material-symbols-rounded">account_circle</i>
			  </span>
			  <span class="profile-info">
				<h4 style="padding:0;margin:0;">${profile.name || 'No Username'}</h4>
			  </span>
			</div>
			<button class="profile-more-action" id="profile-more-action-${index}">
			  <i class="material-symbols-rounded">settings</i>
			</button>
		  `;
				btn.classList.add('wide-btn', 'profile-from-choice');

				btn.querySelector(`#main-profile-${index}`).onclick = () => {
					const selectedProfile = profile.name || 'Default';
					if (window.electronAPI?.newWindow) {
						window.electronAPI.newWindow(selectedProfile);
					} else {
						console.warn('newWindow API not available');
					}
					window.close();
				};

				container.appendChild(btn);

				btn.querySelector(`#profile-more-action-${index}`).onclick = () => {
					createContextMenu([
						{
							icon: '✍️',
							name: 'Edit',
							function: () => {
								alert('This feature is not currently available. Expected available date: Next Update');
							}
						},
						{
							icon: '🗑️',
							name: 'Delete',
							function: async () => {
								if (confirm(`All saved data will be deleted from ${profile.name}. If there is open windows with this profile, it will remain opened. Do you wish to continue?`)) {
									await window.api.profiles.delete(profile.name);
									location.reload()
								}
							},
						}
					], btn.querySelector(`#profile-more-action-${index}`))
				};
			}
		}
	}

	// Add profile page
	else if (document.getElementById('add-profile-page')) {
		const source = document.getElementById("avatar-source");
		const imgCont = document.getElementById("img-pick-cont");
		const monoCont = document.getElementById("monograph-cont");
		const preview = document.getElementById("profile-img-preview");

		function resetDefault() {
			preview.innerHTML = `<i class="material-symbols-rounded">account_circle</i>`;
		}

		document.getElementById('createAccount').addEventListener('click', async () => {
			const name = document.getElementById("profileName").value.trim();
			if (!name) {
				alert("Profile name is required");
				return;
			}

			if (await profileExists(name)) {
				changePage(1);
				alert('This Profile Exists. Try using a different name.');
			}

			let avatar = null;
			if (source.value === "image") {
				const imgEl = preview.querySelector("img");
				avatar = imgEl ? imgEl.src : null;
			} else {
				const monoEl = preview.querySelector("div");
				avatar = monoEl ? monoEl.textContent : null;
			}

			const profile = { name, avatar };
			try {
				changePage(3);
				document.getElementById('openProfileBtn').onclick = () => { window.electronAPI.newWindow(profile.name); window.close() }
				await addProfile(profile);
			} catch (err) {
				console.error("Failed to save profile:", err);
				alert("Error saving profile");
			}
		});

		source.addEventListener("change", () => {
			imgCont.style.display = "none";
			monoCont.style.display = "none";

			if (source.value === "image") {
				imgCont.style.display = "block";
			} else {
				monoCont.style.display = "block";
			}
			resetDefault();
		});

		document.getElementById("profile-img-picker").addEventListener("change", e => {
			const file = e.target.files[0];
			if (!file) return resetDefault();
			const reader = new FileReader();
			reader.onload = ev => {
				preview.innerHTML = `<img src="${ev.target.result}" 
			style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
			};
			reader.readAsDataURL(file);
		});

		document.getElementById("monograph-picker").addEventListener("input", e => {
			const text = e.target.value.trim();
			preview.innerHTML = text
				? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
			   font-size:32px;font-weight:bold;color:white;background:#444;border-radius:50%">
			   ${text[0].toUpperCase()}
			 </div>`
				: `<i class="material-symbols-rounded">account_circle</i>`;
		});

		source.dispatchEvent(new Event("change"));
	}
});

const searchInput = document.getElementById('searchProfiles');
const container = document.getElementById('profiles');

if (searchInput && container) {

	// No results element
	const noResults = document.createElement('div');
	noResults.classList.add('no-results');
	noResults.innerHTML = `
        <h1 style="font-size: 6rem"><i class="fa-solid fa-triangle-exclamation"></i></h1>
        <p>No Results Found</p>
    `;

	searchInput.addEventListener('keyup', () => {
		const query = searchInput.value.trim().toLowerCase();

		// Re-query in case items change dynamically
		const items = container.querySelectorAll('.profile-from-choice');

		let matchCount = 0;

		items.forEach(item => {
			const text = item.textContent.toLowerCase();
			const match = text.includes(query);

			item.style.display = match ? '' : 'none';
			if (match) matchCount++;
		});

		// No results handling
		if (matchCount === 0) {
			if (!container.contains(noResults)) {
				container.appendChild(noResults);
			}
		} else {
			noResults.remove();
		}
	});
}

// Context Menu Functionallity 

const activeMenuKeydownHandlers = new Set();

function createContextMenu(items = [], elementClicked = null, x = 0, y = 0, passThru = {}) {
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
		Object.assign(contextMenu.style, {
			position: 'absolute',
			background: '#2a2b2f',
			border: '1px solid #444',
			borderRadius: '6px',
			padding: '4px 0',
			boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
			zIndex: '9999'
		});
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
			list.forEach(({ icon, name, shortcut, category, submenu, function: callback }) => {
				if (category && category !== currentCategory) {
					currentCategory = category;
					const catDiv = document.createElement('div');
					catDiv.classList.add('context-menu-category');
					Object.assign(catDiv.style, {
						borderTop: '1px solid #555',
						padding: '4px 8px',
						fontSize: '12px',
						fontWeight: 'bold',
						color: '#aaa'
					});
					catDiv.textContent = category;
					parent.appendChild(catDiv);
				}

				const item = document.createElement('div');
				item.classList.add('context-menu-item');
				Object.assign(item.style, {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					padding: '6px 12px',
					cursor: 'pointer',
					position: 'relative'
				});

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
					Object.assign(subMenu.style, {
						position: 'absolute',
						top: '0',
						left: '100%',
						minWidth: '180px',
						background: '#2a2b2f',
						border: '1px solid #444',
						borderRadius: '6px',
						padding: '4px 0',
						opacity: '0',
						zIndex: '1000',
						transition: 'opacity 0.15s ease',
						boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
						pointerEvents: 'none'
					});

					buildItems(submenu, subMenu);
					item.appendChild(subMenu);

					item.addEventListener('mouseenter', () => {
						subMenu.style.opacity = '1';
						subMenu.style.pointerEvents = 'auto';

						if (!subMenu.dataset.positioned) {
							const rect = subMenu.getBoundingClientRect();
							const overflowRight = rect.right > window.innerWidth;
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
								callback(passThru);
								removeContextMenus();
							}
						};
						window.addEventListener('keydown', handler);
						activeMenuKeydownHandlers.add(handler);
					}

					item.addEventListener('click', (e) => {
						e.stopPropagation();
						callback(passThru);
						removeContextMenus();
					});
				}

				item.addEventListener('mouseenter', () => item.style.background = '#3a3f45');
				item.addEventListener('mouseleave', () => item.style.background = 'transparent');

				parent.appendChild(item);
			});
		};

		buildItems(items, contextMenu);

		return contextMenu;
	}, 50);
}

function removeContextMenus() {
	document.querySelectorAll('.context-menu').forEach(menu => menu.remove());

	const backdrop = document.querySelector('.context-menu-backdrop');
	if (backdrop) backdrop.remove();

	document.removeEventListener('click', removeContextMenus);

	for (const fn of activeMenuKeydownHandlers) {
		window.removeEventListener('keydown', fn);
	}
	activeMenuKeydownHandlers.clear();
}