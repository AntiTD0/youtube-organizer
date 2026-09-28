chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadThumbnails") {
    const isMultiple = request.thumbnails.length > 1;
    const folderName = isMultiple ? `yt_thumbnails_${Date.now()}` : '';
    
    let completed = 0;
    const total = request.thumbnails.length;
    
    request.thumbnails.forEach((thumb, i) => {
      const filename = isMultiple 
        ? `${folderName}/${cleanFilename(thumb.title)}_${i}.jpg`
        : `${cleanFilename(thumb.title)}.jpg`;
      
      chrome.downloads.download({
        url: thumb.url,
        filename: filename,
        conflictAction: 'uniquify',
        saveAs: false
      }, (downloadId) => {
        completed++;
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError);
        }
        
        chrome.runtime.sendMessage({
          action: "downloadProgress",
          completed,
          total,
          current: thumb.title
        });
      });
    });
    
    return true;
  }
});

function cleanFilename(name) {
  return name.replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_');
}


