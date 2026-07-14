# Bluebird Browser

![Browser Screenshot](images/coverImg.png)

Bluebird Browser is a lightweight, privacy-first web browser built with Electron and modern web technologies. It emphasizes speed, simplicity, and customization while staying friendly for both developers and everyday users.

## Table of Contents

- [Features](#features)
- [Preview](#preview)
- [Built With](#built-with)
- [Installation](#installation)
- [Build & Packaging](#build--packaging)
- [Supported Platforms](#supported-platforms)

# Bluebird Browser

![Browser Screenshot](images/coverImg.png)

Bluebird Browser is a lightweight, privacy-first web browser built with Electron. It focuses on speed, simplicity, and customization while staying developer-friendly.

## Table of contents

- Features
- Quick start
- Build & packaging
- Supported platforms
- Usage
- Contributing
- License

## Features

- Tab management with a simple UI
- Customizable themes (live update)
- Privacy-minded defaults and reduced tracking
- Lightweight, modern interface
- Basic ad blocking (BETA)

## Quick start

Prerequisites: Node.js (recommended v16+ or current LTS)

Clone and run locally:

```bash
git clone https://github.com/coder230-dev/bluebird_browser.git
cd bluebird_browser
npm install
npm start
```

This will start the app in development mode.

## Build & packaging

The repo includes scripts to package the app for macOS, Windows, and Linux.

Common commands:

```bash
npm run make      # macOS (simplified alias)
npm run make:mac  # Build macOS package
npm run make:win  # Build Windows package
npm run make:linux# Build Linux package
npm run make:all  # Build all targets
```

Packaging notes:

- macOS: expects `images/icon.icns` for the app icon
- Windows: expects `images/icon.ico`
- Linux: expects `images/icon.png`

## Supported platforms

- macOS — recommended for local builds
- Windows — best built on Windows or CI
- Linux — supported via standard packaging tools

Platform prerequisites (examples):

- macOS: `brew install wine mono dpkg rpm` (optional, for building Windows/Linux targets)
- Linux: `sudo apt install fakeroot dpkg-dev rpm` (Debian/Ubuntu)

## Usage

- Start in development: `npm start`
- Open Settings to change theme and permissions
- Tab controls available in the main UI for managing pages

## Contributing

Contributions welcome:

- Open issues for bugs or feature requests
- Submit pull requests for fixes and improvements
- Keep changes focused and include clear descriptions

If you'd like guidance on where to start, ask for a list of good first issues.

## License

This project currently has no license specified. Add a `LICENSE` file to set terms for reuse.

---

If you want, I can also:

- Add a short development guide (project structure and key files)
- Create a `CONTRIBUTING.md` and `LICENSE` file
- Add badges and release links

Tell me which of those you'd like next.
