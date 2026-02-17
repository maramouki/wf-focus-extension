/* WF Focus - v0.1.1 (Sidebar & Position Fix) */

const CONFIG = {
    selectors: {
        pillWrapper: '[data-automation-id="style-rule-token-wrapper"]',
        pillText: '[data-automation-id="style-rule-token-text-editable"], [data-automation-id="style-rule-token-text"]',
        input: 'input[data-automation-id="css-token-input"]',
        // Robust list of selectors for the Style Panel
        rightSidebar: [
            '[data-automation-id="designer-right-sidebar"]',
            '.designer-right-sidebar',
            '#style-panel',
            '.right-sidebar',
            '[data-automation-id="style-panel"]'
        ]
    }
};

let state = {
    isFocusMode: false,
    focusedClassName: null,
    removedClasses: [],
    overlayElement: null,
    settings: {
        enabled: true,
        opacity: 10,
        showBadge: true
    }
};

const isTopFrame = window.top === window.self;

// --- Persistence & Sync ---

if (isTopFrame) {
    chrome.storage.local.get(['enabled', 'opacity', 'showBadge'], (result) => {
        state.settings.enabled = result.enabled !== false;
        state.settings.opacity = result.opacity !== undefined ? result.opacity : 10;
        state.settings.showBadge = result.showBadge !== false;
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.enabled) state.settings.enabled = changes.enabled.newValue;
        if (changes.opacity) {
            state.settings.opacity = changes.opacity.newValue;
            if (state.overlayElement) state.overlayElement.style.background = `rgba(0,0,0,${state.settings.opacity / 100})`;
        }
        if (changes.showBadge) {
            state.settings.showBadge = changes.showBadge.newValue;
            updateBadge();
        }
    });
}

function updateBadge() {
    if (!isTopFrame) return;
    try {
        chrome.runtime.sendMessage({
            type: 'UPDATE_BADGE',
            status: state.isFocusMode ? 'active' : 'inactive'
        });
    } catch (e) { } // Extension context might be invalid on some reloads
}

// --- Utilities ---

function getPillName(pillElement) {
    const textEl = pillElement.querySelector(CONFIG.selectors.pillText);
    return textEl ? textEl.innerText.trim() : null;
}

function simulateFocus(element) {
    element.focus();
    element.dispatchEvent(new Event('focus', { bubbles: true }));
}

function setReactValue(element, value) {
    const lastValue = element.value;
    element.value = value;
    const event = new Event('input', { bubbles: true });
    event.simulated = true;
    const tracker = element._valueTracker;
    if (tracker) {
        tracker.setValue(lastValue);
    }
    element.dispatchEvent(event);
}

function simulateEnter(element) {
    const params = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent('keydown', params));
    element.dispatchEvent(new KeyboardEvent('keyup', params));
}

function simulateBackspace(element) {
    const params = { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent('keydown', params));
}

// --- UI Logic ---

function showShield() {
    if (!isTopFrame) return;

    // Clean up any stale overlays first
    const stale = document.getElementById('wf-extension-global-mask');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'wf-extension-global-mask';

    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 1000000;
        background: rgba(0,0,0,${state.settings.opacity / 100});
        pointer-events: auto;
        cursor: not-allowed;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding-top: 40px;
        transition: background 0.3s;
    `;

    // Try to find the sidebar using multiple selectors
    let sidebar = null;
    for (const sel of CONFIG.selectors.rightSidebar) {
        sidebar = document.querySelector(sel);
        if (sidebar && sidebar.offsetWidth > 0) break;
    }

    let maskBoundary = window.innerWidth - 300; // Default fallback: spare 300px on the right
    if (sidebar) {
        const rect = sidebar.getBoundingClientRect();
        if (rect.left > 0) maskBoundary = rect.left;
        console.log('[WF Focus] Sidebar localized at:', rect.left);
    } else {
        console.warn('[WF Focus] Sidebar NOT found. Using 300px fallback.');
    }

    // Apply Mask
    overlay.style.clipPath = `polygon(0% 0%, 0% 100%, ${maskBoundary}px 100%, ${maskBoundary}px 0%)`;

    // Banner (Toast)
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #fffafa;
        border: 2px solid #ff9100;
        border-radius: 40px;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 15px 45px rgba(0,0,0,0.18);
        animation: wf-slide-down 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        font-family: Inter, system-ui, -apple-system, sans-serif;
        pointer-events: auto;
        cursor: default;
        position: relative;
    `;

    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
        width: 40px;
        height: 40px;
        background: #ff9100;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 20px;
        flex-shrink: 0;
    `;
    iconContainer.textContent = "!";

    const textWrapper = document.createElement('div');
    textWrapper.style.cssText = `display: flex; flex-direction: column;`;

    const title = document.createElement('div');
    title.style.cssText = `font-weight: 700; color: #1a1a1a; font-size: 16px;`;
    title.textContent = "Focus Mode Active";

    const instructions = document.createElement('div');
    instructions.style.cssText = `color: #666; font-size: 13px; margin-top: 2px;`;
    instructions.textContent = "Shift + Click active pill or ESC to restore";

    textWrapper.appendChild(title);
    textWrapper.appendChild(instructions);

    const restoreBtn = document.createElement('button');
    restoreBtn.style.cssText = `
        margin-left: 12px;
        background: #ff9100;
        color: white;
        border: none;
        padding: 10px 22px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: .2s;
        box-shadow: 0 4px 12px rgba(255, 145, 0, 0.2);
    `;
    restoreBtn.textContent = "Restore";
    restoreBtn.onclick = (e) => { e.stopPropagation(); restoreClasses(); };

    toast.appendChild(iconContainer);
    toast.appendChild(textWrapper);
    toast.appendChild(restoreBtn);
    overlay.appendChild(toast);

    if (!document.getElementById('wf-focus-styles')) {
        const style = document.createElement('style');
        style.id = 'wf-focus-styles';
        style.textContent = `
            @keyframes wf-slide-down {
                from { opacity: 0; transform: translateY(-50px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    state.overlayElement = overlay;
    updateBadge();
}

function hideShield() {
    if (state.overlayElement || document.getElementById('wf-extension-global-mask')) {
        const el = state.overlayElement || document.getElementById('wf-extension-global-mask');
        if (el) el.remove();
        state.overlayElement = null;
        updateBadge();
    }
}

// --- Core ---

async function removeClass(pillElement) {
    pillElement.click();
    await new Promise(r => setTimeout(r, 60));
    const input = document.querySelector(CONFIG.selectors.input);
    if (input) {
        simulateFocus(input);
        await new Promise(r => setTimeout(r, 40));
        simulateBackspace(input);
    }
}

async function restoreClasses() {
    if (!isTopFrame || !state.isFocusMode) {
        exitFocusMode();
        return;
    }

    const input = document.querySelector(CONFIG.selectors.input);
    if (!input) {
        exitFocusMode();
        return;
    }

    const classesToRestore = [...state.removedClasses];
    exitFocusMode();

    for (const className of classesToRestore) {
        simulateFocus(input);
        await new Promise(r => setTimeout(r, 80));
        setReactValue(input, className);
        await new Promise(r => setTimeout(r, 150));
        simulateEnter(input);
        await new Promise(r => setTimeout(r, 450));
    }
}

function exitFocusMode() {
    state.isFocusMode = false;
    state.removedClasses = [];
    state.focusedClassName = null;
    document.querySelectorAll(CONFIG.selectors.pillWrapper).forEach(p => {
        p.style.outline = '';
        p.style.boxShadow = '';
    });
    hideShield();
}

function enterFocusMode(targetPill) {
    if (!isTopFrame || !state.settings.enabled) return;

    const pillName = getPillName(targetPill);
    if (!pillName) return;

    const pills = Array.from(document.querySelectorAll(CONFIG.selectors.pillWrapper));
    const targetIndex = pills.indexOf(targetPill);
    if (targetIndex === -1) return;

    const pillsToRemove = pills.slice(targetIndex + 1);
    const classesToRemove = pillsToRemove.map(p => getPillName(p)).filter(Boolean);
    if (classesToRemove.length === 0) return;

    state.isFocusMode = true;
    state.removedClasses = classesToRemove;
    state.focusedClassName = pillName;

    targetPill.style.outline = '3px solid #ff9100';
    targetPill.style.outlineOffset = '-2px';
    targetPill.style.boxShadow = '0 0 12px rgba(255, 145, 0, 0.6)';

    showShield();

    (async () => {
        for (const pill of pillsToRemove) {
            await removeClass(pill);
            await new Promise(r => setTimeout(r, 120));
        }
        const currentPills = Array.from(document.querySelectorAll(CONFIG.selectors.pillWrapper));
        const activeOne = currentPills.find(p => getPillName(p) === pillName);
        if (activeOne) activeOne.click();
    })();
}

// --- Listeners ---

if (isTopFrame) {
    document.addEventListener('keydown', (e) => {
        if (!state.settings.enabled) return;
        if (e.key === 'Escape' && state.isFocusMode) {
            e.preventDefault(); e.stopPropagation();
            restoreClasses();
        }
    }, true);

    document.addEventListener('mousedown', (e) => {
        if (!state.settings.enabled) return;
        if (e.shiftKey && e.button === 0) {
            const pill = e.target.closest(CONFIG.selectors.pillWrapper);
            if (pill) {
                const name = getPillName(pill);
                if (state.isFocusMode && state.focusedClassName === name) {
                    e.preventDefault(); e.stopPropagation();
                    restoreClasses();
                } else if (!state.isFocusMode) {
                    e.preventDefault(); e.stopPropagation();
                    enterFocusMode(pill);
                }
            }
        }
    }, true);

    console.log("[WF Focus] v0.1.1 Ready.");
}
