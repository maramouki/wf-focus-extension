const DEFAULTS = {
    enabled: true,
    opacity: 10,
    showBadge: true
};

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('extensionActive');
    const opacitySlider = document.getElementById('overlayOpacity');
    const opacityVal = document.getElementById('opacityVal');
    const badgeToggle = document.getElementById('showBadge');
    const resetBtn = document.getElementById('resetDefaults');

    // Load state
    chrome.storage.local.get(DEFAULTS, (result) => {
        toggle.checked = result.enabled;
        opacitySlider.value = result.opacity;
        opacityVal.textContent = `${result.opacity}%`;
        badgeToggle.checked = result.showBadge;
    });

    // Save Active State
    toggle.addEventListener('change', () => {
        chrome.storage.local.set({ enabled: toggle.checked });
    });

    // Save Opacity
    opacitySlider.addEventListener('input', () => {
        opacityVal.textContent = `${opacitySlider.value}%`;
        chrome.storage.local.set({ opacity: parseInt(opacitySlider.value) });
    });

    // Save Badge State
    badgeToggle.addEventListener('change', () => {
        chrome.storage.local.set({ showBadge: badgeToggle.checked });
    });

    // Reset
    resetBtn.addEventListener('click', () => {
        chrome.storage.local.set(DEFAULTS, () => {
            toggle.checked = DEFAULTS.enabled;
            opacitySlider.value = DEFAULTS.opacity;
            opacityVal.textContent = `${DEFAULTS.opacity}%`;
            badgeToggle.checked = DEFAULTS.showBadge;
        });
    });
});
