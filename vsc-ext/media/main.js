const PENDING_WATER_ML = 30;
let pendingPrompt = '';
const MEME_LINES = [
    "Sir, this is a search engine.",
    "Google: FREE. AI water: not free. 🤔",
    "Have you tried… not doing that?"
];

// Reference DOM elements
const input = document.getElementById('prompt-input');
const btn = document.getElementById('submit-btn');
const log = document.getElementById('chat-log');
const overlay = document.getElementById('gf-overlay');
const card = document.getElementById('gf-card');

function addChatItem(text, isUser) {
    const div = document.createElement('div');
    div.className = `chat-bubble ${isUser ? 'user' : 'ai'}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

btn.addEventListener('click', () => {
    const val = input.value.trim();
    if (!val) return;
    
    // Check intent (Mock NLP for simple vs complex query)
    const isSimple = isSimpleSearchQuery(val);
    
    if (isSimple) {
        pendingPrompt = val;
        showOverlay();
    } else {
        // Just bypass and send
        input.value = '';
        addChatItem(val, true);
        setTimeout(() => addChatItem("I am a fake AI answering your complex request.", false), 600);
    }
});

function isSimpleSearchQuery(query) {
    const q = query.toLowerCase();
    const simpleStarters = ['what', 'who', 'where', 'when', 'how many', 'capital of', 'weather'];
    return simpleStarters.some(s => q.startsWith(s)) || q.split(' ').length <= 6;
}

function showOverlay() {
    overlay.classList.add('gf-visible');
    card.innerHTML = `
        <div id="gf-header">
            <h3>WAIT. Did you try Google?</h3>
            <p>${MEME_LINES[Math.floor(Math.random()*MEME_LINES.length)]}</p>
        </div>
        <div id="gf-content">
            <p>Your prompt could cost ~<strong>${PENDING_WATER_ML}ml</strong> of water</p>
            <button id="gf-btn-google" class="gf-btn">🔍 Google It First</button>
            <button id="gf-btn-skip" class="gf-btn">💸 Proceed and waste water</button>
        </div>
        <div id="gf-penalty">
            <h4>Welp. You just wasted water.</h4>
            <div id="gf-cup-container">
                <div id="gf-water-fill"></div>
            </div>
            <button id="gf-btn-anyway" class="gf-btn">Proceed anyway</button>
        </div>
    `;

    document.getElementById('gf-btn-google').addEventListener('click', () => {
        // Tell extension we saved water!
        tsvscode.postMessage({ type: 'saveWater', value: PENDING_WATER_ML });
        
        card.innerHTML = `<div id="gf-content"><h3>Good choice! 🌍</h3><p>Fetching DuckDuckGo...</p><div id="ddg-results"></div><button id="gf-btn-close" class="gf-btn">Close</button></div>`;
        
        tsvscode.postMessage({ type: 'fetchSearch', query: pendingPrompt });

        document.getElementById('gf-btn-close').addEventListener('click', () => {
            overlay.classList.remove('gf-visible');
            input.value = '';
        });
    });

    document.getElementById('gf-btn-skip').addEventListener('click', () => {
        document.getElementById('gf-content').style.display = 'none';
        document.getElementById('gf-header').style.display = 'none';
        const pen = document.getElementById('gf-penalty');
        pen.style.display = 'flex';
        
        // Trigger water fill
        setTimeout(() => {
            document.getElementById('gf-water-fill').style.height = '100%';
        }, 100);

        // Tell extension we wasted water
        tsvscode.postMessage({ type: 'wasteWater', value: PENDING_WATER_ML });
    });

    document.getElementById('gf-penalty')?.addEventListener('click', (e) => {
        if(e.target.id === 'gf-btn-anyway') {
            overlay.classList.remove('gf-visible');
            input.value = '';
            addChatItem(pendingPrompt, true);
            setTimeout(() => addChatItem("I generated a thirsty AI response.", false), 600);
        }
    });

}

// Listen for messages from extension (DuckDuckGo results)
window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'searchResult') {
        const resDiv = document.getElementById('ddg-results');
        if (resDiv) {
            resDiv.innerHTML = message.success ? `<p style="font-size:11px; margin-top:10px; max-height:200px; overflow-y:auto; text-align:left; background:var(--vscode-input-background); padding:5px;">` + message.html.substring(0, 500) + `...</p>` : `<p>Error fetching</p>`;
        }
    }
});
