import sys
from sentence_transformers import SentenceTransformer, util
import torch

class IntentClassifier:
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        """Initializes the classifier with a sentence transformer model."""
        print(f"Loading model: {model_name}...")
        self.model = SentenceTransformer(model_name)
        
        # Define anchor sentences for each category
        self.prompt_anchors = [
            "Write a Python script to scrape a website",
            "Explain the theory of relativity like I'm five",
            "Summarize the key points of this article",
            "Create a diet plan for a 30-year-old male",
            "Act as a travel agent and plan a trip to Japan",
            "Rewrite this paragraph in a more professional tone",
            "Help me debug this code: print('hello')",
            "Give me 5 creative ideas for a blog post",
            "Draft an email to my boss about a salary raise",
            "Give me a recipe for a vegan lasagna using only 5 ingredients",
            "Write a JavaScript function to sort an array of objects",
            "Create a 30-day fitness challenge for beginners",
            "Summarize this PDF document",
            "Correct the grammar in this sentence: 'He don't like apples'",
            "Brainstorm 10 names for a new tech startup",
            "Write a code snippet to connect to a PostgreSQL database"
        ]
        
        self.search_anchors = [
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
        ]
        
        # Pre-compute embeddings for anchors
        self.prompt_embeddings = self.model.encode(self.prompt_anchors, convert_to_tensor=True)
        self.search_embeddings = self.model.encode(self.search_anchors, convert_to_tensor=True)

    def classify(self, query):
        """Classifies a query as 'LLM Prompt' or 'Google Search'."""
        query_embedding = self.model.encode(query, convert_to_tensor=True)
        
        # Calculate cosine similarities to all anchors
        prompt_sims = util.cos_sim(query_embedding, self.prompt_embeddings)
        search_sims = util.cos_sim(query_embedding, self.search_embeddings)
        
        # Take the maximum similarity score for each category
        max_prompt_sim = torch.max(prompt_sims).item()
        max_search_sim = torch.max(search_sims).item()
        
        # Heuristic: If it's more similar to prompts, classify as LLM
        if max_prompt_sim > max_search_sim:
            return "LLM Prompt", max_prompt_sim
        else:
            return "Google Search", max_search_sim

def main():
    classifier = IntentClassifier()
    
    test_queries = [
        "Write a poem about the ocean",
        "Who is the president of the US?",
        "How to bake a chocolate cake?",
        "Can you help me write a cover letter?",
        "Latest news on AI",
        "Explain the difference between a list and a tuple in Python",
        "What is 2 + 2?",
        "Tell me a joke"
    ]
    
    print("\nClassification Results:")
    print("-" * 50)
    for query in test_queries:
        label, score = classifier.classify(query)
        print(f"Query: '{query}'")
        print(f"Result: {label} (Score: {score:.4f})")
        print("-" * 50)

if __name__ == "__main__":
    main()
