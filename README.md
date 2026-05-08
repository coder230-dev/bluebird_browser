# Bluebird Browser

![Browser Screenshot](images/coverImg.png)

Bluebird Browser is a lightweight, privacy-focused web browser designed for speed and simplicity. Built with modern web technologies, it offers features like ad-blocking, tab management, and customizable themes to enhance your browsing experience. Perfect for developers and everyday users seeking an alternative to mainstream browsers.


### Features
- **Tab Management**: Easy-to-use interface for organizing multiple tabs. Click the top-right tabs button.
- **Customizable Themes**: Pick a color from the color picker from settings, then watch your browser transform.
- **A Modern Look**: To make it easy to use by everyone.

### Future Plans
- **Extension Support**: Plugin system for adding custom functionalities like password managers or productivity tools.
- **Enhanced Security**: Advanced features including phishing detection, HTTPS enforcement, and integrated VPN.
- **Mobile App Currently Planned**: iOS coming first, then Andriod. Will be built using [swift](https://swift.org).
- **AI-Powered Suggestions**: Smart search and content recommendations based on user behavior.
- **Performance Optimizations**: Further improvements in memory usage and battery life for extended sessions.
- **Ad Blocking**: Built-in blocker to reduce distractions and improve privacy.

## Installation

1. Clone the repository: `git clone https://github.com/coder230-dev/bluebird_browser.git`
2. Install dependencies: `npm install`
3. Run the browser: `npm start`

## Cross-platform build prerequisites

- macOS
  - Install Homebrew if you don't have it: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
  - Install Windows build runtime support: `brew install wine mono`
  - Install Linux packaging tools if you want local Linux builds: `brew install dpkg rpm`
- Linux
  - Install packaging tools: `sudo apt install fakeroot dpkg-dev rpm` or the equivalent for your distro.
- Windows
  - Build on Windows directly for the best compatibility, or use CI.

## Build commands

- Build macOS: `npm run make:mac`
- Build Windows: `npm run make:win`
- Build Linux: `npm run make:linux`
- Build all supported targets: `npm run make:all`

## Usage

- Launch the browser and start browsing.
- Access settings via the menu to customize themes and features.

## Issues

Any issues? Please report them and I will take a look on it. Some features might be fixed by either AI or myself.

## License

This project is not currently licensed.
