const editor = document.getElementById('editor');
const tabsContainer = document.getElementById('tabs');
const filePathDisplay = document.getElementById('filePathDisplay');
const cursorPosDisplay = document.getElementById('cursorPos');
const charCountDisplay = document.getElementById('charCount');
const btnPreviewFull = document.getElementById('btnPreviewFull');
const btnPreviewSplit = document.getElementById('btnPreviewSplit');
const previewContainer = document.getElementById('preview');
const previewInner = document.getElementById('previewInner');
const editorControls = document.getElementById('editorControls');
const encodingDisplay = document.getElementById('encodingDisplay');
const appContainer = document.querySelector('.app');


const btnQuickSettings = document.getElementById('btnQuickSettings');
const settingsPopover = document.getElementById('settingsPopover');
const zoomSlider = document.getElementById('zoomSlider');
const zoomValue = document.getElementById('zoomValue');
const checkWordWrap = document.getElementById('checkWordWrap');

let tabs = [];
let activeTabId = null;
let currentZoom = 100;

class Tab {
    constructor(name = 'Untitled', path = null, content = '') {
        this.id = Date.now() + Math.random();
        this.name = name;
        this.path = path;
        this.content = content;
        this.isDirty = false;
        this.cursorStart = 0;
        this.cursorEnd = 0;
        this.markdownMode = false;
        this.previewMode = 'off';
        this.encoding = 'UTF-8';
    }
}

function createTab(name, path, content, encoding = 'UTF-8') {
    const tab = new Tab(name, path, content);
    tab.encoding = encoding;
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
            isDirty: t.isDirty,
            markdownMode: t.markdownMode,
            previewMode: t.previewMode,
            encoding: t.encoding
        })),
        activeIndex: tabs.findIndex(t => t.id === activeTabId)
    };
    window.electronAPI.saveLastOpenFiles(sessionData);
}

let draggedTabIndex = null;

function renderTabs() {
    tabsContainer.innerHTML = '';
    tabs.forEach((tab, index) => {
        const tabEl = document.createElement('div');
        tabEl.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
        tabEl.draggable = true;
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

        // Drag and Drop reordering
        tabEl.ondragstart = (e) => {
            draggedTabIndex = index;
            tabEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Set a custom drag image if needed, or rely on browser default
        };

        tabEl.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // Calculate mouse position relative to tab center
            const rect = tabEl.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            const isRight = e.clientX > midpoint;

            // Remove previous classes
            tabEl.classList.remove('drag-over-left', 'drag-over-right');

            // Apply specific directional class
            if (isRight) {
                tabEl.classList.add('drag-over-right');
            } else {
                tabEl.classList.add('drag-over-left');
            }
        };

        tabEl.ondragleave = () => {
            tabEl.classList.remove('drag-over-left', 'drag-over-right');
        };

        tabEl.ondrop = (e) => {
            e.preventDefault();
            tabEl.classList.remove('drag-over-left', 'drag-over-right');

            if (draggedTabIndex !== null && draggedTabIndex !== index) {
                const rect = tabEl.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                const dropRight = e.clientX > midpoint;

                // Determine new index
                // Determine new index
                let insertionIndex = index;
                if (dropRight) insertionIndex++;

                // Adjust for removing the element from earlier in the array
                if (draggedTabIndex < insertionIndex) {
                    insertionIndex--;
                }

                // Safety check and execution
                if (draggedTabIndex >= 0 && draggedTabIndex < tabs.length) {
                    const [draggedTab] = tabs.splice(draggedTabIndex, 1);
                    if (draggedTab) {
                        tabs.splice(insertionIndex, 0, draggedTab);
                        renderTabs();
                        saveAppState();
                    }
                }
                draggedTabIndex = null;
            }
        };

        tabEl.ondragend = () => {
            tabEl.classList.remove('dragging');
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over-left', 'drag-over-right'));
            draggedTabIndex = null;
        };

        tabsContainer.appendChild(tabEl);
    });

    // Add "+" button
    const addBtn = document.createElement('div');
    addBtn.className = 'tabs__add';
    addBtn.innerHTML = '<i data-lucide="plus"></i>';
    addBtn.setAttribute('data-tooltip', 'New File (Ctrl+N)');
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
        if (currentTab) {
            currentTab.content = editor.value;
            // Save cursor position
            currentTab.cursorStart = editor.selectionStart;
            currentTab.cursorEnd = editor.selectionEnd;
        }
    }

    activeTabId = id;
    const activeTab = tabs.find(t => t.id === id);
    if (activeTab) {
        editor.value = activeTab.content;
        filePathDisplay.textContent = activeTab.path || activeTab.name;

        // Restore cursor position
        editor.selectionStart = activeTab.cursorStart || 0;
        editor.selectionEnd = activeTab.cursorEnd || 0;

        updateStatusBar();
        encodingDisplay.textContent = activeTab.encoding || 'UTF-8';
        updatePreview();
        checkMarkdownMode();
        setPreviewMode(activeTab.previewMode || 'off', true); // Pass 'true' to avoid toggling
        editor.focus();
    }
    renderTabs();
}

function checkMarkdownMode() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    // 1. Check extension
    const isMdExt = activeTab.path && /\.(md|markdown|mdown)$/i.test(activeTab.path);

    // 2. Check content heuristics if not already detected
    if (isMdExt) {
        activeTab.markdownMode = true;
    } else if (!activeTab.markdownMode) {
        const content = editor.value;
        const mdPattern = /(^#\s|(\*\*|__)[^*_]+(\*\*|__)|\[.+\]\(.+\)|^[-*]\s|^>\s|`[^`]+`)/m;
        if (mdPattern.test(content)) {
            activeTab.markdownMode = true;
        }
    }

    // Update UI
    if (activeTab.markdownMode) {
        editorControls.classList.remove('editor-controls--hidden');
    } else {
        editorControls.classList.add('editor-controls--hidden');
    }
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
    checkMarkdownMode();
    if (previewMode !== 'off') {
        updatePreview();
    }
});

// Handle Tab key indention
editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();

        // Using execCommand ensures the action is added to the undo stack
        if (!document.execCommand('insertText', false, '\t')) {
            // Fallback for environments where execCommand might not work
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = editor.value.substring(0, start) + "\t" + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 1;
            editor.dispatchEvent(new Event('input'));
        }
    }
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
        checkMarkdownMode();
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
        checkMarkdownMode();
    }
}

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === 's') {
            e.preventDefault();
            if (e.shiftKey) {
                handleSaveFileAs();
            } else {
                handleSaveFile();
            }
        } else if (key === 'o') {
            e.preventDefault();
            handleOpenFile();
        } else if (key === 'n') {
            e.preventDefault();
            createTab(`Untitled-${tabs.length + 1}`, null, '');
        } else if (key === 'w') {
            e.preventDefault();
            closeTab(activeTabId);
        } else if (key === 'f') {
            e.preventDefault();
            toggleSearch(false);
        } else if (key === 'h') {
            e.preventDefault();
            toggleSearch(true);
        } else if (e.shiftKey && key === 'e') {
            e.preventDefault();
            toggleEmojiPicker();
        }
    } else if (e.altKey) {
        if (e.key.toLowerCase() === 'p') {
            e.preventDefault();
            togglePrefs(true);
        }
    } else if (e.key === 'Escape') {
        hideSearch();
        hideEmojiPicker();
    } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) findPrev();
        else findNext();
    }
});

// Window Controls
document.getElementById('winMinimize').onclick = () => window.electronAPI.minimize();
document.getElementById('winMaximize').onclick = () => window.electronAPI.maximize();
document.getElementById('winClose').onclick = () => handleExit();

// Markdown Preview Logic
let previewMode = 'off'; // Global fallback

function updatePreview() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.previewMode === 'off') return;

    const content = editor.value;
    if (window.marked) {
        previewInner.innerHTML = marked.parse(content);
    }
}

function setPreviewMode(mode, forceState = false) {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    if (!forceState) {
        if (activeTab.previewMode === mode) {
            activeTab.previewMode = 'off';
        } else {
            activeTab.previewMode = mode;
        }
    } else {
        activeTab.previewMode = mode;
    }

    // Update global for backward compatibility if needed, but we mainly use tab state now
    previewMode = activeTab.previewMode;

    // Update UI classes
    appContainer.classList.remove('app--preview-full', 'app--preview-split');
    btnPreviewFull.classList.remove('active');
    btnPreviewSplit.classList.remove('active');

    if (activeTab.previewMode === 'full') {
        appContainer.classList.add('app--preview-full');
        btnPreviewFull.classList.add('active');
        updatePreview();
    } else if (activeTab.previewMode === 'split') {
        appContainer.classList.add('app--preview-split');
        btnPreviewSplit.classList.add('active');
        updatePreview();
    }
}

btnPreviewFull.onclick = () => setPreviewMode('full');
btnPreviewSplit.onclick = () => setPreviewMode('split');

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
document.getElementById('menuPreferences').onclick = () => togglePrefs(true);
document.getElementById('menuEmojiPicker').onclick = () => toggleEmojiPicker();
document.getElementById('menuExit').onclick = () => handleExit();

// Word Wrap Logic
let isWordWrap = true;
async function toggleWordWrap(val) {
    if (val !== undefined) isWordWrap = val;
    else isWordWrap = !isWordWrap;

    editor.style.whiteSpace = isWordWrap ? 'pre-wrap' : 'pre';
    editor.style.wordBreak = isWordWrap ? 'break-word' : 'normal';

    // Update the checkbox in popover
    if (checkWordWrap) checkWordWrap.checked = isWordWrap;

    const config = await window.electronAPI.getConfig();
    const theme = config.theme || {};
    theme.wordWrap = isWordWrap;
    await window.electronAPI.saveThemeConfig(theme);
}

checkWordWrap.onchange = () => toggleWordWrap(checkWordWrap.checked);

// Zoom Logic
async function setZoom(val) {
    currentZoom = val;
    zoomSlider.value = val;
    zoomValue.textContent = `${val}%`;

    const baseEditorSize = 14;
    const basePreviewSize = 15;

    editor.style.fontSize = `${(baseEditorSize * (val / 100)).toFixed(1)}px`;
    previewInner.style.fontSize = `${(basePreviewSize * (val / 100)).toFixed(1)}px`;

    const config = await window.electronAPI.getConfig();
    const theme = config.theme || {};
    theme.zoom = currentZoom;
    await window.electronAPI.saveThemeConfig(theme);
}

zoomSlider.oninput = (e) => setZoom(parseInt(e.target.value));

// Quick Settings Popover
// Removed click toggle; now handled by CSS :hover on .settings-wrapper


// Preferences Logic
const prefsPanel = document.getElementById('prefsPanel');
const prefsClose = document.getElementById('prefsClose');
const prefsReset = document.getElementById('prefsReset');
const prefsSave = document.getElementById('prefsSave');
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
        // Live preview only, no save
    };
});

prefsSave.onclick = async () => {
    const config = await window.electronAPI.getConfig();
    const theme = config.theme || {};

    colorInputs.forEach(input => {
        const varName = input.dataset.var;
        theme[varName] = input.value;
    });

    await window.electronAPI.saveThemeConfig(theme);
    togglePrefs(false);
};


prefsReset.onclick = async () => {
    const defaults = {
        '--bg0': '#242424',
        '--panel': '#212121',
        '--accent': '#d1d1d1',
        '--text': '#d1d1d1',
        '--titlebar-bg': '#141414',
        '--topbar-bg': '#1a1a1a',
        '--statusbar-bg': '#1a1a1a',
        '--tab-bg': '#1f1f1f',
        '--tab-active-bg': '#242424',
        '--scrollbar-thumb': '#575757',
        '--tooltip-bg': '#181818',
        '--btn-active-bg': '#242424',
        '--menu-bg': '#141414'
    };
    Object.entries(defaults).forEach(([varName, val]) => {
        document.documentElement.style.setProperty(varName, val);
    });
    toggleWordWrap(true);
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
            } else if (v === 'zoom') {
                setZoom(val);
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
            tab.markdownMode = tData.markdownMode || false;
            tab.previewMode = tData.previewMode || 'off';
            tab.encoding = tData.encoding || 'UTF-8';
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
        tab.encoding = file.encoding || 'UTF-8';
        switchTab(tab.id);
    } else {
        createTab(file.name, file.path, file.content, file.encoding || 'UTF-8');
    }
    saveAppState();
}

// Handle files opened from OS
window.electronAPI.onExternalFileOpen((file) => handleFileOpen(file));

// Drag and Drop (Global)
const dropZone = document.getElementById('dropZone');

const preventDefault = (e) => {
    e.preventDefault();
    e.stopPropagation();
};

window.addEventListener('dragover', (e) => {
    preventDefault(e);
    if (draggedTabIndex !== null) return; // Ignore internal tab drags
    dropZone.classList.add('drop-zone--active');
}, false);

window.addEventListener('dragleave', (e) => {
    preventDefault(e);
    if (draggedTabIndex !== null) return; // Ignore internal tab drags
    // Only remove if we're leaving the window
    if (!e.relatedTarget) {
        dropZone.classList.remove('drop-zone--active');
    }
}, false);

window.addEventListener('drop', async (e) => {
    preventDefault(e);
    if (draggedTabIndex !== null) return; // Ignore internal tab drags
    dropZone.classList.remove('drop-zone--active');

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
        const f = files[i];

        // Fallback for file path detection
        let path = null;
        try {
            path = window.electronAPI.getFilePath(f) || f.path;
        } catch (err) {
            console.error('Path detection failed:', err);
            path = f.path;
        }

        if (path) {
            const fileContent = await window.electronAPI.readFile(path);
            if (fileContent) {
                handleFileOpen(fileContent);
            }
        }
    }
}, false);

// Ensure drop zone closes if drag is canceled
window.addEventListener('dragend', () => {
    dropZone.classList.remove('drop-zone--active');
});

// Fix scrollbar cursor (Textareas show I-beam on scrollbars by default)
editor.addEventListener('mousemove', (e) => {
    const rect = editor.getBoundingClientRect();
    // Check if mouse is over the vertical or horizontal scrollbar areas
    // Using 18px to cover our 16px scrollbar + a tiny buffer
    const isOverVScroll = editor.scrollHeight > editor.clientHeight && e.clientX > rect.right - 18;
    const isOverHScroll = editor.scrollWidth > editor.clientWidth && e.clientY > rect.bottom - 18;

    if (isOverVScroll || isOverHScroll) {
        editor.style.cursor = 'default';
    } else {
        editor.style.cursor = 'text';
    }
});


// Custom Tooltip Logic
const tooltip = document.getElementById('tooltip');

function showTooltip(e) {
    const text = e.target.closest('[data-tooltip]')?.getAttribute('data-tooltip');
    if (!text) return;

    tooltip.textContent = text;
    tooltip.classList.add('tooltip--visible');

    const rect = e.target.closest('[data-tooltip]').getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    const maxLeft = window.innerWidth - tooltipRect.width - 5;

    // Clamp values
    if (left < 5) left = 5;
    if (left > maxLeft) left = maxLeft;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
}

function hideTooltip() {
    tooltip.classList.remove('tooltip--visible');
}

window.addEventListener('mouseover', (e) => {
    if (e.target.closest('[data-tooltip]')) {
        showTooltip(e);
    } else {
        hideTooltip();
    }
});

window.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-tooltip]')) {
        hideTooltip();
    }
});

window.addEventListener('mousedown', hideTooltip);
window.addEventListener('scroll', hideTooltip, true);

// Custom Context Menu Logic
const contextMenu = document.getElementById('contextMenu');
const ctxCut = document.getElementById('ctxCut');
const ctxCopy = document.getElementById('ctxCopy');
const ctxPaste = document.getElementById('ctxPaste');
const ctxSelectAll = document.getElementById('ctxSelectAll');

function showContextMenu(e) {
    e.preventDefault();

    contextMenu.classList.remove('context-menu--hidden');

    // Position menu
    let x = e.clientX;
    let y = e.clientY;

    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;

    // Boundary checks
    if (x + menuWidth > window.innerWidth) x -= menuWidth;
    if (y + menuHeight > window.innerHeight) y -= menuHeight;

    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
}

function hideContextMenu() {
    contextMenu.classList.add('context-menu--hidden');
}

editor.addEventListener('contextmenu', showContextMenu);
window.addEventListener('mousedown', (e) => {
    if (!contextMenu.contains(e.target)) {
        hideContextMenu();
    }
});

// Context Menu Actions
ctxCut.onclick = () => {
    editor.focus();
    document.execCommand('cut');
    hideContextMenu();
};

ctxCopy.onclick = () => {
    editor.focus();
    document.execCommand('copy');
    hideContextMenu();
};

async function handlePaste() {
    editor.focus();
    try {
        const text = await navigator.clipboard.readText();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const value = editor.value;

        // Manual insertion
        editor.value = value.substring(0, start) + text + value.substring(end);

        // Restore cursor
        editor.selectionStart = editor.selectionEnd = start + text.length;

        // Trigger changes
        editor.dispatchEvent(new Event('input'));
        updateStatusBar();
        updatePreview();
    } catch (err) {
        console.error('Failed to paste:', err);
    }
}

ctxPaste.onclick = () => {
    handlePaste();
    hideContextMenu();
};

ctxSelectAll.onclick = () => {
    editor.focus();
    editor.select();
    hideContextMenu();
};
// Find and Replace Logic
const searchBar = document.getElementById('searchBar');
const findInput = document.getElementById('findInput');
const replaceInput = document.getElementById('replaceInput');
const replaceRow = document.getElementById('replaceRow');
const findCount = document.getElementById('findCount');
const toggleCase = document.getElementById('toggleCase');

let isCaseSensitive = false;
let searchMatches = [];
let currentSearchIndex = -1;

function toggleSearch(showReplace = false) {
    searchBar.classList.remove('search-bar--hidden');
    if (showReplace) replaceRow.classList.remove('search-row--hidden');
    else replaceRow.classList.add('search-row--hidden');

    // If text is selected in editor, use it as search query
    const selection = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    if (selection && selection.length < 100 && !selection.includes('\n')) {
        findInput.value = selection;
    }

    findInput.focus();
    findInput.select();
    if (findInput.value) performSearch();
}

function hideSearch() {
    searchBar.classList.add('search-bar--hidden');
    editor.focus();
}

function performSearch() {
    const query = findInput.value;
    if (!query) {
        searchMatches = [];
        currentSearchIndex = -1;
        updateSearchUI();
        return;
    }

    const text = editor.value;
    const flags = isCaseSensitive ? 'g' : 'gi';
    // Escape regex special chars
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, flags);

    searchMatches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        searchMatches.push({ index: match.index, length: query.length });
        // Prevent infinite loops with zero-width matches
        if (match.index === regex.lastIndex) regex.lastIndex++;
    }

    if (searchMatches.length > 0) {
        // Try to stay on current match or find the closest one to cursor
        const cursorP = editor.selectionStart;
        let bestMatch = 0;
        let minDiff = Infinity;

        searchMatches.forEach((m, i) => {
            const diff = Math.abs(m.index - cursorP);
            if (diff < minDiff) {
                minDiff = diff;
                bestMatch = i;
            }
        });

        currentSearchIndex = bestMatch;
        highlightMatch(currentSearchIndex);
    } else {
        currentSearchIndex = -1;
    }
    updateSearchUI();
}

function updateSearchUI() {
    if (searchMatches.length === 0) {
        findCount.textContent = '0/0';
    } else {
        findCount.textContent = `${currentSearchIndex + 1}/${searchMatches.length}`;
    }
}

function highlightMatch(index) {
    if (index < 0 || index >= searchMatches.length) return;
    const match = searchMatches[index];
    editor.setSelectionRange(match.index, match.index + match.length);

    // Auto-scroll logic
    const textarea = editor;
    const fullText = textarea.value;
    const textBefore = fullText.substring(0, match.index);
    const linesBefore = textBefore.split('\n').length;

    // Very basic scroll estimation
    const lineHeight = 20; // Default estimate
    const targetScroll = (linesBefore - 5) * lineHeight;

    // Only scroll if out of view
    const currentScroll = textarea.scrollTop;
    const viewHeight = textarea.clientHeight;

    if (targetScroll < currentScroll || targetScroll > currentScroll + viewHeight - 50) {
        textarea.scrollTop = targetScroll;
    }
}

function findNext() {
    if (searchMatches.length === 0) return;
    currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
    highlightMatch(currentSearchIndex);
    updateSearchUI();
}

function findPrev() {
    if (searchMatches.length === 0) return;
    currentSearchIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
    highlightMatch(currentSearchIndex);
    updateSearchUI();
}

// Event Bindings
document.getElementById('closeSearch').onclick = hideSearch;

toggleCase.onclick = () => {
    isCaseSensitive = !isCaseSensitive;
    toggleCase.classList.toggle('active', isCaseSensitive);
    performSearch();
};

findInput.oninput = performSearch;

document.getElementById('findNext').onclick = findNext;
document.getElementById('findPrev').onclick = findPrev;

document.getElementById('replaceBtn').onclick = () => {
    if (currentSearchIndex === -1) return;
    const match = searchMatches[currentSearchIndex];
    editor.setSelectionRange(match.index, match.index + match.length);
    document.execCommand('insertText', false, replaceInput.value);
    performSearch();
    if (searchMatches.length > 0) findNext();
};

document.getElementById('replaceAllBtn').onclick = () => {
    const query = findInput.value;
    if (!query) return;

    const flags = isCaseSensitive ? 'g' : 'gi';
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, flags);

    // Store cursor
    const cursor = editor.selectionStart;
    editor.value = editor.value.replace(regex, replaceInput.value);

    // Restore and refresh
    editor.selectionStart = editor.selectionEnd = cursor;
    performSearch();
};

// Also trigger search on enter
findInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        findNext();
    }
};

replaceInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('replaceBtn').click();
    }
};

// Emoji Picker Logic
const emojiPicker = document.getElementById('emojiPicker');
const emojiSearch = document.getElementById('emojiSearch');
const emojiGrid = document.getElementById('emojiGrid');

const emojis = [
    // Productivity & Notes
    "✅", "❌", "⏳", "📌", "📍", "📅", "📆", "📄", "📝", "📊", "📈", "📉", "📁", "📂", "🔍", "🔎", "⚠️", "🔔", "💡", "✨", "🔥", "⭐", "🌟", "🚩", "🏷️", "🔖", "🔗", "📎", "🖇️", "🔒", "🔓", "✔️", "✖️", "➕", "➖", "➗", "❓", "❗", "❕", "❔", "💯", "⭕", "❌", "🚫", "✅", "☑️", "🔘", "⚪", "🔴", "🔵", "🟡", "🟠", "🟢", "🟣", "🟤", "🟥", "🟦", "🟧", "🟨", "🟩", "🟪", "⬜", "🔸", "🔹", "🔶", "🔷", "🔺", "🔻", "💠", "🔘", "🔲", "🏁", "🚩", "🎌", "🏳️", "🌈",
    // Smileys
    "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾",
    // Animals
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷️", "🕸️", "🦂", "🐢", "🐍", "🦎", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐄", "🐎", "🐖", "🐏", "🐑", "🐐", "🦌", "🐕", "🐩", "🐈", "🐓", "🦃", "🦚", "🦜", "🦢", "🦩", "🕊️", "🐇", "🦝", "🦨", "🦡", "🦦", "🦥", "🐁", "🐀", "🐿️", "🦔",
    // Food
    "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🥪", "🌮", "🌯", "🥗", "🥘", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "☕", "🫖", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃", "🥤", "🧋", "🧃", "🧉", "🧊",
    // Activities
    "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "⛸️", "⛳", "🏹", "🤿", "🥊", "🥋", "🎿", "🛷", "🥌", "🎯", "🎮", "🕹️", "🎰", "🎲", "🧩", "🧸", "🎨", "🧵", "🧶", "🎭", "🖼️", "🎤", "🎧", "🎼", "🎹", "🥁", "🎷", "🎺", "🎸", "🎻", "🎬",
    // Objects
    "⌚", "📱", "📲", "💻", "⌨️", "🖱️", "🖨️", "📺", "📷", "📸", "📹", "📼", "🔍", "🔎", "🕯️", "💡", "🔦", "🏮", "📔", "📕", "📖", "📗", "📘", "📙", "📜", "📓", "📒", "📑", "📓", "📁", "📂", "📅", "📆", "📇", "📈", "📉", "📊", "📋", "📌", "📍", "📎", "🖇️", "📏", "📐", "✂️", "🗃️", "🗄️", "🗑️", "🔒", "🔓", "🔏", "🔐", "🔑", "🗝️", "🔨", "🪓", "⛏️", "⚒️", "🛠️", "🗡️", "⚔️", "🔫", "🏹", "🛡️", "🔧", "🔩", "⚙️", "⚖️", "🔗", "⛓️", "🧰", "🧲", "🪜", "🧱"
];

function renderEmojiGrid(filter = "") {
    emojiGrid.innerHTML = "";
    // In a basic version, we can't search by name without a dictionary
    // but we can at least show all if no filter is provided.
    const filtered = filter ? emojis.filter(e => e.includes(filter)) : emojis;

    filtered.forEach(emoji => {
        const span = document.createElement('span');
        span.className = 'emoji-item';
        span.textContent = emoji;
        span.onclick = () => {
            insertEmoji(emoji);
            hideEmojiPicker();
        };
        emojiGrid.appendChild(span);
    });
}

function insertEmoji(emoji) {
    editor.focus();
    // Use insertText command so it stays in UNDO stack
    if (!document.execCommand('insertText', false, emoji)) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + emoji + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + emoji.length;
        editor.dispatchEvent(new Event('input'));
    }
}

function toggleEmojiPicker() {
    const isHidden = emojiPicker.classList.contains('emoji-picker--hidden');
    if (isHidden) {
        emojiPicker.classList.remove('emoji-picker--hidden');
        emojiSearch.value = "";
        renderEmojiGrid();
        emojiSearch.focus();
    } else {
        hideEmojiPicker();
    }
}

function hideEmojiPicker() {
    emojiPicker.classList.add('emoji-picker--hidden');
    editor.focus();
}

emojiSearch.oninput = (e) => {
    renderEmojiGrid(e.target.value);
};

window.addEventListener('mousedown', (e) => {
    if (emojiPicker && !emojiPicker.contains(e.target) && !emojiPicker.classList.contains('emoji-picker--hidden')) {
        hideEmojiPicker();
    }
});
