const DEFAULTS = {
    enabled: true,
    opacity: 10
};

function renderFocusTracker(focusActive, removedClasses, focusedClass) {
    const tracker = document.getElementById('focusTracker');
    const classNameEl = document.getElementById('focusedClassName');
    const classList = document.getElementById('focusClassList');

    if (!focusActive || !removedClasses || removedClasses.length === 0) {
        tracker.style.display = 'none';
        return;
    }

    classNameEl.textContent = focusedClass ? `.${focusedClass}` : '';
    classList.innerHTML = '';

    removedClasses.forEach((name, i) => {
        const row = document.createElement('div');
        row.className = 'focus-pill';

        const index = document.createElement('span');
        index.className = 'focus-pill-index';
        index.textContent = `${i + 1}.`;

        const pill = document.createElement('span');
        pill.className = 'focus-pill-name';
        pill.textContent = name;

        row.appendChild(index);
        row.appendChild(pill);
        classList.appendChild(row);
    });

    tracker.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('extensionActive');
    const opacitySlider = document.getElementById('overlayOpacity');
    const opacityVal = document.getElementById('opacityVal');
    const resetBtn = document.getElementById('resetDefaults');

    // Load settings + focus state
    chrome.storage.local.get(
        { ...DEFAULTS, focusActive: false, removedClasses: [], focusedClass: null },
        (result) => {
            if (chrome.runtime.lastError) return;
            toggle.checked = result.enabled;
            opacitySlider.value = result.opacity;
            opacityVal.textContent = `${result.opacity}%`;
            renderFocusTracker(result.focusActive, result.removedClasses, result.focusedClass);
        }
    );

    // Listen for real-time changes (focus state updated by content.js)
    chrome.storage.onChanged.addListener((changes) => {
        chrome.storage.local.get(
            { focusActive: false, removedClasses: [], focusedClass: null },
            (result) => {
                if (chrome.runtime.lastError) return;
                renderFocusTracker(result.focusActive, result.removedClasses, result.focusedClass);
            }
        );
    });

    // Save Active State
    toggle.addEventListener('change', () => {
        chrome.storage.local.set({ enabled: toggle.checked }, () => {
            if (chrome.runtime.lastError) console.error('[WF Focus Popup] Storage error:', chrome.runtime.lastError);
        });
    });

    // Save Opacity
    opacitySlider.addEventListener('input', () => {
        opacityVal.textContent = `${opacitySlider.value}%`;
        chrome.storage.local.set({ opacity: parseInt(opacitySlider.value) }, () => {
            if (chrome.runtime.lastError) console.error('[WF Focus Popup] Storage error:', chrome.runtime.lastError);
        });
    });

    // Reset
    resetBtn.addEventListener('click', () => {
        chrome.storage.local.set(DEFAULTS, () => {
            if (chrome.runtime.lastError) {
                console.error('[WF Focus Popup] Storage error:', chrome.runtime.lastError);
                return;
            }
            toggle.checked = DEFAULTS.enabled;
            opacitySlider.value = DEFAULTS.opacity;
            opacityVal.textContent = `${DEFAULTS.opacity}%`;
        });
    });
});
