# Just Google It !!

> **Stop wasting AI water! Google it first, you magnificent lazy human.**

<img width="474" height="760" alt="image" src="https://github.com/user-attachments/assets/5e663cf1-25d7-401b-b66a-d5e889481129" />

**Google It First!** is an eco-friendly Chrome Extension (Manifest V3) built to reduce the massive water footprint left by unnecessary Large Language Model (LLM) queries. By tracking your prompts and pushing you to use a traditional search engine when appropriate, this extension helps save the planet—one search at a time. Designed for Earth Day 2026.

---

##  The Problem: AI is Thirsty

Every time you prompt an AI like ChatGPT or Gemini, data centers spin up servers that require significant cooling. Researchers estimate that a short conversation (20-50 queries) with an LLM can consume up to **500ml of water**. Many common questions you ask an AI could easily be answered by a simple, computationally cheaper Google search.

![2026-04-10 09-49-19](https://github.com/user-attachments/assets/f21ccd7d-ca47-4f0c-9014-ded75b8f533d)


##  Features

- **Local Intent Classification:** Uses a lightweight Transformers.js model entirely locally (inside an Offscreen Document) to classify if your prompt is better suited for a search engine or actually needs an LLM. Zero extra API calls!
- **Prompt Interception:** Pauses your prompt on major AI chat platforms with a beautiful, space/water-themed overlay.
- **Inline Search Results:** Fetches and displays search results right in the overlay, saving you time and saving the planet water!
- **Water Tracking Dashboard:** The extension popup tracks how many milliliters (ml) of cooling water you've saved vs. wasted. 
- **The "Penalty" Screen:** Features a fun guilt-trip animation filling up a virtual cup of water if you aggressively choose to bypass the search and "waste water".

## Supported AI Platforms

The extension actively monitors the following platforms:
- **ChatGPT** (chatgpt.com / chat.openai.com)
- **Gemini** (gemini.google.com)
- **Claude** (claude.ai)
- **Perplexity** (perplexity.ai)
- **Microsoft Copilot** (copilot.microsoft.com)
- **Mistral** (chat.mistral.ai)
- **Meta AI** (meta.ai)

*(Individual sites can be disabled from the extension popup).*

## Technical Architecture

- **Manifest V3 Core**: Follows modern security and performance standards.
- **Offscreen API**: Bypasses Service Worker restrictions to run a localized WebAssembly-based NLP model (`Transformers.js`) for intent classification without interrupting the user's browsing experience.
- **Content Scripts**: Injects custom dynamic interfaces over the chat apps, intercepting UI submit patterns (`content.js`, `content.css`). 
- **DuckDuckGo Bridging**: The background worker securely retrieves DuckDuckGo HTML results natively to provide inline answers.

## Installation (Developer Mode)

1. Clone or download this repository constraint to your local machine.
2. Open Chrome/Edge / Brave and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `web-ext/` directory.
5. Open any supported AI platform (e.g., ChatGPT) and try asking a basic search question like *"What time is it in Tokyo?"* to see it in action!

---

## Contact and Credits

Developed by **Mokhtar Ouardi**, **Adam Aburaya** and **Anas Aburaya** for the EarthDay Hackathon.

- **Mokhtar Ouardi**: [GitHub](https://github.com/MokhtarOuardi) | [Email](mailto:m.ouardi@graduate.utm.my)
- **Anas Aburaya**: [GitHub](https://github.com/Shadowpasha) | [Email](mailto:ameranas1923@gmail.com)
- **Adam Aburaya**: [GitHub](https://github.com/adam) | [Email](mailto:@gmail.com)

---
© 2026 InfiniTea Team. All rights reserved.
