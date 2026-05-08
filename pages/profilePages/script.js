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

	// Load profiles early
	const loadedProfiles = await loadProfiles();
	console.log(loadedProfiles);

	// -------------------------------
	// PROFILE SELECTION PAGE
	// -------------------------------
	if (document.getElementById('makeSurePage')) {

		// Reload when window regains focus
		window.addEventListener('focus', () => location.reload());

		const profiles = await window.api.profiles.list();
		console.log(profiles);

		const container = document.getElementById('profiles');
		const noResults = document.getElementById('noResults');

		if (container && profiles.length > 0) {

			profiles.forEach((profile, index) => {

				// Normalize avatar
				const rawAvatar = (profile.avatar || "").trim();

				// Determine avatar type
				let avatarHTML = "";

				if (rawAvatar) {
					if (rawAvatar.startsWith("data:") || rawAvatar.includes("/")) {
						// Image avatar
						avatarHTML = `
                            <div class="profile-avatar">
                                <img src="${rawAvatar}" alt="${profile.name}">
                            </div>`;
					} else {
						// Monogram avatar
						const letter = rawAvatar[0]?.toUpperCase()
							|| profile.name?.trim()[0]?.toUpperCase()
							|| "?";

						avatarHTML = `
                            <div class="profile-avatar monogram">
                                ${letter}
                            </div>`;
					}
				} else {
					// Default monogram
					const letter = profile.name?.trim()[0]?.toUpperCase() || "?";
					avatarHTML = `
                        <div class="profile-avatar monogram">
                            ${letter}
                        </div>`;
				}

				// Build card
				const card = document.createElement('div');
				card.className = 'profile-card';
				card.dataset.profile = profile.name.toLowerCase();

				card.innerHTML = `
                    ${avatarHTML}
                    <div class="profile-info">
                        <h3 class="profile-name">${profile.name || 'Default'}</h3>
                    </div>
                    <button class="profile-actions-btn" id="profile-menu-${index}">
                        <i class="material-symbols-rounded">more_vert</i>
                    </button>
                `;

				// Click to open profile
				card.addEventListener('click', (e) => {
					if (e.target.closest('.profile-actions-btn')) return;

					const selectedProfile = profile.name || 'Default';

					if (window.electronAPI?.newWindow) {
						window.electronAPI.newWindow(selectedProfile);
					} else {
						console.warn('newWindow API not available');
					}

					window.close();
				});

				// Options menu
				card.querySelector(`#profile-menu-${index}`).addEventListener('click', (e) => {
					e.stopPropagation();

					createContextMenu([
						{
							icon: '✏️',
							name: 'Edit',
							function: () => {
								alert('This feature is not currently available. Expected available date: Next Update');
							}
						},
						{
							icon: '🗑️',
							name: 'Delete',
							function: async () => {
								if (confirm(`Delete "${profile.name}"? All saved data will be removed.`)) {
									await window.api.profiles.delete(profile.name);
									location.reload();
								}
							}
						}
					], card.querySelector(`#profile-menu-${index}`));
				});

				container.appendChild(card);
			});
		}
		return;
	}

	// -------------------------------
	// ADD PROFILE PAGE
	// -------------------------------
	if (document.getElementById('add-profile-page')) {

		const source = document.getElementById("avatar-source");
		const imgCont = document.getElementById("img-pick-cont");
		const monoCont = document.getElementById("monograph-cont");
		const preview = document.getElementById("profile-img-preview");

		function resetDefault() {
			preview.innerHTML = `<i class="material-symbols-rounded">account_circle</i>`;
		}

		// Create profile
		document.getElementById('createAccount').addEventListener('click', async () => {
			const name = document.getElementById("profileName").value.trim();

			if (!name) {
				alert("Profile name is required");
				return;
			}

			if (await profileExists(name)) {
				changePage(1);
				alert('This Profile Exists. Try using a different name.');
				return;
			}

			let avatar = null;

			if (source.value === "image") {
				const imgEl = preview.querySelector("img");
				avatar = imgEl ? imgEl.src : null;
			} else {
				const monoEl = preview.querySelector("div");
				avatar = monoEl ? monoEl.textContent.trim() : null;
			}

			const profile = { name, avatar };

			try {
				changePage(3);
				document.getElementById('openProfileBtn').onclick = () => {
					window.electronAPI.newWindow(profile.name);
					window.close();
				};
				await addProfile(profile);
			} catch (err) {
				console.error("Failed to save profile:", err);
				alert("Error saving profile");
			}
		});

		// Switch avatar source
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

		// Image picker
		document.getElementById("profile-img-picker").addEventListener("change", e => {
			const file = e.target.files[0];
			if (!file) return resetDefault();

			const reader = new FileReader();
			reader.onload = ev => {
				preview.innerHTML = `
                    <img src="${ev.target.result}"
                    style="width:100%;height:100%;object-fit:cover;border-radius:50%">
                `;
			};
			reader.readAsDataURL(file);
		});

		// Monogram picker
		document.getElementById("monograph-picker").addEventListener("input", e => {
			const text = e.target.value.trim();

			if (!text) {
				resetDefault();
				return;
			}

			const letter = text[0].toUpperCase();

			preview.innerHTML = `
                <div style="
                    width:100%;
                    height:100%;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:32px;
                    font-weight:bold;
                    color:white;
                    background:#444;
                    border-radius:50%;
                ">
                    ${letter}
                </div>
            `;
		});

		source.dispatchEvent(new Event("change"));
	}
});


const searchInput = document.getElementById('searchProfiles');
const container = document.getElementById('profiles');
const noResults = document.getElementById('noResults');

if (searchInput && container) {
	searchInput.addEventListener('keyup', () => {
		const query = searchInput.value.trim().toLowerCase();
		const cards = container.querySelectorAll('.profile-card');

		let matchCount = 0;

		cards.forEach(card => {
			const profileName = card.dataset.profile || '';
			const match = profileName.includes(query);

			card.style.display = match ? '' : 'none';
			if (match) matchCount++;
		});

		// Show/hide no results message
		noResults.style.display = matchCount === 0 && query ? 'flex' : 'none';
	});
}

// Context Menu Functionallity 

const activeMenuKeydownHandlers = new Set();

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
					subMenu.style.position = 'absolute';
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
		document.querySelector('.context-item').focus();
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