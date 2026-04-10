import { pipeline } from '@huggingface/transformers';

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
    }

    async init() {
        console.log(`Loading model: ${this.modelName}...`);
        this.extractor = await pipeline('feature-extraction', this.modelName);
        
        console.log("Pre-computing anchor embeddings...");
        this.promptEmbeddings = await this.getEmbeddings(this.promptAnchors);
        this.searchEmbeddings = await this.getEmbeddings(this.searchAnchors);
        console.log("Initialization complete.");
    }

    async getEmbeddings(texts) {
        // Use mean pooling and normalization for sentence similarity
        const output = await this.extractor(texts, { pooling: 'mean', normalize: true });
        return output.tolist();
    }

    cosineSimilarity(vecA, vecB) {
        // Since vectors are normalized, cosine similarity is just the dot product
        let dotProduct = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
        }
        return dotProduct;
    }

    async classify(query) {
        if (!this.extractor) await this.init();

        const queryEmbedding = (await this.getEmbeddings([query]))[0];
        
        // Find max similarity in prompt anchors
        let maxPromptSim = -1;
        for (const emb of this.promptEmbeddings) {
            const sim = this.cosineSimilarity(queryEmbedding, emb);
            if (sim > maxPromptSim) maxPromptSim = sim;
        }

        // Find max similarity in search anchors
        let maxSearchSim = -1;
        for (const emb of this.searchEmbeddings) {
            const sim = this.cosineSimilarity(queryEmbedding, emb);
            if (sim > maxSearchSim) maxSearchSim = sim;
        }

        if (maxPromptSim > maxSearchSim) {
            return { label: "LLM Prompt", score: maxPromptSim };
        } else {
            return { label: "Google Search", score: maxSearchSim };
        }
    }
}

// Simple CLI test if run directly in Node.js
if (import.meta.url === `file://${process.argv[1]}`) {
    const classifier = new IntentClassifier();
    await classifier.init();
    
    const testQueries = [
        "Write a poem about the stars",
        "Who is the CEO of Microsoft?",
        "How to build a PC?",
        "Summarize the news today",
        "What is the population of China?",
        "Write a React component for a button"
    ];

    console.log("\nClassification Results:");
    for (const query of testQueries) {
        const { label, score } = await classifier.classify(query);
        console.log(`Query: '${query}' -> ${label} (Score: ${score.toFixed(4)})`);
    }
}
