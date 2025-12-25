const editor = document.getElementById('editor');
const tabsContainer = document.getElementById('tabs');
const filePathDisplay = document.getElementById('filePathDisplay');
const cursorPosDisplay = document.getElementById('cursorPos');
const charCountDisplay = document.getElementById('charCount');


let tabs = [];
let activeTabId = null;

class Tab {
    constructor(name = 'Untitled', path = null, content = '') {
        this.id = Date.now() + Math.random();
        this.name = name;
        this.path = path;
        this.content = content;
        this.isDirty = false;
    }
}

function createTab(name, path, content) {
    const tab = new Tab(name, path, content);
    tabs.push(tab);
    renderTabs();
    switchTab(tab.id);
    saveAppState();
}

function saveAppState() {
    const sessionData = {
        tabs: tabs.map(t => ({
            name: t.name,
            path: t.path,
            content: t.id === activeTabId ? editor.value : t.content,
            isDirty: t.isDirty
        })),
        activeIndex: tabs.findIndex(t => t.id === activeTabId)
    };
    window.electronAPI.saveLastOpenFiles(sessionData);
}

function renderTabs() {
    tabsContainer.innerHTML = '';
    tabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
        tabEl.innerHTML = `
      <span class="tab__name">${tab.name}${tab.isDirty ? '*' : ''}</span>
      <span class="tab__close" data-id="${tab.id}"><i data-lucide="x"></i></span>
    `;
        tabEl.onclick = (e) => {
            if (e.target.closest('.tab__close')) {
                closeTab(tab.id);
            } else {
                switchTab(tab.id);
            }
        };
        tabsContainer.appendChild(tabEl);
    });

    // Add "+" button
    const addBtn = document.createElement('div');
    addBtn.className = 'tabs__add';
    addBtn.innerHTML = '<i data-lucide="plus"></i>';
    addBtn.title = 'New File (Ctrl+N)';
    addBtn.onclick = () => createTab(`Untitled-${tabs.length + 1}`, null, '');
    tabsContainer.appendChild(addBtn);

    // Initialise Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

function switchTab(id) {
    // Save current content to active tab before switching
    if (activeTabId !== null && activeTabId !== id) {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) currentTab.content = editor.value;
    }

    activeTabId = id;
    const activeTab = tabs.find(t => t.id === id);
    if (activeTab) {
        editor.value = activeTab.content;
        filePathDisplay.textContent = activeTab.path || activeTab.name;
        updateStatusBar();
        editor.focus();
    }
    renderTabs();
}

async function closeTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;

    if (tab.isDirty) {
        const response = await showCustomModal(
            'Unsaved Changes',
            `Do you want to save changes to ${tab.name}?`
        );

        if (response === 0) { // Save
            const saved = await handleSaveFile(tab);
            if (!saved) return;
        } else if (response === 2) { // Cancel
            return;
        }
        // response === 1 is "Don't Save", which proceeds to close
    }

    const index = tabs.findIndex(t => t.id === id);
    tabs.splice(index, 1);

    if (tabs.length === 0) {
        createTab('Untitled-1', null, '');
    } else if (activeTabId === id) {
        switchTab(tabs[Math.max(0, index - 1)].id);
    } else {
        renderTabs();
    }
    saveAppState();
}


function updateStatusBar() {
    const text = editor.value;
    const lines = text.substr(0, editor.selectionStart).split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    cursorPosDisplay.textContent = `Ln ${line}, Col ${col}`;
    charCountDisplay.textContent = `${text.length} characters`;
}

// Event Listeners
editor.addEventListener('input', () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
        activeTab.isDirty = true;
        activeTab.content = editor.value;
    }
    updateStatusBar();
    renderTabs();
    saveAppState();
});


editor.addEventListener('keyup', updateStatusBar);
editor.addEventListener('click', updateStatusBar);


async function handleOpenFile() {
    const file = await window.electronAPI.openFile();
    if (file) {
        handleFileOpen(file);
    }
}

async function handleSaveFile(tabToSave) {
    const tab = tabToSave || tabs.find(t => t.id === activeTabId);
    if (!tab) return false;

    const content = (tab.id === activeTabId) ? editor.value : tab.content;
    const result = await window.electronAPI.saveFile(content, tab.path);

    if (result) {
        tab.path = result.path;
        tab.name = result.name;
        tab.isDirty = false;
        if (tab.id === activeTabId) {
            filePathDisplay.textContent = result.path;
        }
        renderTabs();
        saveAppState();
        return true;
    }
    return false;
}

async function handleSaveFileAs() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    const result = await window.electronAPI.saveFileAs(editor.value);
    if (result) {
        activeTab.path = result.path;
        activeTab.name = result.name;
        activeTab.isDirty = false;
        filePathDisplay.textContent = result.path;
        renderTabs();
    }
}

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
        if (e.key === 's') {
            e.preventDefault();
            if (e.shiftKey) {
                handleSaveFileAs();
            } else {
                handleSaveFile();
            }
        } else if (e.key === 'o') {
            e.preventDefault();
            handleOpenFile();
        } else if (e.key === 'n') {
            e.preventDefault();
            createTab(`Untitled-${tabs.length + 1}`, null, '');
        } else if (e.key === 'w') {
            e.preventDefault();
            closeTab(activeTabId);
        }
    }
});

// Window Controls
document.getElementById('winMinimize').onclick = () => window.electronAPI.minimize();
document.getElementById('winMaximize').onclick = () => window.electronAPI.maximize();
document.getElementById('winClose').onclick = () => handleExit();

async function handleExit() {
    const tabsToProcess = [...tabs];
    for (const tab of tabsToProcess) {
        if (tab.isDirty) {
            switchTab(tab.id);
            await closeTab(tab.id);
            if (tabs.find(t => t.id === tab.id)) return;
        }
    }
    saveAppState();
    window.electronAPI.close();
}

// Menu Actions
document.getElementById('menuNew').onclick = () => createTab(`Untitled-${tabs.length + 1}`, null, '');
document.getElementById('menuOpen').onclick = () => handleOpenFile();
document.getElementById('menuSave').onclick = () => handleSaveFile();
document.getElementById('menuSaveAs').onclick = () => handleSaveFileAs();
document.getElementById('menuWordWrap').onclick = () => toggleWordWrap();
document.getElementById('menuPreferences').onclick = () => togglePrefs(true);
document.getElementById('menuExit').onclick = () => handleExit();

// Word Wrap Logic
let isWordWrap = false;
async function toggleWordWrap(val) {
    if (val !== undefined) isWordWrap = val;
    else isWordWrap = !isWordWrap;

    editor.style.whiteSpace = isWordWrap ? 'pre-wrap' : 'pre';
    editor.style.wordBreak = isWordWrap ? 'break-word' : 'normal';
    document.getElementById('menuWordWrap').textContent = `Word Wrap: ${isWordWrap ? 'ON' : 'OFF'}`;

    const config = await window.electronAPI.getConfig();
    const theme = config.theme || {};
    theme.wordWrap = isWordWrap;
    await window.electronAPI.saveThemeConfig(theme);
}

// Preferences Logic
const prefsPanel = document.getElementById('prefsPanel');
const prefsClose = document.getElementById('prefsClose');
const prefsReset = document.getElementById('prefsReset');
const colorInputs = prefsPanel.querySelectorAll('input[type="color"]');

// Custom Modal Logic
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalSave = document.getElementById('modalSave');
const modalDontSave = document.getElementById('modalDontSave');
const modalCancel = document.getElementById('modalCancel');

function showCustomModal(title, msg) {
    return new Promise((resolve) => {
        modalTitle.textContent = title;
        modalMessage.textContent = msg;
        modalOverlay.classList.remove('modal-overlay--hidden');

        const cleanup = (val) => {
            modalSave.onclick = null;
            modalDontSave.onclick = null;
            modalCancel.onclick = null;
            modalOverlay.classList.add('modal-overlay--hidden');
            resolve(val);
        };

        modalSave.onclick = () => cleanup(0);
        modalDontSave.onclick = () => cleanup(1);
        modalCancel.onclick = () => cleanup(2);
    });
}

async function saveTheme(varName, val) {
    const config = await window.electronAPI.getConfig();
    const theme = config.theme || {};
    theme[varName] = val;
    await window.electronAPI.saveThemeConfig(theme);
}

function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
    if (!match) return '#000000';
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function togglePrefs(show) {
    if (show) {
        prefsPanel.classList.remove('prefs-panel--hidden');
        // Set current values to inputs
        colorInputs.forEach(input => {
            const varName = input.dataset.var;
            const currentVal = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            input.value = rgbToHex(currentVal);
        });
    } else {
        prefsPanel.classList.add('prefs-panel--hidden');
    }
}

prefsClose.onclick = () => togglePrefs(false);

colorInputs.forEach(input => {
    input.oninput = (e) => {
        const varName = e.target.dataset.var;
        const newVal = e.target.value;
        document.documentElement.style.setProperty(varName, newVal);
        saveTheme(varName, newVal);
    };
});

prefsReset.onclick = async () => {
    const defaults = {
        '--bg0': '#111111',
        '--panel': '#181818',
        '--accent': '#d8d8d8',
        '--text': '#eeeeee',
        '--titlebar-bg': '#0f0f0f',
        '--topbar-bg': '#131313',
        '--statusbar-bg': '#131313',
        '--tab-bg': '#151515',
        '--tab-active-bg': '#181818'
    };
    Object.entries(defaults).forEach(([varName, val]) => {
        document.documentElement.style.setProperty(varName, val);
    });
    await window.electronAPI.saveThemeConfig({}); // Clear theme in JSON
    togglePrefs(true);
};

// Load saved preferences from main config
async function loadPrefs() {
    const config = await window.electronAPI.getConfig();
    if (config.theme) {
        Object.entries(config.theme).forEach(([v, val]) => {
            if (v === 'wordWrap') {
                toggleWordWrap(val);
            } else {
                document.documentElement.style.setProperty(v, val);
            }
        });
    }
}
async function restoreSession() {
    const config = await window.electronAPI.getConfig();
    const session = config.lastOpenFiles;

    if (session && session.tabs && session.tabs.length > 0) {
        tabs = []; // Clear initial
        session.tabs.forEach(tData => {
            const tab = new Tab(tData.name, tData.path, tData.content);
            tab.isDirty = tData.isDirty;
            tabs.push(tab);
        });
        renderTabs();
        const bIndex = session.activeIndex >= 0 ? session.activeIndex : 0;
        switchTab(tabs[bIndex].id);
    } else {
        createTab('Untitled-1', null, '');
    }
}

loadPrefs();
restoreSession();

// Mouse wheel horizontal scroll for tabs
tabsContainer.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
        e.preventDefault();
        tabsContainer.scrollLeft += e.deltaY;
    }
});

// File opening logic (shared)
function handleFileOpen(file) {
    if (!file) return;
    const existing = tabs.find(t => t.path === file.path);
    if (existing) {
        switchTab(existing.id);
        return;
    }

    // Polish: If we only have the initial empty tab, replace it instead of opening a second tab
    if (tabs.length === 1 && !tabs[0].path && !tabs[0].isDirty && tabs[0].content === '') {
        const tab = tabs[0];
        tab.name = file.name;
        tab.path = file.path;
        tab.content = file.content;
        switchTab(tab.id);
    } else {
        createTab(file.name, file.path, file.content);
    }
    saveAppState();
}

// Handle files opened from OS
window.electronAPI.onExternalFileOpen((file) => handleFileOpen(file));

// Drag and Drop (Global)
const preventDefault = (e) => {
    e.preventDefault();
    e.stopPropagation();
};

window.addEventListener('dragover', (e) => {
    preventDefault(e);
    document.body.style.opacity = '0.7'; // Visual hint
}, false);

window.addEventListener('dragleave', (e) => {
    preventDefault(e);
    document.body.style.opacity = '1';
}, false);

window.addEventListener('drop', async (e) => {
    preventDefault(e);
    document.body.style.opacity = '1';

    const files = e.dataTransfer.files;
    console.log(`Dropped ${files.length} files`);

    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = window.electronAPI.getFilePath(f);

        console.log('Detected file path:', path);

        if (path) {
            const fileContent = await window.electronAPI.readFile(path);
            handleFileOpen(fileContent);
        }
    }
}, false);
