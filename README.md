# Bluebird Browser

![Browser Screenshot](images/coverImg.png)

Bluebird Browser is a lightweight, privacy-first web browser built with Electron and modern web technologies. It emphasizes speed, simplicity, and customization while staying friendly for both developers and everyday users.

## Table of Contents

- [Features](#features)
- [Preview](#preview)
- [Built With](#built-with)
- [Installation](#installation)
- [Build & Packaging](#build--packaging)
- [Downloading the Browser](#build--packaging)
- [Supported Platforms](#supported-platforms)
- [Usage](#usage)
- [Future Plans](#future-plans)
- [Contributing](#contributing)
- [Issues](#issues)
- [License](#license)

## Features

- **Tab Management**: Manage multiple tabs with a simple, intuitive interface.
- **Customizable Themes**: Change the browser color from Settings and watch the UI update instantly.
- **Privacy Focused**: Built with user privacy in mind and designed to reduce tracking and unwanted clutter.
- **Lightweight UI**: A clean, modern design that stays easy to use for everyone.
- **Ad Blocking (BETA)**: Basic ad blocking support to reduce distractions and speed up page loading.

## Preview

The screenshot above gives a quick look at the browser's interface and design.

## Built With

- [Electron](https://www.electronjs.org/)
- HTML, CSS, and JavaScript
- [Electron Forge](https://www.electronforge.io/)
- [Electron Builder](https://www.electron.build/)

This project used AI to build its features, with it being accepted by me.

## Installation

To run the browser locally:

```bash
git clone https://github.com/coder230-dev/bluebird_browser.git
cd bluebird_browser
npm install
npm start
```

> Make sure you have Node.js installed before running the commands above.

## Build & Packaging

This repository includes packaging support for macOS, Windows, and Linux.

### Build commands

- `npm run make:mac` — Build macOS package
- `npm run make:win` — Build Windows package
- `npm run make:linux` — Build Linux package
- `npm run make:all` — Build all supported targets

### Packaging notes

- macOS: Uses `images/icon.icns` for the app icon.
- Windows: Uses `images/icon.ico` for the app icon.
- Linux: Uses `images/icon.png` for the app icon.

## Supported Platforms

- **macOS** — Recommended for local builds with Homebrew.
- **Windows** — Best built directly on Windows.
- **Linux** — Supported via standard packaging tools.

### Platform prerequisites

- macOS:
  - Optional: `brew install wine mono dpkg rpm`
- Linux:
  - Example: `sudo apt install fakeroot dpkg-dev rpm`
- Windows:
  - Use local Windows build environment or CI for best results.

## Downloading the Browser

You can find the app in the Releases tab. Just download the .zip (Mac) or .exe (Windows) file under the latest release.

## Usage

- Launch the application after building, or run `npm start` for development.
- Open Settings to customize theme colors and available options.
- Use the tab button to manage open pages and browsing sessions.

## Future Plans

- **Extension Support**: Add a plugin system for extensions such as password managers and productivity tools.
- **Enhanced Security**: Add phishing protection, HTTPS enforcement, and optional VPN integration.
- **Mobile App**: iOS first, followed by Android.
- **AI-Powered Suggestions**: Provide smarter search results and browsing recommendations.
- **Performance Improvements**: Reduce memory usage and optimize battery life.
- **Ad Blocking Improvements**: Make ad blocking more robust and reliable.

## Contributing

Contributions are welcome! If you'd like to help, you can:

- Open an issue for bugs or feature requests.
- Submit a pull request with improvements.
- Help document features and workflows.

Please follow any contribution guidelines in the repository and keep changes small and focused.

## Issues

If you encounter any issues, please report them in the repository's issue tracker. I will review them and work on fixes.

## License

This project is currently unlicensed.
