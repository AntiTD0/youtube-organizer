let saveButton = null;
let captureButtonEnabled = true;


const INITIAL_INJECTION_DELAY = 500;
const RETRY_INTERVAL = 300;
const MAX_RETRIES = 20;


function injectSaveButton() {
  
  if(saveButton) return;


  


  if (window.ytSaveButtonTimeout) {
    clearTimeout(window.ytSaveButtonTimeout);
    delete window.ytSaveButtonTimeout;
  }

  // Only inject on watch pages
  if (!window.location.href.includes('/watch')) {
    if (saveButton) removeSaveButton();
    return;
  }

  const tryInjection = (attempt = 0) => {
    // Updated selectors for YouTube's 2025 DOM structure
    const titleContainer =
      document.querySelector('ytd-watch-metadata #title h1')?.parentElement ||
      document.querySelector('#above-the-fold #title h1')?.parentElement ||
      document.querySelector('#title h1')?.parentElement ||
      document.querySelector('ytd-watch-metadata #container') ||
      document.querySelector('#below #title')?.parentElement;

    if (!titleContainer) {
      if (attempt < MAX_RETRIES) {
        window.ytSaveButtonTimeout = setTimeout(() => tryInjection(attempt + 1), RETRY_INTERVAL);
      } else {
        console.warn('Could not find title container after max retries');
      }
      return;
    }

    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) {
      console.warn('No video ID found in URL');
      return;
    }

    // Check for existing button
    const existingBtn = titleContainer.querySelector('#yt-save-btn');
    if (existingBtn) {
      saveButton = existingBtn;
      updateButtonState();
      return;
    }

    // Remove any stray buttons
    document.querySelectorAll('#yt-save-btn').forEach(btn => btn.remove());

    // Create new button
    saveButton = document.createElement('button');
    saveButton.id = 'yt-save-btn';
    saveButton.style.cssText = `
      display: block;
      margin-top: 8px;
      padding: 6px 12px;
      background: #e62117;
      color: white;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-family: Roboto, Arial, sans-serif;
      font-size: 14px;
      line-height: 20px;
    `;
    updateButtonState();
    setupButtonLogic();

    // Insert after the title element or append to container
    const titleElement = titleContainer.querySelector('h1');
    if (titleElement) {
      titleElement.insertAdjacentElement('afterend', saveButton);
    } else {
      titleContainer.appendChild(saveButton);
    }
  };


  
  // Start injection with a shorter initial delay
  window.ytSaveButtonTimeout = setTimeout(tryInjection, INITIAL_INJECTION_DELAY);
}


function updateButtonState() {
  const videoId = new URLSearchParams(window.location.search).get('v');
  if (!videoId) return;

  chrome.storage.local.get({ savedVideos: [] }, (data) => {
    const isSaved = data.savedVideos.some(v => v.id === videoId);
    saveButton.textContent = isSaved ? '✓ Saved to list' : '💾 Save Video';
    saveButton.disabled = isSaved;
    saveButton.style.opacity = isSaved ? '0.7' : '1';
    saveButton.style.cursor = isSaved ? 'default' : 'pointer';
  });
}

function setupButtonLogic() {
  saveButton.onclick = () => {
    const videoId = new URLSearchParams(window.location.search).get('v');
    const title = document.querySelector('#title h1')?.textContent.trim() || 'No Title';
    const channel = document.querySelector('#channel-name a')?.textContent.trim() || 'Unknown';

    // Get views
    let views = 0;
    const viewsElement =
      document.querySelector('.view-count') ||
      document.querySelector('yt-formatted-string[aria-label*="views"]');
    if (viewsElement) {
      const viewsText = viewsElement.textContent || viewsElement.getAttribute('aria-label') || '0';
      views = parseInt(viewsText.replace(/\D/g, '')) || 0;
    }

    // Get likes
    let likes = 0;
    const likeSelectors = [
      'div#segmented-like-button yt-formatted-string',
      'button[aria-label*="like this"] yt-formatted-string',
      'yt-formatted-string[aria-label*="likes"]',
      '#like-button yt-formatted-string',
      '#top-level-buttons yt-formatted-string',
      '#menu-container yt-formatted-string',
    ];
    for (const selector of likeSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent || el.getAttribute('aria-label') || '';
        likes = parseInt(text.replace(/[^0-9]/g, '')) || 0;
        if (likes > 0) break;
      }
    }
    if (likes === 0) {
      const likeButton = document.querySelector('button[aria-label*="like this"]');
      if (likeButton) {
        const label = likeButton.getAttribute('aria-label') || '';
        likes = parseInt(label.replace(/[^0-9]/g, '')) || 0;
      }
    }

    chrome.storage.local.get({ savedVideos: [] }, (data) => {
      if (!data.savedVideos.some(v => v.id === videoId)) {
        chrome.storage.local.set({
          savedVideos: [
            ...data.savedVideos,
            {
              id: videoId,
              title,
              channel,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              views,
              likes,
              savedAt: new Date().toLocaleString(),
              notes: [],
            },
          ],
        }, () => {
          updateButtonState(); // Update button immediately after saving
        });
      }
    });
  };
}

chrome.storage.onChanged.addListener(() => {
  if (saveButton && window.location.href.includes('/watch')) {
    updateButtonState();
  }
});

function removeSaveButton() {
  if (saveButton?.parentNode) {
    saveButton.parentNode.removeChild(saveButton);
  }
  saveButton = null;
}

function updateCaptureButtonVisibility() {
  const btn = document.getElementById('yt-frame-capture-btn');
  if (btn) {
    btn.style.display = captureButtonEnabled ? 'block' : 'none';
    console.log('Capture button visibility updated:', captureButtonEnabled);
  }
}

function addScreenshotButton() {
  console.log('Attempting to inject Capture Frame button');
  chrome.storage.sync.get(['buttonEnabled'], (data) => {
    captureButtonEnabled = data.buttonEnabled !== false;
    console.log('Capture button enabled:', captureButtonEnabled);

    if (document.getElementById('yt-frame-capture-btn')) {
      console.log('Capture Frame button already exists, updating visibility');
      updateCaptureButtonVisibility();
      return;
    }

    if (!document.querySelector('video')) {
      console.log('No video element found, skipping Capture Frame button injection');
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'yt-frame-capture-btn';
    btn.innerHTML = '📸 Capture Frame';
    btn.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      z-index: 9999;
      background: #FF0000;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'YouTube Sans', sans-serif;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      display: ${captureButtonEnabled ? 'block' : 'none'};
    `;

    btn.addEventListener('click', captureFrame);
    document.body.appendChild(btn);
    console.log('Capture Frame button injected successfully');
  });
}

function captureFrame() {
  try {
    const video = document.querySelector('video');
    if (!video || video.readyState < 2) {
      alert('Pause the video first for best quality!');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_');
      const filename = `yt_${video.videoWidth}x${video.videoHeight}_${timestamp}.png`;
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 100);
      
      showConfirmation();
    }, 'image/png', 1.0);
  } catch (e) {
    console.error("Capture failed:", e);
    alert('Failed to capture frame. Try pausing the video.');
  }
}

function showConfirmation() {
  const msg = document.createElement('div');
  msg.textContent = '✓ Frame saved!';
  msg.style.cssText = `
    position: fixed;
    bottom: 120px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    z-index: 9999;
    animation: fadeOut 2s ease-in-out forwards;
  `;

  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 2000);
}

const recoveryInterval = setInterval(() => {
  if (
    chrome.runtime?.id &&
    window.location.href.includes('/watch') &&
    !document.querySelector('#yt-save-btn')
  ) {
    injectSaveButton();
  }
}, 1000);



document.addEventListener('yt-navigate-start', () => {
  removeSaveButton(); // Clean up old buttons early
});

document.addEventListener('yt-navigate-finish', () => {
  console.log('YouTube navigation finished');
  setTimeout(() => {
    injectSaveButton();      // Initial attempt

  }, 1000); // Delay ensures DOM is hydrated
});


if (window.location.href.includes('/watch')) {
  injectSaveButton();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleButton') {
    console.log('Received toggleButton message:', request.visible);
    captureButtonEnabled = request.visible;
    chrome.storage.sync.set({ buttonEnabled: request.visible }, () => {
      console.log('Updated buttonEnabled in storage:', request.visible);
      updateCaptureButtonVisibility();

      if (!document.getElementById('yt-frame-capture-btn') && captureButtonEnabled) {
      addScreenshotButton();
      }
    });
  } else if (request.action === 'fetchThumbnails') {
    (async () => {
      try {
        await loadAllVideos();
        await waitForImagesToLoad();
        const thumbnails = extractThumbnails();
        sendResponse(thumbnails);
      } catch (error) {
        console.error('Error fetching thumbnails:', error);
        sendResponse([]);
      }
    })();
    return true;
  }
  return true;
});





function waitForImagesToLoad(timeout = 7000) {
  const images = Array.from(document.images).filter(img =>
    isThumbnailUrl(img.src || img.currentSrc || '')
  );

  return new Promise((resolve) => {
    let remaining = images.length;
    if (remaining === 0) return resolve();

    const done = () => {
      if (--remaining <= 0) resolve();
    };

    const timer = setTimeout(resolve, timeout); // fallback timeout

    images.forEach((img) => {
      if (img.complete && img.naturalWidth >= 120 && img.naturalHeight >= 90) {
        done(); // good thumbnail
      } else {
        img.addEventListener('load', () => {
          if (img.naturalWidth >= 120) done();
        }, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    });
  });
}






const observer = new MutationObserver((mutations) => {
  const relevantMutations = mutations.some(mutation => {
    const addedNodes = Array.from(mutation.addedNodes);
    const affectsTitleArea = addedNodes.some(node =>
      node.nodeType === 1 &&
      (node.matches('ytd-watch-metadata, #above-the-fold, #title, #container') ||
        node.querySelector('ytd-watch-metadata, #above-the-fold, #title, #container'))
    );
    const attributeChanges =
      mutation.type === 'attributes' &&
      mutation.target.matches('ytd-watch-metadata, #above-the-fold, #title, #container');
    return affectsTitleArea || attributeChanges;
  });

  if (relevantMutations && window.location.href.includes('/watch')) {
    injectSaveButton();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'style', 'hidden'],
});

function extractThumbnails() {
  const thumbnails = [];
  const processedUrls = new Set();

 function getImageUrl(img) {
  return img.currentSrc || img.src || img.getAttribute('src') || img.dataset.src || img.dataset.thumb || '';
}

  const selectors = getSelectorsForPage();

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(img => {
      try {
        const rawUrl = getImageUrl(img);

        if (rawUrl && isThumbnailUrl(rawUrl) && !processedUrls.has(rawUrl)) {
          processedUrls.add(rawUrl);

          const title = getVideoTitle(img, selector);
          const thumbnailUrl = getBestQualityUrl(rawUrl);

          if (thumbnailUrl) {
            thumbnails.push({
              url: thumbnailUrl,
              title: title.slice(0, 100).replace(/[^\w\s]/gi, '')
            });
          }
        }
      } catch (e) {
        console.error('Error processing thumbnail:', e);
      }
    });
  });

  return thumbnails;
}

function getSelectorsForPage() {
  if (isPlaylistPage()) {
    return [
      'ytd-playlist-video-renderer #thumbnail img',
      'ytd-playlist-panel-video-renderer #thumbnail img'
    ];
  } else if (isChannelPage()) {
    return [
      'ytd-rich-item-renderer #thumbnail img',
      'ytd-grid-video-renderer #thumbnail img'
    ];
  } else {
    return [
      'ytd-rich-item-renderer #thumbnail img',
      'ytd-grid-video-renderer #thumbnail img',
      'ytd-video-renderer #thumbnail img',
      'ytd-compact-video-renderer #thumbnail img'
    ];
  }
}

function isPlaylistPage() {
  return window.location.href.includes('/playlist') || 
         new URLSearchParams(window.location.search).has('list');
}

function isChannelPage() {
  const path = window.location.pathname;
  return path.includes('/channel/') || 
         path.includes('/c/') || 
         path.includes('/user/') ||
         path.startsWith('/@');
}

function isThumbnailUrl(url) {
  return url.includes('hqdefault') || 
         url.includes('vi_') || 
         url.includes('ytimg.com');
}

function getVideoTitle(img, selector) {
  const container = img.closest(selector.split(' ')[0]);
  if (!container) return 'No title';
  
  const titleElement = container.querySelector('#video-title') ||
                       container.querySelector('.yt-core-attributed-string');
  
  return titleElement?.textContent.trim() || 'No title';
}

function getBestQualityUrl(url) {
  let cleanUrl = url.split('?')[0];
  
  if (cleanUrl.includes('hqdefault')) {
    return cleanUrl.replace('hqdefault', 'maxresdefault');
  }
  if (cleanUrl.includes('mqdefault')) {
    return cleanUrl.replace('mqdefault', 'maxresdefault');
  }
  if (cleanUrl.includes('sddefault')) {
    return cleanUrl.replace('sddefault', 'maxresdefault');
  }
  
  if (cleanUrl.includes('webp')) {
    return cleanUrl.replace('webp', 'jpg');
  }
  
  return cleanUrl;
}

async function loadAllVideos() {
  let lastHeight = 0;
  let currentHeight = document.body.scrollHeight;
  let attempts = 0;

  while (attempts < 50) { // was 20
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(resolve => setTimeout(resolve, 2000)); // was 1500ms

    lastHeight = currentHeight;
    currentHeight = document.body.scrollHeight;

    if (currentHeight === lastHeight) {
      break;
    }

    attempts++;
  }
}


window.addEventListener('unload', () => {
  clearInterval(recoveryInterval);
});


window.addEventListener('unload', () => {
  observer.disconnect();
  if (window.ytSaveButtonTimeout) {
    clearTimeout(window.ytSaveButtonTimeout);
  }
});

document.addEventListener('yt-navigate-finish', () => {
  if (window.location.href.includes('/watch')) {
    injectSaveButton();
  } else {
    removeSaveButton();
  }
});

if (location.href.includes('/watch')) {
  console.log('Initial page load: Injecting buttons');
  injectSaveButton();
  addScreenshotButton();
}








