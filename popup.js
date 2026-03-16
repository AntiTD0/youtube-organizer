let savedContainerVisible = false;
let confirmDeleteEnabled = false;

// Add these proxy URLs
const PROXY_URLS = {
  local: 'http://localhost:8888/.netlify/functions/youtube-proxy',
  production: 'https://ytb-orner.netlify.app/.netlify/functions/youtube-proxy' // You'll update this after Netlify deploy
};

// Helper function to update proxy display
function updateProxyDisplay(devMode) {
  const display = document.getElementById('proxyUrlDisplay');
  if (display) {
    const url = devMode ? PROXY_URLS.local : PROXY_URLS.production;
    display.textContent = `📍 Proxy: ${url}`;
    display.style.color = devMode ? '#e62117' : '#666';
  }
}

// Initialize popup when DOM loads
document.addEventListener('DOMContentLoaded', initializePopup);

function initializePopup() {
  setupEventListeners();
  loadSettings();
  document.getElementById('savedContainer').style.display = 'none';
  loadSavedVideos();
  
  // Add this to load dev mode setting
  chrome.storage.local.get(['devMode'], (result) => {
    const devMode = result.devMode || false;
    const toggle = document.getElementById('devMode');
    if (toggle) {
      toggle.checked = devMode;
      updateProxyDisplay(devMode);
    }
  });
}

function setupEventListeners() {
  // Sort functionality
  document.getElementById('sortBtn').addEventListener('click', handleSort);
  
  // Saved videos toggle
  document.getElementById('toggleSaved').addEventListener('click', toggleSavedContainer);
  
  // Export functionality
  document.getElementById('exportCSV').addEventListener('click', exportToCSV);
  
  // Settings
  document.getElementById('confirmDelete').addEventListener('change', handleConfirmDeleteChange);
  document.getElementById('toggle-button').addEventListener('change', handleCaptureButtonToggle);
  document.getElementById('format').addEventListener('change', handleFormatChange);
  
  // Thumbnail functionality
  document.getElementById('fetch-thumbnails').addEventListener('click', handleFetchThumbnails);
  document.getElementById('clear-url').addEventListener('click', handleClearUrl);
  
  // Search and filter
  document.getElementById('searchInput').addEventListener('input', handleSearchFilter);
  document.getElementById('filterType').addEventListener('change', handleSearchFilter);
  
  // Delegated event listener for video actions
  document.getElementById('savedVideosList').addEventListener('click', handleVideoActions);

  document.getElementById('devMode')?.addEventListener('change', (e) => {
    const devMode = e.target.checked;
    chrome.storage.local.set({ devMode });
    updateProxyDisplay(devMode);
    updateStatus(`Switched to ${devMode ? 'LOCAL' : 'PRODUCTION'} proxy`, 'info');
  });
}

function loadSettings() {
  
  // Load confirm delete setting
  chrome.storage.local.get(['confirmDeleteEnabled'], result => {
    confirmDeleteEnabled = result.confirmDeleteEnabled || false;
    document.getElementById('confirmDelete').checked = confirmDeleteEnabled;
  });
  
  // Load capture button settings
  chrome.storage.sync.get(['buttonEnabled', 'format'], data => {
    document.getElementById('toggle-button').checked = data.buttonEnabled !== false;
    document.getElementById('format').value = data.format || 'png';
  });
  
  // Load last thumbnail URL
  chrome.storage.local.get(['lastThumbnailUrl'], ({ lastThumbnailUrl }) => {
    if (lastThumbnailUrl) {
      document.getElementById('playlist-url').value = lastThumbnailUrl;
    }
  });


chrome.storage.sync.get(['buttonEnabled'], data => {
    const isEnabled = data.buttonEnabled !== false; // Default to true
    document.getElementById('toggle-button').checked = isEnabled;
    // Send initial state to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleButton',
          visible: isEnabled
        }).catch(() => {});
      }
    });
  });


}

function toggleSavedContainer() {
  const container = document.getElementById('savedContainer');
  const button = document.getElementById('toggleSaved');
  
  savedContainerVisible = container.style.display !== 'none';
  savedContainerVisible = !savedContainerVisible;
  
  container.style.display = savedContainerVisible ? 'block' : 'none';
  button.textContent = savedContainerVisible ? '▲ Hide Saved Videos' : '▼ Show Saved Videos';
}

function loadSavedVideos() {
  chrome.storage.local.get({savedVideos: []}, (data) => {
    const hasVideos = data.savedVideos.length > 0;
    
    // Show/hide UI elements based on whether we have videos
    document.getElementById('toggleSaved').style.display = hasVideos ? 'block' : 'none';
    document.getElementById('exportCSV').style.display = hasVideos ? 'block' : 'none';
    document.getElementById('emptyState').style.display = hasVideos ? 'none' : 'block';
    
    if (hasVideos) {
      renderSavedVideos(data.savedVideos);
    } else {
      // Reset container visibility if no videos
      savedContainerVisible = false;
      document.getElementById('savedContainer').style.display = 'none';
      document.getElementById('toggleSaved').textContent = '▼ Show Saved Videos';
    }
  });
}

chrome.storage.local.get('savedVideos', (data) => {
  console.log('Saved videos:', data.savedVideos);
});



function renderSavedVideos(videos) {
  const list = document.getElementById('savedVideosList');
  list.innerHTML = videos.map(video => `
    <div class="saved-video">
      <div class="video-title">${escapeHtml(video.title)}</div>
      <div class="video-channel">${escapeHtml(video.channel)}</div>
      <div class="video-stats">
        <span>${video.views?.toLocaleString() || 0} views</span>
        <span>${video.likes?.toLocaleString() || 0} likes</span>
      </div>
      <a href="${video.url}" class="video-url-btn" target="_blank" title="${video.url}">Open Video</a>
      <button data-id="${video.id}" class="delete-btn">Delete</button>
      
      <div class="notes-container">
        <div class="notes-list" data-id="${video.id}">
          ${(video.notes || []).map(note => `
            <div class="note">
              <span class="note-text">${escapeHtml(note.text)}</span>
              <button class="delete-note-btn" data-video-id="${video.id}" data-note-id="${note.id}">×</button>
            </div>
          `).join('')}
        </div>
        <div class="add-note">
          <input type="text" class="note-text-input" placeholder="Add your note..." data-id="${video.id}">
          <button class="add-note-btn" data-id="${video.id}">Add Note</button>
        </div>
      </div>
    </div>
  `).join('');
}

function handleVideoActions(e) {
  // Only prevent default for buttons, not <a> tags
  if (e.target.tagName !== 'A') {
    e.preventDefault();
    e.stopPropagation();
  }
  
  if (e.target.classList.contains('delete-btn')) {
    deleteVideo(e.target.getAttribute('data-id'));
  } else if (e.target.classList.contains('add-note-btn')) {
    addNote(e.target.getAttribute('data-id'));
  } else if (e.target.classList.contains('delete-note-btn')) {
    deleteNote(
      e.target.getAttribute('data-video-id'),
      parseInt(e.target.getAttribute('data-note-id'))
    );
  } else if (e.target.classList.contains('video-url-btn')) {
    // Use chrome.tabs.create for <a> tag clicks
    const url = e.target.getAttribute('href');
    if (url) {
      e.preventDefault(); // Prevent default navigation only for clicks
      chrome.tabs.create({ url });
    }
  }
}



function deleteVideo(videoId) {
  const performDelete = () => {
    chrome.storage.local.get({savedVideos: []}, (data) => {
      const updated = data.savedVideos.filter(v => v.id !== videoId);
      chrome.storage.local.set({savedVideos: updated}, () => {
        loadSavedVideos(); // Reload the list
      });
    });
  };

  if (confirmDeleteEnabled) {
    if (confirm('Are you sure you want to delete this video?')) {
      performDelete();
    }
  } else {
    performDelete();
  }
}

function addNote(videoId) {
  const textInput = document.querySelector(`.note-text-input[data-id="${videoId}"]`);
  const text = textInput.value.trim();
  
  if (!text) {
    alert('Please enter note text');
    return;
  }
  
  chrome.storage.local.get({savedVideos: []}, (data) => {
    const updatedVideos = data.savedVideos.map(video => {
      if (video.id === videoId) {
        const notes = video.notes || [];
        return {
          ...video,
          notes: [...notes, {
            id: Date.now(),
            text: text,
            createdAt: new Date().toLocaleString()
          }]
        };
      }
      return video;
    });
    
    chrome.storage.local.set({savedVideos: updatedVideos}, () => {
      textInput.value = '';
      loadSavedVideos(); // Reload to show new note
    });
  });
}

function deleteNote(videoId, noteId) {
  chrome.storage.local.get({savedVideos: []}, (data) => {
    const updatedVideos = data.savedVideos.map(video => {
      if (video.id === videoId) {
        return {
          ...video,
          notes: (video.notes || []).filter(note => note.id !== noteId)
        };
      }
      return video;
    });

    chrome.storage.local.set({savedVideos: updatedVideos}, () => {
      loadSavedVideos(); // Reload to remove deleted note
    });
  });
}

function handleSearchFilter() {
  chrome.storage.local.get({savedVideos: []}, (data) => {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterValue = document.getElementById('filterType').value;
    
    let filteredVideos = data.savedVideos.filter(video => 
      video.title.toLowerCase().includes(searchTerm)
    );
    
    filteredVideos.sort((a, b) => {
      switch (filterValue) {
        case 'title': return a.title.localeCompare(b.title);
        case 'views-desc': return (b.views || 0) - (a.views || 0);
        case 'views': return (a.views || 0) - (b.views || 0);
        case 'likes-desc': return (b.likes || 0) - (a.likes || 0);
        case 'likes': return (a.likes || 0) - (b.likes || 0);
        default: return 0;
      }
    });
    
    renderSavedVideos(filteredVideos);
  });
}

// Settings handlers
function handleConfirmDeleteChange(e) {
  confirmDeleteEnabled = e.target.checked;
  chrome.storage.local.set({ confirmDeleteEnabled });
}


function handleCaptureButtonToggle(e) {
  const isEnabled = e.target.checked;
  chrome.storage.sync.set({ buttonEnabled: isEnabled });
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'toggleButton',
      visible: isEnabled
    }).catch(() => {});
  });
}


function handleFormatChange(e) {
  chrome.storage.sync.set({ format: e.target.value });
}

// Export functionality
function exportToCSV() {
  chrome.storage.local.get({savedVideos: []}, (data) => {
    const headers = ['Title', 'Channel', 'Views', 'Likes', 'URL', 'Saved At'];
    const csvRows = data.savedVideos.map(video => [
      `"${(video.title || '').replace(/"/g, '""')}"`,
      `"${(video.channel || '').replace(/"/g, '""')}"`,
      video.views || 0,
      video.likes || 0,
      video.url || '',
      video.savedAt || ''
    ]);
    
    const csv = [headers, ...csvRows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtube_saved_videos.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function handleSort() {
  const sortBy = document.getElementById('sortType').value;
  
  // Get the current mode from storage
  chrome.storage.local.get(['devMode'], async (result) => {
    const devMode = result.devMode || false;
    const PROXY_URL = devMode ? PROXY_URLS.local : PROXY_URLS.production;
    
    updateStatus(`Sorting playlist... (${devMode ? '🔧 LOCAL' : '🌐 PRODUCTION'})`, 'info');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('youtube.com')) {
        updateStatus('Please navigate to YouTube first', 'error');
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: sortPlaylistInTab,
        args: [sortBy, PROXY_URL] // Pass proxy URL instead of apiKey
      });
      console.log('Sort by:', sortBy);
      updateStatus('✅ Playlist sorted!', 'success');
      
    } catch (error) {
      console.error('Sort error:', error);
      updateStatus('❌ Error: ' + error.message, 'error');
    }
  });
}

// Thumbnail functionality
async function handleFetchThumbnails() {
  const url = document.getElementById('playlist-url').value.trim();
  
  if (url && !isValidYouTubeUrl(url)) {
    updateThumbnailStatus('Invalid YouTube URL', 'error');
    return;
  }
  
  if (url) {
    chrome.storage.local.set({ lastThumbnailUrl: url });
  }
  
  try {
    await fetchThumbnails(url);
  } catch (error) {
    updateThumbnailStatus('Error: ' + error.message, 'error');
  }
}

function handleClearUrl() {
  document.getElementById('playlist-url').value = '';
  document.getElementById('thumbnails-container').innerHTML = '';
  chrome.storage.local.remove('lastThumbnailUrl');
  updateThumbnailStatus('Cleared input and results');
}

async function fetchThumbnails(url) {
  const container = document.getElementById('thumbnails-container');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  container.innerHTML = `
    <div class="loading">
      <p>Loading all videos...</p>
      <p>This will automatically scroll to load all thumbnails.</p>
      <div class="progress-bar"><div class="progress"></div></div>
    </div>
  `;

  try {
if (url && tab.url !== url) {
  await chrome.tabs.update(tab.id, { url });
  await new Promise(resolve => setTimeout(resolve, 4000));
}

await new Promise(resolve => setTimeout(resolve, 1000));

const thumbnails = await chrome.tabs.sendMessage(tab.id, { 
  action: "fetchThumbnails" 
});

    if (thumbnails?.length > 0) {
      renderThumbnails(thumbnails);
      updateThumbnailStatus(`Found ${thumbnails.length} thumbnails`, 'success');
    } else {
      container.innerHTML = '<div class="no-results">No thumbnails found.</div>';
      updateThumbnailStatus('No thumbnails found', 'warning');
    }
  } catch (error) {
    container.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
    updateThumbnailStatus('Error: ' + error.message, 'error');
  }
}

function renderThumbnails(thumbnails) {
  const container = document.getElementById('thumbnails-container');
  container.innerHTML = '';
  
  if (thumbnails.length > 1) {
    const downloadAllBtn = document.createElement('button');
    downloadAllBtn.className = 'download-all-btn';
    downloadAllBtn.textContent = `Download All (${thumbnails.length})`;
    downloadAllBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: "downloadThumbnails",
        thumbnails: thumbnails
      });
    });
    container.appendChild(downloadAllBtn);
  }
  
  thumbnails.forEach((thumb) => {
    const item = document.createElement('div');
    item.className = 'thumbnail-item';
    item.innerHTML = `
      <img src="${thumb.url}" alt="${escapeHtml(thumb.title)}" loading="lazy">
      <div class="thumbnail-title">${escapeHtml(thumb.title)}</div>
      <div class="thumbnail-actions">
        <button class="download-btn">Download</button>
      </div>
    `;
    
    item.querySelector('.download-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: "downloadThumbnails",
        thumbnails: [thumb]
      });
    });
    
    container.appendChild(item);
  });
}

// Utility functions
function updateThumbnailStatus(message, type = 'info') {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type;
}

function isValidYouTubeUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('youtube.com')) return false;
    
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    
    return (
      parsed.searchParams.has('list') ||
      pathParts[0] === 'playlist' ||
      pathParts[0] === 'channel' ||
      pathParts[0] === 'c' ||
      pathParts[0] === 'user' ||
      pathParts[0]?.startsWith('@')
    );
  } catch {
    return false;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Playlist sorting function (injected into page)
async function sortPlaylistInTab(sortBy, apiKey) {
  await new Promise(resolve => setTimeout(resolve, 1500));

  const playlistId = new URLSearchParams(location.search).get('list');
  if (!playlistId) {
    alert('No playlist found in URL.');
    return;
  }

  const items = Array.from(document.querySelectorAll(
    'ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer'
  ));

  const getId = el => {
    const link = el.querySelector('a[href*="v="]');
    if (!link) return null;
    const url = new URL(link.href, location.origin);
    return url.searchParams.get('v');
  };

  const videoElements = items.map(el => ({
    el,
    videoId: getId(el)
  })).filter(v => v.videoId);

  if (videoElements.length === 0) {
    alert('No videos found to sort.');
    return;
  }

  async function fetchVideoDetails(videoIds) {
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  let details = [];
  for (const chunk of chunks) {
    try {
      // Use the proxy URL passed as second argument
      const proxyUrl = arguments[1]; // The second argument to sortPlaylistInTab
      
      const resp = await fetch(
        `${proxyUrl}?videoIds=${chunk.join(',')}`
      );
      const json = await resp.json();
      if (json.items) {
        details = details.concat(json.items);
      }
    } catch (error) {
      console.error('Proxy request failed:', error);
    }
  }
  return details;
}

  const parseDuration = iso => {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const [, h = 0, m = 0, s = 0] = match.map(n => parseInt(n || '0'));
    return h * 3600 + m * 60 + s;
  };

  const details = await fetchVideoDetails(videoElements.map(v => v.videoId));
  const detailMap = Object.fromEntries(details.map(d => [
    d.id,
    {
      title: d.snippet?.title || '',
      duration: parseDuration(d.contentDetails?.duration || ''),
      views: parseInt(d.statistics?.viewCount || '0'),
      published: new Date(d.snippet?.publishedAt || 0).getTime()
    }
  ]));

  const sorted = [...videoElements].sort((a, b) => {
    const aData = detailMap[a.videoId] || {};
    const bData = detailMap[b.videoId] || {};

    switch (sortBy) {
      case 'title': return aData.title.localeCompare(bData.title);
      case 'title-desc': return bData.title.localeCompare(aData.title);
      case 'duration': return aData.duration - bData.duration;
      case 'duration-desc': return bData.duration - aData.duration;
      case 'title-length': return aData.title.length - bData.title.length;
      case 'title-length-desc': return bData.title.length - aData.title.length;
      case 'views': return aData.views - bData.views;
      case 'views-desc': return bData.views - aData.views;
      case 'newest': return bData.published - aData.published;
      case 'oldest': return aData.published - bData.published;
      default: return 0;
    }
  });

  const parent = sorted[0]?.el?.parentElement;
  if (!parent) {
    alert('Unable to locate video container.');
    return;
  }

  // Step 1: Detach the container from DOM so YouTube's observers stop firing
  const grandparent = parent.parentElement;
  const nextSibling = parent.nextSibling;
  grandparent.removeChild(parent);

  // Step 2: Reorder while detached
  sorted.forEach(v => parent.appendChild(v.el));

  // Step 3: Re-attach
  if (nextSibling) {
    grandparent.insertBefore(parent, nextSibling);
  } else {
    grandparent.appendChild(parent);
  }

  // Step 4: Guardian observer — if YouTube reverts the order, re-apply for 5 seconds
  const sortedIds = sorted.map(v => v.videoId);

  const getIds = () => Array.from(parent.querySelectorAll(
    'ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer'
  )).map(el => {
    const link = el.querySelector('a[href*="v="]');
    return link ? new URL(link.href, location.origin).searchParams.get('v') : null;
  });

  const reapply = () => {
    const elMap = {};
    Array.from(parent.querySelectorAll(
      'ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer'
    )).forEach(el => {
      const link = el.querySelector('a[href*="v="]');
      if (link) {
        const id = new URL(link.href, location.origin).searchParams.get('v');
        elMap[id] = el;
      }
    });
    const gp = parent.parentElement;
    const ns = parent.nextSibling;
    gp.removeChild(parent);
    sortedIds.forEach(id => { if (elMap[id]) parent.appendChild(elMap[id]); });
    if (ns) gp.insertBefore(parent, ns); else gp.appendChild(parent);
  };

  const guardian = new MutationObserver(() => {
    const current = getIds();
    const isReverted = sortedIds.some((id, i) => id !== current[i]);
    if (isReverted) {
      guardian.disconnect();
      reapply();
      guardian.observe(parent, { childList: true });
    }
  });

  guardian.observe(parent, { childList: true });
  setTimeout(() => guardian.disconnect(), 5000);
}

// Listen for storage changes
chrome.storage.onChanged.addListener(loadSavedVideos);

// Listen for download progress
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "downloadProgress") {
    updateStatus(`Downloading ${message.completed}/${message.total}: ${message.current}`);
  }
});