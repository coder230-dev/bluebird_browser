// Download Manager Script
const downloadList = document.getElementById('download-list');
let downloads = [];

// Function to update download list
function updateDownloadList() {
    downloadList.innerHTML = '';
    downloads.forEach(download => {
        const downloadItem = document.createElement('div');
        downloadItem.className = 'download-item';
        downloadItem.innerHTML = `
            <div class="download-info">
                <h4>${download.filename}</h4>
                <p>${download.url}</p>
                <progress value="${download.receivedBytes}" max="${download.totalBytes}"></progress>
                <p>${(download.receivedBytes / download.totalBytes * 100).toFixed(2)}% - ${download.state}</p>
            </div>
            <div class="download-controls">
                <button class="pause-resume" data-id="${download.id}">⏸️</button>
                <button class="cancel" data-id="${download.id}">❌</button>
                <button class="show-in-folder" data-id="${download.id}">📁</button>
            </div>
        `;
        downloadList.appendChild(downloadItem);
    });

    // Add event listeners
    document.querySelectorAll('.pause-resume').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            togglePauseResume(id);
        });
    });

    document.querySelectorAll('.cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            cancelDownload(id);
        });
    });

    document.querySelectorAll('.show-in-folder').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            showInFolder(id);
        });
    });
}

// Functions to control downloads
function togglePauseResume(id) {
    window.parent.postMessage({ type: 'download-control', action: 'toggle-pause-resume', id }, '*');
}

function cancelDownload(id) {
    window.parent.postMessage({ type: 'download-control', action: 'cancel', id }, '*');
}

function showInFolder(id) {
    window.parent.postMessage({ type: 'download-control', action: 'show-in-folder', id }, '*');
}

// Listen for updates from parent
window.addEventListener('message', (event) => {
    if (event.data.type === 'update-downloads') {
        downloads = event.data.downloads;
        updateDownloadList();
    }
});

// Request initial download list
window.parent.postMessage({ type: 'get-download-list' }, '*');