/* global content.js */
(function () {
  'use strict';

  // ============================================================
  //  WATER COST DATA  (ml per ChatGPT query estimate)
  //  Source: researchers at UC Riverside (~500ml per 20-50 queries)
  // ============================================================
  const WATER_ML_PER_QUERY = 30; // ~30ml conservative est per prompt

  const MEME_LINES = [
    "Sir, this is a search engine.",
    "Google: FREE. AI water: not free. 🤔",
    "Have you tried… not doing that?",
    "Your keyboard has a G key. USE IT.",
    "Plot twist: the answer is on page 1 of Google.",
    "The founders of Google weep softly.",
    "Fun fact: typing into Google is also typing.",
    "What if… and hear me out… you just Googled it?",
  ];

  const WATER_COMPARISONS = [
    "enough to water a cactus 🌵",
    "that's half a sip of water 💧",
    "enough to make your plants judgmental 🌿",
    "a goldfish could live for 10 minutes on that 🐟",
    "a hamster's afternoon water ration 🐹",
    "Greta Thunberg shed a single tear 😢",
  ];

  const POSITIVE_MEME_LINES = [
    "Mother Earth thanks you! 🌍",
    "Look at you, saving the planet!",
    "The trees are breathing easier. 🌳",
    "AI is thirsty, but not today! 💧",
    "Smart and sustainable. 👏",
  ];

  const POSITIVE_EMOJIS = ["🌎", "🌱", "💧", "👏", "💚"];

  // ============================================================
  //  PLATFORM SEND-BUTTON SELECTORS
  // ============================================================
  const PLATFORM_CONFIGS = [
    // ChatGPT
    {
      id: 'chatgpt',
      host: /chatgpt\.com|chat\.openai\.com/,
      inputSel: '#prompt-textarea',
      sendSel: 'button#composer-submit-button, button[data-testid="send-button"], button[aria-label*="Send prompt"], button[aria-label*="Send"]',
    },
    // Gemini
    {
      id: 'gemini',
      host: /gemini\.google\.com/,
      inputSel: '.ql-editor', // Usually inside shadow DOM
      sendSel: 'button.send-button, button[aria-label*="Send message"], button[aria-label*="Send"]',
    },
    // Claude
    {
      id: 'claude',
      host: /claude\.ai/,
      inputSel: '[contenteditable="true"][data-placeholder]',
      sendSel: 'button[aria-label*="Send Message"], button[type="submit"]',
    },
    // Perplexity
    {
      id: 'perplexity',
      host: /perplexity\.ai/,
      inputSel: 'textarea[placeholder]',
      sendSel: 'button[aria-label*="submit"], button[type="submit"]',
    },
    // Copilot / Bing
    {
      id: 'copilot',
      host: /copilot\.microsoft\.com/,
      inputSel: 'textarea#searchbox, textarea[aria-label]',
      sendSel: 'button[aria-label*="Submit"], button[type="submit"]',
    },
    // Mistral
    {
      id: 'mistral',
      host: /chat\.mistral\.ai/,
      inputSel: 'textarea',
      sendSel: 'button[type="submit"]',
    },
    // Meta AI
    {
      id: 'meta',
      host: /meta\.ai/,
      inputSel: '[contenteditable="true"]',
      sendSel: 'button[aria-label*="Send"], button[type="submit"]',
    },
  ];

  // ============================================================
  //  STATE
  // ============================================================
  let interceptActive = false;
  let isProceeding = false;
  let autoProceedInterval = null;
  let pendingPrompt = '';
  let pendingSendFn = null;
  let currentPlatform = null;
  const CUP_CAPACITY_ML = 236.588;
  let pushedSavedWaterAmount = 0;

  let isExtensionEnabled = true;
  let disabledSitesList = [];
  let autoProceedTime = 5;
  let currentPenaltyWaterMl = 0;
  let isClassifying = false;

  // Track global states dynamically
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) isExtensionEnabled = changes.enabled.newValue;
      if (changes.disabledSites) disabledSitesList = changes.disabledSites.newValue || [];
      if (changes.autoProceedTime) autoProceedTime = changes.autoProceedTime.newValue;
    });

    // Initial fetch for state
    chrome.storage.local.get(['enabled', 'disabledSites', 'autoProceedTime'], (data) => {
      if (data.enabled !== undefined) isExtensionEnabled = data.enabled;
      if (data.disabledSites) disabledSitesList = data.disabledSites;
      if (data.autoProceedTime !== undefined) autoProceedTime = data.autoProceedTime;
    });
  }

  // ============================================================
  //  CANVAS ENGINE (Replaces PIXI/TweenMax)
  // ============================================================
  let headerCanvasId = null;
  let heroShapes = [];
  let heroColorsIndex = 0;
  let heroRaf = null;

  let cachedColors = null;

  function getDynamicColors(header) {
    if (!cachedColors) {
      const style = getComputedStyle(header);
      const confetti = [
        style.getPropertyValue('--gf-confetti-1').trim() || '#FF4136',
        style.getPropertyValue('--gf-confetti-2').trim() || '#FFDC00',
        style.getPropertyValue('--gf-confetti-3').trim() || '#0074D9',
        style.getPropertyValue('--gf-confetti-4').trim() || '#B10DC9',
        style.getPropertyValue('--gf-confetti-5').trim() || '#39CCCC',
        style.getPropertyValue('--gf-confetti-6').trim() || '#F012BE'
      ];
      cachedColors = { success: confetti }; // Canvas only visible in success mode anyway
    }
    return cachedColors.success;
  }

  class HeroShape {
    constructor(canvas, index) {
      this.canvas = canvas;
      this.index = index;
      this.cIndex1 = 0;
      this.cIndex2 = 1;
      this.reset(true);
    }
    reset(initial = false) {
      this.duration = 2000 + Math.random() * 4000;
      this.startTime = performance.now();
      if (initial) this.startTime -= Math.random() * this.duration;

      // Randomly assign shape colors from confetti pool
      this.cIndex1 = Math.floor(Math.random() * 6);
      this.cIndex2 = Math.floor(Math.random() * 6);

      this.isCircle = this.index % 2 === 0;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const offset = 50;

      if (Math.random() > 0.5) {
        this.startX = Math.random() > 0.5 ? w + offset : -offset;
        this.startY = Math.random() > 0.5 ? h + offset : -offset;
      } else {
        this.startX = Math.random() > 0.5 ? w + offset : -offset;
        this.startY = Math.random() > 0.5 ? h + offset : -offset;
      }
      this.targetX = Math.random() * w;
      this.targetY = Math.random() * h;
      if (Math.random() > 0.5) {
        this.startX = Math.random() * w;
        this.startY = Math.random() > 0.5 ? h + offset * 2 : -offset * 2;
        this.targetX = Math.random() * w;
        this.targetY = this.startY < 0 ? h + offset * 2 : -offset * 2;
      } else {
        this.startX = Math.random() > 0.5 ? w + offset * 2 : -offset * 2;
        this.startY = Math.random() * h;
        this.targetX = this.startX < 0 ? w + offset * 2 : -offset * 2;
        this.targetY = Math.random() * h;
      }

      this.targetRotation = (Math.random() - 0.5) * Math.PI * 4;
      this.targetScale = 0.5 + Math.random() * 0.75;
      this.offsetX1 = Math.random() * offset;
      this.offsetY1 = Math.random() * offset;
      this.offsetX2 = Math.random() * offset;
      this.offsetY2 = Math.random() * offset;
    }
    draw(ctx, time, colors) {
      let elapsed = time - this.startTime;
      if (elapsed > this.duration) {
        this.reset();
        elapsed = 0;
      }
      const t = elapsed / this.duration;
      const x = this.startX + (this.targetX - this.startX) * t;
      const y = this.startY + (this.targetY - this.startY) * t;
      const scale = this.targetScale * t;
      const rotation = this.targetRotation * t;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      ctx.globalCompositeOperation = 'screen';

      const size = this.isCircle ? 30 : 60;
      const col1 = colors[this.cIndex1] || '#FFFFFF';
      const col2 = colors[this.cIndex2] || '#FFFFFF';

      if (this.isCircle) {
        ctx.fillStyle = col1;
        ctx.beginPath();
        ctx.arc(this.offsetX1, this.offsetY1, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col2;
        ctx.beginPath();
        ctx.arc(this.offsetX2, this.offsetY2, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = col1;
        ctx.fillRect(this.offsetX1 - size / 2, this.offsetY1 - size / 2, size, size);
        ctx.fillStyle = col2;
        ctx.fillRect(this.offsetX2 - size / 2, this.offsetY2 - size / 2, size, size);
      }
      ctx.restore();
    }
  }

  function startHeaderAnimation() {
    const header = document.getElementById('gf-header');
    if (!header) return;

    let cvs = document.getElementById('gf-header-canvas');
    if (!cvs) {
      cvs = document.createElement('canvas');
      cvs.id = 'gf-header-canvas';
      cvs.style.position = 'absolute';
      cvs.style.top = '0';
      cvs.style.left = '0';
      cvs.style.width = '100%';
      cvs.style.height = '100%';
      cvs.style.zIndex = '0';
      cvs.style.pointerEvents = 'none';
      header.appendChild(cvs);
    }

    const ctx = cvs.getContext('2d');
    function resize() {
      cvs.width = header.clientWidth;
      cvs.height = header.clientHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    heroShapes = Array.from({ length: 25 }, (_, i) => new HeroShape(cvs, i));

    if (heroRaf) cancelAnimationFrame(heroRaf);
    function render(time) {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      const colors = getDynamicColors(header);
      for (const shape of heroShapes) shape.draw(ctx, time, colors);
      heroRaf = requestAnimationFrame(render);
    }
    heroRaf = requestAnimationFrame(render);
  }

  function stopHeaderAnimation() {
    if (heroRaf) {
      cancelAnimationFrame(heroRaf);
      heroRaf = null;
    }
  }

  function generateStarShadows(count, width, height) {
    let shadows = [];
    for (let i = 0; i < count; i++) {
      shadows.push(`${Math.floor(Math.random() * width)}px ${Math.floor(Math.random() * height)}px rgba(255,255,255,0.7)`);
    }
    return shadows.join(', ');
  }

  // ============================================================
  //  BUILD OVERLAY HTML
  // ============================================================
  function buildOverlay() {
    if (document.getElementById('gf-overlay')) return;

    if (!document.getElementById('gf-dynamic-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'gf-dynamic-styles';
      const w = 500;
      const h = 700;
      styleEl.textContent = `
        #gf-stars1 { width: 1px; height: 1px; background: transparent; box-shadow: ${generateStarShadows(150, w, h)}; animation: gf-animStar 50s linear infinite; }
        #gf-stars1:after { content: " "; position: absolute; top: ${h}px; width: 1px; height: 1px; background: transparent; box-shadow: inherit; }
        #gf-stars2 { width: 2px; height: 2px; background: transparent; box-shadow: ${generateStarShadows(50, w, h)}; animation: gf-animStar 100s linear infinite; }
        #gf-stars2:after { content: " "; position: absolute; top: ${h}px; width: 2px; height: 2px; background: transparent; box-shadow: inherit; }
        #gf-stars3 { width: 3px; height: 3px; background: transparent; box-shadow: ${generateStarShadows(25, w, h)}; animation: gf-animStar 150s linear infinite; }
        #gf-stars3:after { content: " "; position: absolute; top: ${h}px; width: 3px; height: 3px; background: transparent; box-shadow: inherit; }
        @keyframes gf-animStar { from { transform: translateY(0px); } to { transform: translateY(-${h}px); } }
      `;
      document.head.appendChild(styleEl);
    }

    const overlay = document.createElement('div');
    overlay.id = 'gf-overlay';
    overlay.innerHTML = `
      <div id="gf-card">
        <button id="gf-close" title="Dismiss">✕</button>

        <!-- HEADER -->
        <div id="gf-header">
          <div id="gf-stars-container">
            <div id="gf-stars1"></div>
            <div id="gf-stars2"></div>
            <div id="gf-stars3"></div>
          </div>
          <div id="gf-header-content">
            <span id="gf-emoji-bounce">🤦</span>
            <h2 id="gf-title">WAIT. Did you try Google?</h2>
            <p id="gf-subtitle" id="gf-meme-line">${randomItem(MEME_LINES)}</p>
          </div>
        </div>

        <!-- PHASE 1: PROMPT + ACTIONS -->
        <div id="gf-phase1">
          <div id="gf-prompt-box">
            <div id="gf-prompt-label">✋ You were about to ask:</div>
            <div id="gf-prompt-text"></div>
          </div>

          <div id="gf-water-ticker">
            <span class="gf-drop">💧</span>
            <span>This prompt could cost ~<strong>${WATER_ML_PER_QUERY}ml</strong> of water to run</span>
          </div>

          <div id="gf-actions">
            <button class="gf-btn" id="gf-btn-google">
              🔍 Google It First
            </button>
            <button class="gf-btn" id="gf-btn-skip">
              💸 Skip & Waste Water
            </button>
          </div>
        </div>

        <!-- PHASE 2: RESULTS -->
        <div id="gf-results">
          <div id="gf-results-header">
            <span id="gf-results-label">Top Google Results</span>
            <div id="gf-results-loading">
              <div class="gf-spinner"></div>
              <span>Googling...</span>
            </div>
          </div>
          <div id="gf-results-list"></div>
        </div>

        <!-- PHASE 3: PENALTY -->
        <div id="gf-penalty">
          <p id="gf-penalty-title">Welp. 🙃</p>
          <div class="gf-penalty-hero">
            <div class="gf-penalty-hero-left">
              <p id="gf-penalty-sub">You just wasted...</p>
            </div>

            <div class="gf-penalty-hero-center">
              <div id="gf-cup-container">
                <div id="gf-drops-container"></div>
                <svg id="gf-cup-svg" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <clipPath id="gf-cup-clip">
                      <path d="M15,20 L105,20 L95,148 L25,148 Z"/>
                    </clipPath>
                  </defs>
                  <!-- Cup outline -->
                  <path d="M15,20 L105,20 L95,148 L25,148 Z" fill="#1A2744" stroke="#4285F4" stroke-width="2"/>
                  <!-- Water fill -->
                  <g clip-path="url(#gf-cup-clip)">
                    <rect id="gf-water-rect" x="0" y="84" width="120" height="80" fill="url(#gf-water-grad)"/>
                    <!-- Ripple -->
                    <ellipse id="gf-water-ellipse" cx="60" cy="84" rx="45" ry="5" fill="#5BC8F5" opacity="0.6"/>
                  </g>
                  <!-- Bubbles -->
                  <circle class="gf-bubble" cx="40" cy="120" r="3" fill="rgba(255,255,255,0.25)"/>
                  <circle class="gf-bubble" cx="70" cy="110" r="2" fill="rgba(255,255,255,0.2)"/>
                  <circle class="gf-bubble" cx="55" cy="130" r="4" fill="rgba(255,255,255,0.15)"/>
                  <!-- Glass shine -->
                  <path d="M22,30 Q28,20 30,60" stroke="rgba(255,255,255,0.15)" stroke-width="3" stroke-linecap="round" fill="none"/>
                  <defs>
                    <linearGradient id="gf-water-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:#4FC3F7;stop-opacity:0.95"/>
                      <stop offset="100%" style="stop-color:#0277BD;stop-opacity:0.9"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div id="gf-waste-amount">0 ml</div>
            </div>
            
            <div class="gf-penalty-hero-right">
              <div id="gf-waste-label">of AI cooling water</div>
            </div>
          </div>


          <div class="gf-penalty-content">
            <div id="gf-waste-compare"></div>
            <div id="gf-total-stats">
              Total wasted: <span id="gf-total-wasted-val">0</span> ml (<span id="gf-total-cups-val">0</span> cups)
            </div>
            <button id="gf-penalty-proceed">Ok ok, let me proceed anyway →</button>
          </div>
  
        </div>

        <!-- FOOTER -->
        <div id="gf-footer">
          <span id="gf-footer-text">Powered by common sense &amp; </span>
          <span class="gf-google-g gf-g-blue">G</span>
          <span class="gf-google-g gf-g-red">o</span>
          <span class="gf-google-g gf-g-yellow">o</span>
          <span class="gf-google-g gf-g-blue">g</span>
          <span class="gf-google-g gf-g-green">l</span>
          <span class="gf-google-g gf-g-red">e</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    setupOverlayEvents(overlay);
  }

  // ============================================================
  //  EVENT BINDING
  // ============================================================
  function setupOverlayEvents(overlay) {
    const $ = (id) => document.getElementById(id);

    $('gf-close').addEventListener('click', dismissOverlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) dismissOverlay();
    });

    $('gf-btn-google').addEventListener('click', showResults);
    $('gf-btn-skip').addEventListener('click', showPenalty);
    $('gf-penalty-proceed').addEventListener('click', proceedAndSend);
  }

  // ============================================================
  //  SHOW OVERLAY
  // ============================================================
  function showOverlay(prompt, sendFn) {
    if (interceptActive) return;

    interceptActive = true;
    pendingPrompt = prompt;
    pendingSendFn = sendFn;

    buildOverlay();

    const overlay = document.getElementById('gf-overlay');
    const promptEl = document.getElementById('gf-prompt-text');
    const subtitle = document.getElementById('gf-subtitle');

    const header = document.getElementById('gf-header');
    if (header) {
      header.classList.remove('gf-theme-green', 'gf-theme-penalty');
      header.classList.add('gf-theme-warning');
    }

    const banner = document.getElementById('gf-saved-stats');
    if (banner) banner.remove();

    document.getElementById('gf-title').textContent = "WAIT. Did you try Google?";
    document.getElementById('gf-emoji-bounce').textContent = "🤦";

    subtitle.textContent = randomItem(MEME_LINES);
    pushedSavedWaterAmount = 0;
    promptEl.textContent = prompt.length > 200
      ? prompt.slice(0, 200) + '…'
      : prompt;

    // Reset phases
    showPhase('phase1');

    requestAnimationFrame(() => {
      overlay.classList.add('gf-visible');
      startHeaderAnimation();
    });
  }

  function dismissOverlay() {
    if (autoProceedInterval) {
      clearInterval(autoProceedInterval);
      autoProceedInterval = null;
    }
    const overlay = document.getElementById('gf-overlay');
    if (!overlay) return;
    overlay.classList.remove('gf-visible');
    stopHeaderAnimation();
    setTimeout(() => {
      overlay.remove();
      interceptActive = false;
    }, 400);
  }

  // ============================================================
  //  PHASE MANAGEMENT
  // ============================================================
  function showPhase(phase) {
    const phases = ['gf-phase1', 'gf-results', 'gf-penalty'];
    phases.forEach(p => {
      const el = document.getElementById(p);
      if (!el) return;
      if (p === `gf-${phase}`) {
        el.classList.add('gf-show');
        el.style.display = 'flex';
      } else {
        el.classList.remove('gf-show');
        el.style.display = 'none';
      }
    });
    // phase1 is not display:flex controlled the same way
    if (phase === 'phase1') {
      const p1 = document.getElementById('gf-phase1');
      if (p1) p1.style.display = 'block';
    }
  }

  // ============================================================
  //  SHOW RESULTS
  // ============================================================
  async function showResults() {
    document.getElementById('gf-phase1').style.display = 'none';
    const resultsEl = document.getElementById('gf-results');
    resultsEl.style.display = 'flex';
    resultsEl.classList.add('gf-show');

    const listEl = document.getElementById('gf-results-list');
    const loadingEl = document.getElementById('gf-results-loading');
    listEl.innerHTML = '';
    loadingEl.style.display = 'flex';

    // Header modifications (Positive Feedback)
    const header = document.getElementById('gf-header');
    if (header) {
      header.classList.remove('gf-theme-warning', 'gf-theme-penalty');
      header.classList.add('gf-theme-green');
    }

    const emojiEl = document.getElementById('gf-emoji-bounce');
    emojiEl.textContent = randomItem(POSITIVE_EMOJIS);
    // Retrigger bounce animation
    emojiEl.style.animation = 'none';
    void emojiEl.offsetHeight; // trigger reflow
    emojiEl.style.animation = null;

    document.getElementById('gf-title').textContent = "Good choice!";
    document.getElementById('gf-subtitle').textContent = randomItem(POSITIVE_MEME_LINES);

    // Calculate water saved
    const promptWords = pendingPrompt.split(/\s+/).length;
    const waterMl = WATER_ML_PER_QUERY + Math.floor(promptWords * 0.5);
    pushedSavedWaterAmount = waterMl;

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['totalWaterSaved'], (data) => {
        let totalSaved = data.totalWaterSaved || 0;
        let newTotal = totalSaved + waterMl;
        chrome.storage.local.set({ totalWaterSaved: newTotal });

        const savedBanner = document.createElement('div');
        savedBanner.id = 'gf-saved-stats';
        savedBanner.innerHTML = `💚 You just saved <strong>${waterMl} ml</strong>! (Total saved: ${newTotal} ml)`;
        resultsEl.insertBefore(savedBanner, document.getElementById('gf-results-header'));
      });
    }

    const results = await fetchGoogleResults(pendingPrompt);
    loadingEl.style.display = 'none';

    if (!results || results.length === 0) {
      listEl.innerHTML = `<p style="color:var(--gf-text-muted);font-size:13px;padding:8px 0;">
        Couldn't load results. (The irony.) 
        <a href="https://google.com/search?q=${encodeURIComponent(pendingPrompt)}" target="_blank" 
           style="color:#6AADFF">Open in Google ↗</a>
      </p>`;
      return;
    }

    results.slice(0, 3).forEach((r, i) => {
      const card = document.createElement('div');
      card.className = 'gf-result-card';
      card.dataset.url = r.url;
      card.dataset.expanded = 'false';
      card.innerHTML = `
        <div class="gf-result-source">
          <img class="gf-result-favicon" 
               src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(r.domain)}&sz=16" 
               onerror="this.style.display='none'"/>
          ${r.domain}
        </div>
        <div class="gf-result-title">${escHtml(r.title)}</div>
        <div class="gf-result-snippet">${escHtml(r.snippet)}</div>
        <div class="gf-result-summary">${escHtml(r.summary)}
          <div class="gf-open-hint">↗ Click again to open in new tab</div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (card.dataset.expanded === 'false') {
          card.classList.add('gf-expanded');
          card.dataset.expanded = 'true';
        } else {
          window.open(r.url, '_blank');
          card.classList.add('gf-open-tab');
        }
      });

      listEl.appendChild(card);
    });

    // Add "Still want to use AI?" footer
    const footer = document.createElement('div');
    footer.style.cssText = `
      text-align:center;padding:4px 0 0;
      font-size:11px;color:var(--gf-text-muted);
    `;
    footer.innerHTML = `Still want AI? <button class="gf-btn-footer-skip" 
      style="background:none;border:none;color:#FF6B6B;cursor:pointer;font-size:11px;text-decoration:underline;font-family:inherit;">
      fine, proceed</button>`;
    listEl.appendChild(footer);

    const skipBtn = footer.querySelector('.gf-btn-footer-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', showPenalty);
    }
  }

  // ============================================================
  //  SHOW PENALTY (water animation)
  // ============================================================
  function showPenalty() {
    showPhase('penalty');

    // Header modifications (Penalty Feedback)
    const header = document.getElementById('gf-header');
    if (header) {
      header.classList.remove('gf-theme-green', 'gf-theme-warning');
      header.classList.add('gf-theme-penalty');
    }

    const emojiEl = document.getElementById('gf-emoji-bounce');
    if (emojiEl) emojiEl.textContent = "🤦";

    const titleEl = document.getElementById('gf-title');
    if (titleEl) titleEl.textContent = "WAIT. Did you try Google?";

    const subtitleEl = document.getElementById('gf-subtitle');
    if (subtitleEl) subtitleEl.textContent = randomItem(MEME_LINES);

    const penaltyEl = document.getElementById('gf-penalty');
    penaltyEl.style.display = 'flex';
    penaltyEl.classList.add('gf-show');

    // Calculate water used (fake but fun)
    const promptWords = pendingPrompt.split(/\s+/).length;
    const waterMl = WATER_ML_PER_QUERY + Math.floor(promptWords * 0.5);
    currentPenaltyWaterMl = waterMl;

    // Animate water amount counter
    const wasteEl = document.getElementById('gf-waste-amount');
    animateCounter(wasteEl, 0, waterMl, 1800, (v) => `+${v} ml`);

    // Fetch and update persistent stats
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['totalWaterWasted'], (data) => {
        let totalWasted = data.totalWaterWasted || 0;
        let newWasted = totalWasted + waterMl;
        let cupsWasted = Math.floor(newWasted / CUP_CAPACITY_ML);
        let moduloMl = newWasted % CUP_CAPACITY_ML;

        const totalWastedEl = document.getElementById('gf-total-wasted-val');
        const totalCupsEl = document.getElementById('gf-total-cups-val');
        if (totalWastedEl) totalWastedEl.textContent = newWasted;
        if (totalCupsEl) totalCupsEl.textContent = cupsWasted;

        animateWaterCup(moduloMl);
      });
    } else {
      animateWaterCup(waterMl);
    }

    // Set comparison text (delayed)
    setTimeout(() => {
      document.getElementById('gf-waste-compare').textContent =
        '= ' + randomItem(WATER_COMPARISONS);
    }, 1200);

    // Spawn falling drops
    spawnDrops();

    // Auto-proceed logic
    if (autoProceedTime > 0) {
      let timeLeft = autoProceedTime;
      const proceedBtn = document.getElementById('gf-penalty-proceed');
      if (proceedBtn) proceedBtn.textContent = `Ok ok, let me proceed anyway → (${timeLeft}s)`;

      autoProceedInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(autoProceedInterval);
          autoProceedInterval = null;
          if (proceedBtn) proceedBtn.textContent = `Ok ok, let me proceed anyway →`;
          proceedAndSend();
        } else {
          if (proceedBtn) proceedBtn.textContent = `Ok ok, let me proceed anyway → (${timeLeft}s)`;
        }
      }, 1000);
    } else if (autoProceedTime === -1) {
      // INSTANT MODE: Proceed immediately but keep the penalty animation visible in mini-popup
      recordWaste(); // PERSIST WASTE HERE Since we are proceeding

      const overlay = document.getElementById('gf-overlay');
      const card = document.getElementById('gf-card');

      overlay.classList.add('gf-mini-popup');
      card.classList.add('gf-mini');

      if (typeof pendingSendFn === 'function') {
        isProceeding = true;
        pendingSendFn();
        setTimeout(() => { isProceeding = false; }, 200);
      }

      // Auto-close mini-popup after animation
      setTimeout(() => {
        dismissOverlay();
      }, 4500);
    }
  }

  function animateCounter(el, from, to, duration, fmt) {
    const start = performance.now();
    function update(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(Math.round(from + (to - from) * ease));
      if (t < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function animateWaterCup(ml) {
    const rect = document.getElementById('gf-water-rect');
    const ellipse = document.getElementById('gf-water-ellipse');
    if (!rect) return;

    // Cup goes from y=148 (empty) up to y=20 (full)
    // ml range: 0-100ml -> fill 0-100%
    const fillPct = Math.min(ml / CUP_CAPACITY_ML, 1);
    const yFull = 148 - (128 * fillPct);

    rect.setAttribute('y', '148');
    ellipse.setAttribute('cy', '148');

    setTimeout(() => {
      rect.style.transition = 'y 2.2s cubic-bezier(0.25,0.46,0.45,0.94)';
      rect.setAttribute('y', yFull.toString());
      ellipse.style.transition = 'cy 2.2s cubic-bezier(0.25,0.46,0.45,0.94)';
      ellipse.setAttribute('cy', yFull.toString());
    }, 200);
  }

  function spawnDrops() {
    const container = document.getElementById('gf-drops-container');
    if (!container) return;
    const count = 6;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const drop = document.createElement('span');
        drop.className = 'gf-falling-drop';
        drop.style.left = `${randomInt(-20, 20)}px`;
        drop.style.animationDelay = `${Math.random() * 0.3}s`;
        drop.textContent = '💧';
        container.appendChild(drop);
        setTimeout(() => drop.remove(), 1200);
      }, i * 200);
    }
  }

  // ============================================================
  //  PROCEED & SEND
  // ============================================================
  function recordWaste() {
    if (chrome && chrome.storage && chrome.storage.local && currentPenaltyWaterMl > 0) {
      const recordedWater = currentPenaltyWaterMl;
      currentPenaltyWaterMl = 0; // Prevent double recording

      chrome.storage.local.get(['totalWaterWasted', 'totalWaterSaved'], (data) => {
        let totalWasted = data.totalWaterWasted || 0;
        let totalSaved = data.totalWaterSaved || 0;

        let newWasted = totalWasted + recordedWater;
        let setObj = { totalWaterWasted: newWasted };

        if (pushedSavedWaterAmount > 0) {
          let newSaved = totalSaved - pushedSavedWaterAmount;
          if (newSaved < 0) newSaved = 0;
          setObj.totalWaterSaved = newSaved;
          pushedSavedWaterAmount = 0;
        }

        chrome.storage.local.set(setObj);
      });
    }
  }

  function proceedAndSend() {
    recordWaste();
    dismissOverlay();
    setTimeout(() => {
      if (typeof pendingSendFn === 'function') {
        isProceeding = true;
        pendingSendFn();
        setTimeout(() => { isProceeding = false; }, 200);
      }
    }, 450);
  }

  // ============================================================
  //  GOOGLE RESULTS (via open SERP fetch)
  // ============================================================
  async function fetchGoogleResults(query) {
    try {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetchSearch', query }, (response) => {
          if (response && response.success && response.html) {
            resolve(parseDDGResults(response.html, query));
          } else {
            resolve(fallbackResults(query));
          }
        });
      });
    } catch {
      return fallbackResults(query);
    }
  }

  function parseDDGResults(html, query) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const results = [];
      const items = doc.querySelectorAll('.result');

      items.forEach(item => {
        if (results.length >= 3) return;
        const titleEl = item.querySelector('.result__title a');
        const snippetEl = item.querySelector('.result__snippet');
        if (!titleEl) return;

        const title = titleEl.textContent.trim();
        const href = titleEl.getAttribute('href') || '';
        // DDG uses redirect links
        const urlMatch = href.match(/uddg=([^&]+)/);
        const url = urlMatch ? decodeURIComponent(urlMatch[1]) : href;
        const snippet = snippetEl ? snippetEl.textContent.trim() : '';

        let domain = '';
        try { domain = new URL(url).hostname.replace('www.', ''); } catch { }

        results.push({
          title,
          url,
          domain,
          snippet,
          summary: snippet + (snippet ? '' : ' No summary available. Click to visit the page.')
        });
      });

      return results.length > 0 ? results : fallbackResults(query);
    } catch {
      return fallbackResults(query);
    }
  }

  function fallbackResults(query) {
    const q = encodeURIComponent(query);
    return [
      {
        title: `Search Google for "${query.slice(0, 40)}${query.length > 40 ? '...' : ''}"`,
        url: `https://www.google.com/search?q=${q}`,
        domain: 'google.com',
        snippet: 'Click to open full Google search results in a new tab.',
        summary: 'The extension couldn\'t fetch live results directly, but you can open Google to find your answer!'
      },
      {
        title: `DuckDuckGo: "${query.slice(0, 40)}${query.length > 40 ? '...' : ''}"`,
        url: `https://duckduckgo.com/?q=${q}`,
        domain: 'duckduckgo.com',
        snippet: 'Private search without tracking.',
        summary: 'DuckDuckGo gives you search results without building a profile on you. Worth a shot!'
      },
      {
        title: `Wikipedia: "${query.slice(0, 40)}${query.length > 40 ? '...' : ''}"`,
        url: `https://en.wikipedia.org/w/index.php?search=${q}`,
        domain: 'wikipedia.org',
        snippet: 'The free encyclopedia that anyone can edit.',
        summary: 'Wikipedia might have a comprehensive article on your topic, written by humans, for free, with zero water wasted.'
      }
    ];
  }

  // ============================================================
  //  INTERCEPT LOGIC
  // ============================================================
  function getConfig() {
    return PLATFORM_CONFIGS.find(c => c.host.test(window.location.hostname));
  }

  /** Pierces Shadow DOM to find an element */
  function shadowQuerySelector(selector, root = document) {
    const el = root.querySelector(selector);
    if (el) return el;
    const hosts = root.querySelectorAll('*');
    for (const host of hosts) {
      if (host.shadowRoot) {
        const found = shadowQuerySelector(selector, host.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  function getPromptText() {
    const config = currentPlatform;
    if (!config) return '';
    const input = shadowQuerySelector(config.inputSel);
    if (!input) return '';
    return (input.value || input.textContent || input.innerText || '').trim();
  }

  // ============================================================
  //  MODERN ANALYZING UI (Pulsing Glow)
  // ============================================================
  function showAnalyzingOverlay() {
    if (document.getElementById('gf-analyzing-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'gf-analyzing-overlay';
    overlay.innerHTML = `
      <div id="gf-analyzing-card">
        <div class="gf-analyzing-spinner"></div>
        <p class="gf-analyzing-text">Analyzing Intent</p>
        <p class="gf-analyzing-sub">Locally classifying with AI...</p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('gf-visible'));
  }

  function hideAnalyzingOverlay() {
    const overlay = document.getElementById('gf-analyzing-overlay');
    if (!overlay) return;
    overlay.classList.remove('gf-visible');
    setTimeout(() => overlay.remove(), 400);
  }

  function classifyPrompt(query) {
    console.log(`[GF] [Content] Requesting classification for: "${query.slice(0, 50)}..."`);
    return new Promise((resolve) => {
      // Set a safety timeout of 2 seconds
      const timeoutId = setTimeout(() => {
        console.warn(`[GF] [Content] Classification timed out (2s). Defaulting to Google Search.`);
        resolve({ label: "Google Search", score: 0 });
      }, 2000);

      chrome.runtime.sendMessage({ action: 'classifyPrompt', query }, (response) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          console.error(`[GF] [Content] Runtime Error:`, chrome.runtime.lastError.message);
          resolve({ label: "Google Search", score: 0 });
          return;
        }
        if (response && response.success) {
          console.log(`[GF] [Content] Received classification result:`, response);
          resolve(response);
        } else {
          console.warn(`[GF] [Content] Classification response failed or empty:`, response);
          // Default to search on error
          resolve({ label: "Google Search", score: 0 });
        }
      });
    });
  }

  function setupInterceptors() {
    currentPlatform = getConfig();
    if (!currentPlatform) return;

    // Keyboard: Enter key
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || interceptActive || isProceeding || isClassifying) return;

      const input = shadowQuerySelector(currentPlatform.inputSel);
      const isFocused = (document.activeElement === input) ||
        (input && input.contains(document.activeElement)) ||
        (e.composedPath().includes(input));

      if (!input || !isFocused) return;

      const text = getPromptText();
      if (!text || text.length < 5) return;

      // SILENT MEASUREMENT MODE
      if (!isExtensionEnabled || disabledSitesList.includes(currentPlatform.id)) {
        const promptWords = text.split(/\s+/).length;
        const waterMl = WATER_ML_PER_QUERY + Math.floor(promptWords * 0.5);
        chrome.storage.local.get(['totalWaterWasted'], (data) => {
          const totalWasted = (data.totalWaterWasted || 0) + waterMl;
          chrome.storage.local.set({ totalWaterWasted: totalWasted });
        });
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();

      isClassifying = true;
      showAnalyzingOverlay();

      classifyPrompt(text).then((result) => {
        isClassifying = false;
        hideAnalyzingOverlay();

        if (result.label === 'LLM Prompt') {
          console.log(`[GF] Bypassing interceptor: query matches LLM Prompt intent (${result.score.toFixed(2)})`);
          isProceeding = true;
          // Re-dispatch event
          const evt = new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', bubbles: true, cancelable: true, composed: true
          });
          input.dispatchEvent(evt);
          setTimeout(() => { isProceeding = false; }, 200);
        } else {
          console.log(`[GF] Intercepting: query matches Google Search intent (${result.score.toFixed(2)})`);
          pulseAroundElement(input);
          showOverlay(text, () => {
            const evt = new KeyboardEvent('keydown', {
              key: 'Enter', code: 'Enter', bubbles: true, cancelable: true, composed: true
            });
            input.dispatchEvent(evt);
          });
        }
      });
    }, true);

    // Click on send button
    document.addEventListener('click', (e) => {
      if (interceptActive || isProceeding || isClassifying) return;

      // Support shadow DOM by checking the composed path
      let sendBtn = null;
      const path = e.composedPath();
      for (const el of path) {
        if (el.matches && el.matches(currentPlatform.sendSel)) {
          sendBtn = el;
          break;
        }
      }

      if (!sendBtn) return;

      const text = getPromptText();
      if (!text || text.length < 5) return;

      // SILENT MEASUREMENT MODE
      if (!isExtensionEnabled || disabledSitesList.includes(currentPlatform.id)) {
        const promptWords = text.split(/\s+/).length;
        const waterMl = WATER_ML_PER_QUERY + Math.floor(promptWords * 0.5);
        chrome.storage.local.get(['totalWaterWasted'], (data) => {
          const totalWasted = (data.totalWaterWasted || 0) + waterMl;
          chrome.storage.local.set({ totalWaterWasted: totalWasted });
        });
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();

      isClassifying = true;
      showAnalyzingOverlay();

      classifyPrompt(text).then((result) => {
        isClassifying = false;
        hideAnalyzingOverlay();

        if (result.label === 'LLM Prompt') {
          console.log(`[GF] Bypassing interceptor: query matches LLM Prompt intent (${result.score.toFixed(2)})`);
          isProceeding = true;
          sendBtn.click();
          setTimeout(() => { isProceeding = false; }, 200);
        } else {
          console.log(`[GF] Intercepting: query matches Google Search intent (${result.score.toFixed(2)})`);
          pulseAroundElement(sendBtn);
          showOverlay(text, () => {
            sendBtn.click();
          });
        }
      });
    }, true);
  }

  function pulseAroundElement(el) {
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height, 30);
    const ring = document.createElement('div');
    ring.className = 'gf-pulse-ring';
    ring.style.cssText = `
      left:${rect.left + rect.width / 2 - size / 2 + window.scrollX}px;
      top:${rect.top + rect.height / 2 - size / 2 + window.scrollY}px;
      width:${size}px;height:${size}px;
    `;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 1000);
  }

  // ============================================================
  //  UTILS
  // ============================================================
  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============================================================
  //  INIT
  // ============================================================
  function init() {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['enabled', 'disabledSites', 'autoProceedTime'], (data) => {
        isExtensionEnabled = data.enabled !== false;
        disabledSitesList = data.disabledSites || [];
        if (data.autoProceedTime !== undefined) autoProceedTime = data.autoProceedTime;

        // Wait for page to settle
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', setupInterceptors);
        } else {
          setupInterceptors();
        }
      });

      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
          if (changes.enabled) isExtensionEnabled = changes.enabled.newValue;
          if (changes.disabledSites) disabledSitesList = changes.disabledSites.newValue;
          if (changes.autoProceedTime) autoProceedTime = changes.autoProceedTime.newValue;
        }
      });
    } else {
      // Fallback
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupInterceptors);
      } else {
        setupInterceptors();
      }
    }
  }

  init();
})();
