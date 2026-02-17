chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_BADGE') {
        chrome.storage.local.get(['showBadge'], (result) => {
            if (result.showBadge === false) {
                chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
                return;
            }

            if (request.status === 'active') {
                chrome.action.setBadgeText({ text: 'ON', tabId: sender.tab.id });
                chrome.action.setBadgeBackgroundColor({ color: '#ff9100', tabId: sender.tab.id });
            } else {
                chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
            }
        });
    }
});
