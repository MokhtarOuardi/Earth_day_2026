/**
 * Background script for Google It First! extension (MV3).
 * Offloads intent classification (LLM prompt vs Google Search) 
 * to an Offscreen Document to bypass Service Worker restrictions.
 */

const OFFSCREEN_PATH = 'offscreen.html';

// Helper to ensure the offscreen document is alive
async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);
  
  // Check if it already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Create it
  console.log("[GF] [Background] Creating Offscreen Document for Intent Classifier...");
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['WORKERS'], // 'WORKERS' covers wasm/webworker/ml needs
    justification: 'Running IntentClassifier Transformers.js model locally.'
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle DuckDuckGo search fetching
  if (request.action === 'fetchSearch') {
    fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(request.query)}`)
      .then(response => {
        if (!response.ok) throw new Error('Search failed');
        return response.text();
      })
      .then(html => sendResponse({ success: true, html }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  // Handle Intent Classification bridging
  if (request.action === 'classifyPrompt') {
    console.log(`[GF] [Background] Bridging classification request to Offscreen Doc...`);
    
    (async () => {
      try {
        await setupOffscreenDocument();
        
        // Forward the request to the offscreen document
        const response = await chrome.runtime.sendMessage({
          action: 'CLASSIFY_INTENT',
          query: request.query
        });

        if (response && response.success) {
          console.log("[GF] [Background] Received classification from Offscreen:", response.classification);
          sendResponse({ success: true, ...response.classification });
        } else {
          throw new Error(response?.error || 'Classification failed in Offscreen Doc');
        }
      } catch (error) {
        console.error("[GF] [Background] Bridge failed:", error);
        // Default to Google Search on error for robustness
        sendResponse({ success: false, label: "Google Search", error: error.message });
      }
    })();
    
    return true; // Keep channel open for async response
  }
});

// Warm up the model on background startup
setupOffscreenDocument().then(() => {
  console.log("[GF] [Background] Triggering model warm-up in Offscreen Doc...");
  chrome.runtime.sendMessage({ action: 'CLASSIFY_INTENT', query: 'warm-up' }).catch(() => {
    // Ignore error if offscreen script is not yet listening
  });
});
