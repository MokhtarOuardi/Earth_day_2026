document.addEventListener('DOMContentLoaded', () => {
  const SITES = [
    { id: 'chatgpt', name: 'ChatGPT', hostPattern: 'chatgpt.com' },
    { id: 'gemini', name: 'Gemini', hostPattern: 'gemini.google.com' },
    { id: 'claude', name: 'Claude', hostPattern: 'claude.ai' },
    { id: 'perplexity', name: 'Perplexity', hostPattern: 'perplexity.ai' },
    { id: 'copilot', name: 'Copilot', hostPattern: 'copilot.microsoft.com' },
    { id: 'mistral', name: 'Mistral', hostPattern: 'chat.mistral.ai' },
    { id: 'meta', name: 'Meta AI', hostPattern: 'meta.ai' }
  ];

  const siteList = document.getElementById('site-list');
  siteList.innerHTML = ''; // clear initial list

  // Initial load
  chrome.storage.local.get(['totalWaterSaved', 'totalWaterWasted', 'enabled', 'disabledSites', 'autoProceedTime'], (data) => {
    const saved = data.totalWaterSaved || 0;
    const wasted = data.totalWaterWasted || 0;
    const enabled = data.enabled !== false; // defaults to true
    const disabledSites = data.disabledSites || [];
    const autoProceedTime = data.autoProceedTime !== undefined ? data.autoProceedTime : 5;

    document.getElementById('stat-saved').textContent = saved + ' ml';
    document.getElementById('stat-water').textContent = wasted + ' ml';
    
    // Quick tip math (assume 30ml per average query)
    const promptsSaved = Math.floor(saved / 30);
    document.getElementById('tip-searches').textContent = promptsSaved;

    document.getElementById('toggle-enabled').checked = enabled;
    
    const timeSelect = document.getElementById('setting-auto-proceed');
    timeSelect.value = autoProceedTime.toString();
    timeSelect.addEventListener('change', (e) => {
      chrome.storage.local.set({ autoProceedTime: parseInt(e.target.value) });
    });

    // Render sites
    SITES.forEach(site => {
      const span = document.createElement('span');
      span.className = 'site-chip';
      if (!disabledSites.includes(site.id)) {
        span.classList.add('active');
      }
      span.textContent = site.name;
      
      span.addEventListener('click', () => {
        span.classList.toggle('active');
        const isActive = span.classList.contains('active');
        
        chrome.storage.local.get(['disabledSites'], (currentData) => {
          let sites = currentData.disabledSites || [];
          if (isActive) {
            sites = sites.filter(s => s !== site.id);
          } else {
            if (!sites.includes(site.id)) sites.push(site.id);
          }
          chrome.storage.local.set({ disabledSites: sites });
        });
      });
      siteList.appendChild(span);
    });
  });

  document.getElementById('toggle-enabled').addEventListener('change', (e) => {
    chrome.storage.local.set({ enabled: e.target.checked });
  });
});
