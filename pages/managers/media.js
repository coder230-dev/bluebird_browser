// Media Manager Script
const mediaList = document.getElementById('media-list');
let mediaTabs = [];

// Function to update media list
function updateMediaList() {
    mediaList.innerHTML = '';
    mediaTabs.forEach(media => {
        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item';
        mediaItem.innerHTML = `
            <div class="media-info">
                ${media.favicon ? `<img src="${media.favicon}" alt="favicon" class="media-favicon">` : `<i class="material-symbols-rounded media-favicon-icon">play_circle</i>`}
                <div class="media-details">
                    <h4>${media.title}</h4>
                    <p>${media.url}</p>
                </div>
            </div>
            <div class="media-controls">
                <button class="play-pause" data-tab-id="${media.tabId}">▶️</button>
                <input type="range" class="timeline" min="0" max="100" value="0" data-tab-id="${media.tabId}">
                <button class="skip-back" data-tab-id="${media.tabId}">⏪</button>
                <button class="skip-forward" data-tab-id="${media.tabId}">⏩</button>
                <button class="pip" data-tab-id="${media.tabId}">📺</button>
                <button class="go-to-tab" data-tab-id="${media.tabId}">🔗</button>
            </div>
        `;
        mediaList.appendChild(mediaItem);
    });

    // Add event listeners
    document.querySelectorAll('.play-pause').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.tabId;
            togglePlayPause(tabId);
        });
    });

    document.querySelectorAll('.timeline').forEach(input => {
        input.addEventListener('input', (e) => {
            const tabId = e.target.dataset.tabId;
            seekMedia(tabId, e.target.value);
        });
    });

    document.querySelectorAll('.skip-back').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.tabId;
            skipBack(tabId);
        });
    });

    document.querySelectorAll('.skip-forward').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.tabId;
            skipForward(tabId);
        });
    });

    document.querySelectorAll('.pip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.tabId;
            enterPiP(tabId);
        });
    });

    document.querySelectorAll('.go-to-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.tabId;
            goToTab(tabId);
        });
    });
}

// Functions to control media
function togglePlayPause(tabId) {
    // Send message to main process to execute JS in webview
    window.parent.postMessage({ type: 'media-control', action: 'toggle-play-pause', tabId }, '*');
}

function seekMedia(tabId, value) {
    window.parent.postMessage({ type: 'media-control', action: 'seek', tabId, value }, '*');
}

function skipBack(tabId) {
    window.parent.postMessage({ type: 'media-control', action: 'skip-back', tabId }, '*');
}

function skipForward(tabId) {
    window.parent.postMessage({ type: 'media-control', action: 'skip-forward', tabId }, '*');
}

function enterPiP(tabId) {
    window.parent.postMessage({ type: 'media-control', action: 'pip', tabId }, '*');
}

function goToTab(tabId) {
    window.parent.postMessage({ type: 'go-to-tab', tabId }, '*');
}

// Listen for updates from parent
window.addEventListener('message', (event) => {
    if (event.data.type === 'update-media') {
        mediaTabs = event.data.mediaTabs;
        updateMediaList();
    }
});

// Request initial media list
window.parent.postMessage({ type: 'get-media-list' }, '*');