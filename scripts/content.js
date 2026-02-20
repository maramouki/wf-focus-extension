/* WF Focus - v0.2.1 (Pill Restoration Fixed) */

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
    },
    // Timing constants (ms)
    timing: {
        beforeType: 150,
        afterType: 100,
        afterSelect: 400,
        retryDelay: 600,
        settleDelay: 200,
        maxRetries: 2
    }
};

let state = {
    isFocusMode: false,
    isBusy: false,
    focusedClassName: null,
    removedClasses: [],
    overlayElement: null,
    settings: {
        enabled: true,
        opacity: 10
    }
};

// --- Debug Hooks ---
// To test failure banner, run this in console:
// document.documentElement.setAttribute('wf-focus-fail', 'true')

const isTopFrame = window.top === window.self;

// --- Persistence & Sync ---

if (isTopFrame) {
    chrome.storage.local.get(['enabled', 'opacity'], (result) => {
        state.settings.enabled = result.enabled !== false;
        state.settings.opacity = result.opacity !== undefined ? result.opacity : 10;
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.enabled) state.settings.enabled = changes.enabled.newValue;
        if (changes.opacity) {
            state.settings.opacity = changes.opacity.newValue;
            if (state.overlayElement) state.overlayElement.style.background = `rgba(0,0,0,${state.settings.opacity / 100})`;
        }
    });
}

// --- Utilities ---

function getPillName(pillElement) {
    const textEl = pillElement.querySelector(CONFIG.selectors.pillText);
    return textEl ? textEl.innerText.trim() : null;
}

function getAllCurrentPillNames() {
    return Array.from(document.querySelectorAll(CONFIG.selectors.pillWrapper))
        .map(p => getPillName(p))
        .filter(Boolean);
}

function simulateFocus(element) {
    element.focus();
    element.dispatchEvent(new Event('focus', { bubbles: true }));
}

/**
 * Clears the input field using execCommand.
 */
function clearInput(input) {
    input.focus();
    input.select();
    document.execCommand('delete', false, null);
    input.dispatchEvent(new Event('input', { bubbles: true }));
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

/**
 * Simulates pasting text into an input field.
 * This effectively prevents Webflow's autocomplete from intercepting
 * character-by-character typing.
 */
function simulatePaste(input, text) {
    input.focus();
    input.select();

    // execCommand('insertText') is treated like a paste event in many modern editors (including React)
    const success = document.execCommand('insertText', false, text);

    if (!success) {
        console.warn('[WF Focus] execCommand insertText failed, falling back to direct value assignment.');
        input.value = text;
    }

    // Ensure React registers the change
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- UI Logic ---

function showShield(failedClasses = []) {
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

    if (failedClasses.length > 0) {
        const failedNote = document.createElement('div');
        failedNote.style.cssText = `
            margin-top: 14px;
            padding: 12px 14px;
            background: #fff8f0;
            border: 1px solid #ffd8b1;
            border-radius: 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            box-shadow: inset 0 1px 3px rgba(255,145,0,0.05);
        `;

        const failedHeader = document.createElement('div');
        failedHeader.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            color: #af4c00;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.02em;
        `;
        failedHeader.innerHTML = '<span>⚠️</span> Manual Restore Needed';

        const pillContainer = document.createElement('div');
        pillContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        `;

        failedClasses.forEach(name => {
            const failPill = document.createElement('span');
            failPill.style.cssText = `
                background: #fefefe;
                border: 1px dashed #ff9100;
                color: #ff9100;
                padding: 4px 10px;
                border-radius: 16px;
                font-size: 11px;
                font-weight: 600;
                white-space: nowrap;
            `;
            failPill.textContent = name;
            pillContainer.appendChild(failPill);
        });

        failedNote.appendChild(failedHeader);
        failedNote.appendChild(pillContainer);
        textWrapper.appendChild(failedNote);
    }

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
    restoreBtn.textContent = failedClasses.length > 0 ? "Got it" : "Restore";
    restoreBtn.onclick = (e) => {
        e.stopPropagation();
        if (failedClasses.length > 0) {
            exitFocusMode();
        } else {
            restoreClasses();
        }
    };

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
}

function hideShield() {
    if (state.overlayElement || document.getElementById('wf-extension-global-mask')) {
        const el = state.overlayElement || document.getElementById('wf-extension-global-mask');
        if (el) el.remove();
        state.overlayElement = null;
    }
}

// --- Core ---

async function removeClass(pillElement) {
    pillElement.click();
    await new Promise(r => setTimeout(r, 100)); // Increased
    const input = document.querySelector(CONFIG.selectors.input);
    if (input) {
        simulateFocus(input);
        await new Promise(r => setTimeout(r, 60));
        simulateBackspace(input);
    }
}

/**
 * Removes a wrongly-added class by clicking its pill and pressing backspace.
 */
async function removeWrongClass(wrongClassName) {
    const pills = Array.from(document.querySelectorAll(CONFIG.selectors.pillWrapper));
    const wrongPill = pills.find(p => getPillName(p) === wrongClassName);
    if (wrongPill) {
        console.log(`[WF Focus] Removing wrong class "${wrongClassName}"...`);
        await removeClass(wrongPill);
        await new Promise(r => setTimeout(r, 400)); // Significant wait after removal
    }
}

/**
 * Attempts to restore a single class using a simple Paste + Enter strategy.
 * Returns true if the correct class pill appeared.
 */
async function restoreSingleClass(input, className) {
    const pillsBefore = getAllCurrentPillNames();

    // Check if class already exists to avoid duplication
    if (pillsBefore.includes(className)) {
        console.log(`[WF Focus] "${className}" already exists, skipping.`);
        return true;
    }

    // Sabotage Hook for Testing
    if (document.documentElement.getAttribute('wf-focus-fail') === 'true') {
        console.warn('[WF Focus] DEBUG: Sabotaging restoration of', className);
        return false;
    }

    // 1. Focus and clear input
    simulateFocus(input);
    clearInput(input);
    await new Promise(r => setTimeout(r, CONFIG.timing.beforeType));

    // 2. Paste the value
    console.log(`[WF Focus] Pasting "${className}"...`);
    simulatePaste(input, className);

    // 3. Short wait for UI to process the paste operation
    await new Promise(r => setTimeout(r, 100));

    // 4. Confirm with Enter
    simulateEnter(input);

    // 5. Wait for Webflow to process the addition
    await new Promise(r => setTimeout(r, CONFIG.timing.afterSelect));

    // 6. Verification
    const pillsAfter = getAllCurrentPillNames();
    const wasAdded = pillsAfter.includes(className);

    // 7. Check for wrongly added classes
    const newlyAdded = pillsAfter.filter(p => !pillsBefore.includes(p));
    const wrongClasses = newlyAdded.filter(p => p !== className);

    if (wrongClasses.length > 0) {
        console.warn(`[WF Focus] Wrong class(es) added: [${wrongClasses.join(', ')}]. Removing...`);
        for (const wrong of wrongClasses) {
            await removeWrongClass(wrong);
        }
    }

    if (wasAdded) {
        console.log(`[WF Focus] ✓ Restored "${className}".`);
    } else {
        console.warn(`[WF Focus] ✗ "${className}" not found after paste attempt.`);
    }

    return wasAdded;
}

async function restoreClasses() {
    if (!isTopFrame || !state.isFocusMode || state.isBusy) {
        if (state.isBusy) console.log('[WF Focus] Operation in progress, ignoring restore request.');
        if (!state.isFocusMode && !state.isBusy) exitFocusMode();
        return;
    }

    state.isBusy = true;

    const input = document.querySelector(CONFIG.selectors.input);
    if (!input) {
        console.warn('[WF Focus] Cannot restore: Input field not found.');
        exitFocusMode();
        state.isBusy = false;
        return;
    }

    const classesToRestore = [...state.removedClasses];
    const focusedClass = state.focusedClassName;
    console.log('[WF Focus] Restoring classes:', classesToRestore);

    // IMPORTANT: Don't call exitFocusMode() yet. Keeping state active ensures
    // the UI remains stable and our selectors/logic are in the correct mode.

    // 1. Reset Context: Ensure the class input is focused for a NEW class
    // Instead of clicking the pill (which might trigger rename mode), 
    // we click the input wrapper or the input itself.
    const inputWrapper = document.querySelector('[data-automation-id="css-token-input-wrapper"]') ||
        document.querySelector(CONFIG.selectors.input)?.parentElement;

    if (inputWrapper) {
        console.log('[WF Focus] Clicking input wrapper to reset context...');
        inputWrapper.click();
        await new Promise(r => setTimeout(r, 100));
    }

    // 2. Clear input and re-acquire
    let activeInput = document.querySelector(CONFIG.selectors.input);
    if (!activeInput) {
        console.warn('[WF Focus] Cannot find class input. Trying to click the focus pill as fallback.');
        const pills = Array.from(document.querySelectorAll(CONFIG.selectors.pillWrapper));
        const activePill = pills.find(p => getPillName(p) === focusedClass);
        if (activePill) {
            activePill.click();
            await new Promise(r => setTimeout(r, 300));
            activeInput = document.querySelector(CONFIG.selectors.input);
        }
    }

    if (!activeInput) {
        console.error('[WF Focus] Could not localize class input.');
        state.isBusy = false;
        return;
    }

    // CRITICAL: Blur to dismiss any autocomplete/"Recent" dropdown
    activeInput.blur();
    await new Promise(r => setTimeout(r, 250));

    const failedToRestore = [];

    for (const className of classesToRestore) {
        let success = false;

        for (let attempt = 0; attempt <= CONFIG.timing.maxRetries; attempt++) {
            // Re-acquire input in case Webflow re-rendered it
            activeInput = document.querySelector(CONFIG.selectors.input) || activeInput;

            if (attempt > 0) {
                console.log(`[WF Focus] Retry ${attempt}/${CONFIG.timing.maxRetries} for "${className}"...`);
                simulateFocus(activeInput);
                clearInput(activeInput);
                await new Promise(r => setTimeout(r, CONFIG.timing.retryDelay));
            }

            success = await restoreSingleClass(activeInput, className);
            if (success) break;
        }

        if (!success) {
            console.error(`[WF Focus] Failed to restore "${className}" after ${CONFIG.timing.maxRetries + 1} attempts.`);
            failedToRestore.push(className);
        }
    }

    if (failedToRestore.length > 0) {
        console.warn('[WF Focus] Some classes failed. Updating banner...');
        showShield(failedToRestore);
        state.isBusy = false;
        // Keep focusMode active so user can see the banner
        return;
    }

    console.log('[WF Focus] Restore complete. Final cleanup...');
    exitFocusMode();
    console.log('[WF Focus] Done. Pills:', getAllCurrentPillNames());
    state.isBusy = false;
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
    if (!isTopFrame || !state.settings.enabled || state.isBusy) {
        if (state.isBusy) console.log('[WF Focus] Operation in progress, ignoring focus request.');
        return;
    }

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

    state.isBusy = true;
    showShield();

    (async () => {
        for (const pill of pillsToRemove) {
            await removeClass(pill);
            await new Promise(r => setTimeout(r, 120));
        }
        const currentPills = Array.from(document.querySelectorAll(CONFIG.selectors.pillWrapper));
        const activeOne = currentPills.find(p => getPillName(p) === pillName);
        if (activeOne) activeOne.click();
        state.isBusy = false;
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

    console.log("[WF Focus] v0.2.1 Ready.");
}
