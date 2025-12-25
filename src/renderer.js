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
    if (activeTabId !== null) {
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

function closeTab(id) {
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    tabs.splice(index, 1);
    if (tabs.length === 0) {
        createTab('Untitled-1', null, '');
    } else if (activeTabId === id) {
        switchTab(tabs[Math.max(0, index - 1)].id);
    } else {
        renderTabs();
    }
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
});


editor.addEventListener('keyup', updateStatusBar);
editor.addEventListener('click', updateStatusBar);


async function handleOpenFile() {
    const file = await window.electronAPI.openFile();
    if (file) {
        const existing = tabs.find(t => t.path === file.path);
        if (existing) {
            switchTab(existing.id);
        } else {
            createTab(file.name, file.path, file.content);
        }
    }
}

async function handleSaveFile() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    const result = await window.electronAPI.saveFile(editor.value, activeTab.path);
    if (result) {
        activeTab.path = result.path;
        activeTab.name = result.name;
        activeTab.isDirty = false;
        filePathDisplay.textContent = result.path;
        renderTabs();
    }
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
document.getElementById('winClose').onclick = () => window.electronAPI.close();

// Menu Actions
document.getElementById('menuNew').onclick = () => createTab(`Untitled-${tabs.length + 1}`, null, '');
document.getElementById('menuOpen').onclick = () => handleOpenFile();
document.getElementById('menuSave').onclick = () => handleSaveFile();
document.getElementById('menuSaveAs').onclick = () => handleSaveFileAs();
document.getElementById('menuPreferences').onclick = () => togglePrefs(true);
document.getElementById('menuExit').onclick = () => window.electronAPI.close();

// Preferences Logic
const prefsPanel = document.getElementById('prefsPanel');
const prefsClose = document.getElementById('prefsClose');
const prefsReset = document.getElementById('prefsReset');
const colorInputs = prefsPanel.querySelectorAll('input[type="color"]');

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
            document.documentElement.style.setProperty(v, val);
        });
    }
}
loadPrefs();

// Initial tab
createTab('Untitled-1', null, '');

// Mouse wheel horizontal scroll for tabs
tabsContainer.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
        e.preventDefault();
        tabsContainer.scrollLeft += e.deltaY;
    }
});
