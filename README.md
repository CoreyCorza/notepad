# Notepad
A premium, multi-tabbed notepad application built with Electron.

## Features
- **Multi-Tab Support**: Open multiple files simultaneously in a sleek tabbed interface.
- **Custom Themes**: Fully customizable UI colors via the Preferences panel.
- **OS Integration**: "Open with Notepad" right-click context menu for `.txt` and `.md` files.
- **Drag & Drop**: Drop files directly into the window to open them instantly.
- **Word Wrap**: Persistent toggle to handle long lines of text gracefully.
- **Single Instance**: Smart instance locking—opening a file from outside the app will use your existing window.
- **Modern Icons**: Powered by Lucide SVG icons.

## Installation
1. Download the latest `Notepad Setup.exe` from the releases.
2. Run the installer to add Notepad to your system and context menu.

## Development
```bash
npm install
npm start
```

### Building the Installer
```bash
npm run build
```