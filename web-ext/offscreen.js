import { pipeline, env } from './lib/transformers/transformers.min.js';
import { IntentClassifier } from './lib/intent_classifier.mjs';

// Configure transformers.js v2 for local Chrome Extension paths
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = chrome.runtime.getURL('lib/transformers/models/');

// Tell v2 where to find the raw .wasm binaries
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('lib/transformers/');

// Because we are in an Offscreen Document and using v2, 
// multi-threading works perfectly!
env.backends.onnx.wasm.proxy = true;
env.backends.onnx.wasm.numThreads = 4; // Use multiple threads for faster classification

const classifier = new IntentClassifier();

// Disable Browser Cache because it doesn't support the 'chrome-extension' scheme
env.useBrowserCache = false;

// Flag for initialization status
let isReady = false;

// Handle messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'CLASSIFY_INTENT') {
        classifyQuery(message.query, sendResponse);
        return true; // Keep message channel open for async response
    }
});

async function classifyQuery(query, sendResponse) {
    try {
        if (!isReady) {
            console.log("[GF] [Offscreen] Initializing IntentClassifier...");
            await classifier.init();
            isReady = true;
        }

        const result = await classifier.classify(query);
        console.log("[GF] [Offscreen] Query classification:", result);
        sendResponse({ success: true, classification: result });
    } catch (error) {
        console.error("[GF] [Offscreen] Classification error:", error);
        sendResponse({ success: false, error: error.message });
    }
}

console.log("[GF] [Offscreen] Offscreen document ready.");
