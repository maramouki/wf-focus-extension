/* WF Focus - v1.0.0 */

const DEBUG = false;
const log  = (...a) => DEBUG && console.log('[WF Focus]', ...a);
const warn = (...a) => DEBUG && console.warn('[WF Focus]', ...a);

const CONFIG = {
    selectors: {
        pillWrapper: '[data-automation-id="style-rule-token-wrapper"]',
        pillText: '[data-automation-id="style-rule-token-text-editable"], [data-automation-id="style-rule-token-text"]',
        input: 'input[data-automation-id="css-token-input"]',
        rightSidebar: [
            '[data-automation-id="designer-right-sidebar"]',
            '.designer-right-sidebar',
            '#style-panel',
            '.right-sidebar',
            '[data-automation-id="style-panel"]'
        ]
    },
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

const isTopFrame = window.top === window.self;

// --- Persistence & Sync ---

if (isTopFrame) {
    chrome.storage.local.get(['enabled', 'opacity'], (result) => {
        state.settings.enabled = result.enabled !== false;
        state.settings.opacity = result.opacity !== undefined ? result.opacity : 10;
        initListeners();
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.enabled) state.settings.enabled = changes.enabled.newValue;
        if (changes.opacity) {
            state.settings.opacity = changes.opacity.newValue;
            if (state.overlayElement) {
                state.overlayElement.style.background = `rgba(0,0,0,${state.settings.opacity / 100})`;
            }
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

function simulatePaste(input, text) {
    input.focus();
    input.select();
    const success = document.execCommand('insertText', false, text);
    if (!success) {
        warn('execCommand insertText failed, falling back to direct value assignment.');
        input.value = text;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- UI Logic ---

function computeMaskBoundary() {
    let boundary = window.innerWidth - 300;
    for (const sel of CONFIG.selectors.rightSidebar) {
        const sidebar = document.querySelector(sel);
        if (sidebar && sidebar.offsetWidth > 0) {
            const rect = sidebar.getBoundingClientRect();
            if (rect.left > 0) {
                log('Sidebar localized at:', rect.left);
                return rect.left;
            }
        }
    }
    warn('Sidebar NOT found. Using 300px fallback.');
    return boundary;
}

function buildToastBanner(failedClasses = []) {
    const isFailed = failedClasses.length > 0;
    const classes = isFailed ? failedClasses : state.removedClasses;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #fffafa;
        border: 2px solid #ff9100;
        border-radius: 24px;
        padding: 14px 20px;
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
        width: 36px; height: 36px; background: #ff9100; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        color: white; font-size: 18px; flex-shrink: 0;
    `;
    iconContainer.textContent = isFailed ? '⚠' : '!';

    const textWrapper = document.createElement('div');
    textWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px; min-width: 0;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 700; color: #1a1a1a; font-size: 15px;';
    title.textContent = isFailed ? 'Manual Restore Needed' : 'Focus Mode Active';

    const instructions = document.createElement('div');
    instructions.style.cssText = 'color: #888; font-size: 12px;';
    instructions.textContent = isFailed
        ? 'These classes could not be restored automatically'
        : 'Shift + Click active pill or ESC to restore';

    topRow.appendChild(title);
    topRow.appendChild(instructions);
    textWrapper.appendChild(topRow);

    if (classes.length > 0) {
        const pillContainer = document.createElement('div');
        pillContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 5px;';

        classes.forEach((name, i) => {
            const pill = document.createElement('span');
            pill.style.cssText = `
                background: #fff8f0; border: 1px dashed #ff9100; color: #e07800;
                padding: 3px 10px; border-radius: 14px; font-size: 11px;
                font-weight: 600; white-space: nowrap;
            `;
            pill.textContent = `${i + 1}. ${name}`;
            pillContainer.appendChild(pill);
        });

        textWrapper.appendChild(pillContainer);
    }

    const restoreBtn = document.createElement('button');
    restoreBtn.style.cssText = `
        margin-left: 8px; background: #ff9100; color: white; border: none;
        padding: 10px 20px; border-radius: 18px; font-weight: 600; font-size: 13px;
        cursor: pointer; transition: .2s; box-shadow: 0 4px 12px rgba(255,145,0,0.2);
        flex-shrink: 0;
    `;
    restoreBtn.textContent = isFailed ? 'Got it' : 'Restore';
    restoreBtn.onclick = (e) => {
        e.stopPropagation();
        if (isFailed) {
            exitFocusMode();
        } else {
            restoreClasses();
        }
    };

    toast.appendChild(iconContainer);
    toast.appendChild(textWrapper);
    toast.appendChild(restoreBtn);
    return toast;
}

function showShield(failedClasses = []) {
    if (!isTopFrame) return;

    const stale = document.getElementById('wf-extension-global-mask');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'wf-extension-global-mask';

    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 1000000; background: rgba(0,0,0,${state.settings.opacity / 100});
        pointer-events: auto; cursor: not-allowed;
        display: flex; flex-direction: column; align-items: center;
        justify-content: flex-start; padding-top: 40px; transition: background 0.3s;
    `;

    const maskBoundary = computeMaskBoundary();
    overlay.style.clipPath = `polygon(0% 0%, 0% 100%, ${maskBoundary}px 100%, ${maskBoundary}px 0%)`;

    overlay.appendChild(buildToastBanner(failedClasses));

    if (!document.getElementById('wf-focus-styles')) {
        const style = document.createElement('style');
        style.id = 'wf-focus-styles';
        style.textContent = `
            @keyframes wf-slide-down {
                from { opacity: 0; transform: translateY(-50px); }
                to   { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    state.overlayElement = overlay;
}

function hideShield() {
    const el = state.overlayElement || document.getElementById('wf-extension-global-mask');
    if (el) el.remove();
    state.overlayElement = null;
}

// --- Core ---

async function removeClass(pillElement) {
    pillElement.click();
    await new Promise(r => setTimeout(r, 100));
    const input = document.querySelector(CONFIG.selectors.input);
    if (input) {
        simulateFocus(input);
        await new Promise(r => setTimeout(r, 60));
        simulateBackspace(input);
    }
}

async function removeWrongClass(wrongClassName) {
    const pills = Array.from(document.querySelectorAll(CONFIG.selectors.pillWrapper));
    const wrongPill = pills.find(p => getPillName(p) === wrongClassName);
    if (wrongPill) {
        log(`Removing wrong class "${wrongClassName}"...`);
        await removeClass(wrongPill);
        await new Promise(r => setTimeout(r, 400));
    }
}

async function restoreSingleClass(input, className) {
    const pillsBefore = getAllCurrentPillNames();

    if (pillsBefore.includes(className)) {
        log(`"${className}" already exists, skipping.`);
        return true;
    }

    simulateFocus(input);
    clearInput(input);
    await new Promise(r => setTimeout(r, CONFIG.timing.beforeType));

    log(`Pasting "${className}"...`);
    simulatePaste(input, className);

    await new Promise(r => setTimeout(r, 100));
    simulateEnter(input);
    await new Promise(r => setTimeout(r, CONFIG.timing.afterSelect));

    const pillsAfter = getAllCurrentPillNames();
    const wasAdded = pillsAfter.includes(className);

    const newlyAdded = pillsAfter.filter(p => !pillsBefore.includes(p));
    const wrongClasses = newlyAdded.filter(p => p !== className);

    if (wrongClasses.length > 0) {
        warn(`Wrong class(es) added: [${wrongClasses.join(', ')}]. Removing...`);
        for (const wrong of wrongClasses) {
            await removeWrongClass(wrong);
        }
    }

    if (wasAdded) {
        log(`✓ Restored "${className}".`);
    } else {
        warn(`✗ "${className}" not found after paste attempt.`);
    }

    return wasAdded;
}

async function restoreClasses() {
    if (!isTopFrame || !state.isFocusMode || state.isBusy) {
        if (state.isBusy) log('Operation in progress, ignoring restore request.');
        if (!state.isFocusMode && !state.isBusy) exitFocusMode();
        return;
    }

    state.isBusy = true;

    try {
        const input = document.querySelector(CONFIG.selectors.input);
        if (!input) {
            warn('Cannot restore: Input field not found.');
            exitFocusMode();
            return;
        }

        const classesToRestore = [...state.removedClasses];
        const focusedClass = state.focusedClassName;
        log('Restoring classes:', classesToRestore);

        const inputWrapper =
            document.querySelector('[data-automation-id="css-token-input-wrapper"]') ||
            document.querySelector(CONFIG.selectors.input)?.parentElement;

        if (inputWrapper) {
            log('Clicking input wrapper to reset context...');
            inputWrapper.click();
            await new Promise(r => setTimeout(r, 100));
        }

        let activeInput = document.querySelector(CONFIG.selectors.input);
        if (!activeInput) {
            warn('Cannot find class input. Trying to click the focus pill as fallback.');
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
            return;
        }

        activeInput.blur();
        await new Promise(r => setTimeout(r, 250));

        const failedToRestore = [];

        for (const className of classesToRestore) {
            let success = false;

            for (let attempt = 0; attempt <= CONFIG.timing.maxRetries; attempt++) {
                // Re-acquire input only if a fresh connected element is available
                const freshInput = document.querySelector(CONFIG.selectors.input);
                if (freshInput && freshInput.isConnected) activeInput = freshInput;

                if (attempt > 0) {
                    log(`Retry ${attempt}/${CONFIG.timing.maxRetries} for "${className}"...`);
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

            // Update popup tracker: remove restored class from the pending list
            if (success) {
                const remaining = state.removedClasses.filter(c => c !== className);
                state.removedClasses = remaining;
                chrome.storage.local.set({ removedClasses: remaining });
            }
        }

        if (failedToRestore.length > 0) {
            warn('Some classes failed. Updating banner...');
            showShield(failedToRestore);
            return;
        }

        log('Restore complete. Final cleanup...');
        exitFocusMode();
        log('Done. Pills:', getAllCurrentPillNames());
    } finally {
        state.isBusy = false;
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
    chrome.storage.local.set({ focusActive: false, removedClasses: [], focusedClass: null });
}

function enterFocusMode(targetPill) {
    if (!isTopFrame || !state.settings.enabled || state.isBusy) {
        if (state.isBusy) log('Operation in progress, ignoring focus request.');
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

    chrome.storage.local.set({
        focusActive: true,
        removedClasses: classesToRemove,
        focusedClass: pillName
    });

    (async () => {
        try {
            for (const pill of pillsToRemove) {
                await removeClass(pill);
                await new Promise(r => setTimeout(r, 120));
            }
            const currentPills = Array.from(document.querySelectorAll(CONFIG.selectors.pillWrapper));
            const activeOne = currentPills.find(p => getPillName(p) === pillName);
            if (activeOne) activeOne.click();
        } finally {
            state.isBusy = false;
        }
    })();
}

// --- Listeners ---

function initListeners() {
    document.addEventListener('keydown', (e) => {
        if (!state.settings.enabled) return;
        if (e.key === 'Escape' && state.isFocusMode) {
            e.preventDefault();
            e.stopPropagation();
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
                    e.preventDefault();
                    e.stopPropagation();
                    restoreClasses();
                } else if (!state.isFocusMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    enterFocusMode(pill);
                }
            }
        }
    }, true);

    log('v1.0.0 Ready.');
}
