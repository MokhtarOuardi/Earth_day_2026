import { pipeline, env } from './transformers/transformers.min.js';

// Configure transformers.js v2 for local Chrome Extension paths
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.localModelPath = chrome.runtime.getURL('lib/transformers/models/');
    env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('lib/transformers/');

    // In an Offscreen Document, proxying and multi-threading work with v2!
    env.backends.onnx.wasm.proxy = true;
    env.backends.onnx.wasm.numThreads = 4;
}

// Disable Browser Cache because it doesn't support the 'chrome-extension' scheme
env.useBrowserCache = false;

/**
 * IntentClassifier uses a small transformer model to classify user queries
 * into "LLM Prompts" or "Google Searches" based on semantic similarity to anchors.
 */
export class IntentClassifier {
    constructor() {
        this.modelName = 'Xenova/all-MiniLM-L6-v2';
        this.extractor = null;
        this.promptAnchors = [
            "Write a Python script to scrape a website",
            "Explain the theory of relativity like I'm five",
            "Summarize the key points of this article",
            "Create a diet plan for a 30-year-old male",
            "Act as a travel agent and plan a trip to Japan",
            "Rewrite this paragraph in a more professional tone",
            "Help me debug this code",
            "Give me 5 creative ideas for a blog post",
            "Draft an email to my boss about a salary raise",
            "Give me a recipe for a vegan lasagna",
            "Write a JavaScript function to sort an array",
            "Create a 30-day fitness challenge",
            "Summarize this PDF document",
            "Correct the grammar in this sentence",
            "Brainstorm names for a tech startup",
            "Write a code snippet for a database connection"
        ];

        this.searchAnchors = [
            "What is the capital of France?",
            "Current weather in New York",
            "Best restaurants in Tokyo",
            "Who won the World Cup in 2022?",
            "Distance from London to Paris",
            "How tall is the Eiffel Tower?",
            "Stock price of Apple",
            "Symptoms of common cold",
            "Current time in Tokyo",
            "Stock price of Tesla",
            "Who is the CEO of Google?",
            "Apple iPhone 15 price",
            "Nearest pharmacy",
            "History of the Roman Empire",
            "How to fix a leaky faucet",
            "Best movies of 2023",
            "Olympic Games 2024 dates",
            "What is the square root of 144?"
        ];

        this.promptEmbeddings = null;
        this.searchEmbeddings = null;
        this.isInitializing = false;
        this.initPromise = null;
    }

    /**
     * Initializes the model and pre-computes anchor embeddings.
     */
    async init() {
        if (this.extractor) return;
        if (this.isInitializing) return this.initPromise;

        this.isInitializing = true;
        this.initPromise = (async () => {
            console.log(`[GF] [IntentClassifier] Initializing model: ${this.modelName}...`);
            console.log(`[GF] [IntentClassifier] Local model path: ${env.localModelPath}`);
            console.log(`[GF] [IntentClassifier] WASM paths: ${env.backends.onnx.wasm.wasmPaths}`);

            try {
                this.extractor = await pipeline('feature-extraction', this.modelName, {
                    quantized: true,
                });

                console.log("[GF] [IntentClassifier] Model loaded. Computing anchor embeddings...");
                this.promptEmbeddings = await this.getEmbeddings(this.promptAnchors);
                this.searchEmbeddings = await this.getEmbeddings(this.searchAnchors);
                console.log("[GF] [IntentClassifier] Initialization complete.");
            } catch (error) {
                console.error("[GF] [IntentClassifier] Initialization failed:", error);
                this.isInitializing = false;
                this.initPromise = null;
                throw error;
            }
        })();

        return this.initPromise;
    }

    async getEmbeddings(texts) {
        if (!this.extractor) {
            console.log("[GF] [IntentClassifier] Extractor not ready, initializing now...");
            await this.init();
        }
        const output = await this.extractor(texts, { pooling: 'mean', normalize: true });
        return output.tolist();
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
        }
        return dotProduct;
    }

    /**
     * Classifies a query as "LLM Prompt" or "Google Search".
     */
    async classify(query) {
        console.log(`[GF] [IntentClassifier] Classifying: "${query.slice(0, 50)}..."`);
        if (!this.extractor) await this.init();

        const queryEmbedding = (await this.getEmbeddings([query]))[0];

        let maxPromptSim = -1;
        for (const emb of this.promptEmbeddings) {
            const sim = this.cosineSimilarity(queryEmbedding, emb);
            if (sim > maxPromptSim) maxPromptSim = sim;
        }

        let maxSearchSim = -1;
        for (const emb of this.searchEmbeddings) {
            const sim = this.cosineSimilarity(queryEmbedding, emb);
            if (sim > maxSearchSim) maxSearchSim = sim;
        }

        // Apply classification threshold
        const finalLabel = (maxPromptSim > maxSearchSim)
            ? "LLM Prompt"
            : "Google Search";

        return {
            label: finalLabel,
            score: Math.max(maxPromptSim, maxSearchSim),
            details: { prompt: maxPromptSim, search: maxSearchSim }
        };
    }
}
