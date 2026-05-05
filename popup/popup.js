const DEFAULTS = {
    enabled: true,
    opacity: 10
};

const BREVO_API_KEY = WF_CONFIG.brevoApiKey;
const BREVO_LIST_ID = WF_CONFIG.brevoListId;

async function registerEmail(email) {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': BREVO_API_KEY
        },
        body: JSON.stringify({
            email,
            listIds: [BREVO_LIST_ID],
            updateEnabled: true
        })
    });
    if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}));
        // Contact already exists is fine (code 400 with "Contact already exist")
        if (data.code !== 'duplicate_parameter') throw new Error('Brevo error');
    }
}

function showMain() {
    document.getElementById('onboardingScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'block';
}

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

function initMainScreen() {
    const toggle = document.getElementById('extensionActive');
    const opacitySlider = document.getElementById('overlayOpacity');
    const opacityVal = document.getElementById('opacityVal');
    const resetBtn = document.getElementById('resetDefaults');

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

    chrome.storage.onChanged.addListener(() => {
        chrome.storage.local.get(
            { focusActive: false, removedClasses: [], focusedClass: null },
            (result) => {
                if (chrome.runtime.lastError) return;
                renderFocusTracker(result.focusActive, result.removedClasses, result.focusedClass);
            }
        );
    });

    toggle.addEventListener('change', () => {
        chrome.storage.local.set({ enabled: toggle.checked });
    });

    opacitySlider.addEventListener('input', () => {
        opacityVal.textContent = `${opacitySlider.value}%`;
        chrome.storage.local.set({ opacity: parseInt(opacitySlider.value) });
    });

    resetBtn.addEventListener('click', () => {
        chrome.storage.local.set(DEFAULTS, () => {
            if (chrome.runtime.lastError) return;
            toggle.checked = DEFAULTS.enabled;
            opacitySlider.value = DEFAULTS.opacity;
            opacityVal.textContent = `${DEFAULTS.opacity}%`;
        });
    });
}

function initOnboarding() {
    const activateBtn = document.getElementById('activateBtn');
    const emailInput = document.getElementById('emailInput');
    const errorEl = document.getElementById('activateError');

    activateBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        if (!isValid) {
            errorEl.style.display = 'block';
            return;
        }

        errorEl.style.display = 'none';
        activateBtn.disabled = true;
        activateBtn.textContent = 'Activating...';

        try {
            await registerEmail(email);
            chrome.storage.local.set({ activated: true }, () => {
                showMain();
                initMainScreen();
            });
        } catch {
            activateBtn.disabled = false;
            activateBtn.textContent = 'Activate for free';
            errorEl.textContent = 'Something went wrong. Please try again.';
            errorEl.style.display = 'block';
        }
    });

    emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') activateBtn.click();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get({ activated: false }, (result) => {
        if (result.activated) {
            showMain();
            initMainScreen();
        } else {
            initOnboarding();
        }
    });
});
