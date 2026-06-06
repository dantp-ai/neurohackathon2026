# Prerequisites

Everything you need installed to run **NeuroMonitor** locally, and the versions
we target. Tiers below: install **Required** for everyone; **Recommended** makes
dev smoother; **Platform** depends on *how* you want to preview the app.

> **Fastest path with zero platform setup:** install the **Expo Go** app on your
> phone (App Store / Play Store) and skip Xcode/Android Studio entirely. You only
> need the *Required* tier + Expo Go.

---

## Tier 1 — Required (everyone)

| Tool | Target version | Why | Check |
|---|---|---|---|
| **Node.js** | `24.x` (pinned in `.nvmrc`) | JS runtime for Metro/Expo | `node --version` |
| **npm** | `≥ 10` (ships with Node 24 → `11.x`) | Installs locked dependencies | `npm --version` |
| **nvm** | `≥ 0.40` | Installs/switches Node to the pinned version | `nvm --version` |
| **git** | `≥ 2.30` | Version control | `git --version` |
| **Expo Go** (phone) | latest from store | Run the app on a real device, no native toolchain | — |

App dependencies themselves (Expo SDK `~56.0.9`, React Native `0.85.3`,
React `19.2.3`, expo-router `~56.2.9`, TypeScript `~6.0.3`, …) are **not**
installed by hand — `npm ci` reads exact versions from `package-lock.json`.

### Install (macOS)

```bash
# 1. nvm (Node Version Manager)
brew install nvm
#    then follow brew's note to add nvm to your shell, e.g. add to ~/.zshrc:
#      export NVM_DIR="$HOME/.nvm"
#      [ -s "$(brew --prefix nvm)/nvm.sh" ] && \. "$(brew --prefix nvm)/nvm.sh"
#    restart your terminal, then:

# 2. Node (reads .nvmrc → installs/uses Node 24)
cd /path/to/neurohackathon2026
nvm install        # installs the version in .nvmrc
nvm use            # switches to it

# 3. git is preinstalled on macOS with the Command Line Tools.
#    If missing: xcode-select --install

# 4. Project dependencies (exact, reproducible)
npm ci
```

> You already have Node `24.7.0` system-wide, so the app runs without nvm too.
> nvm just guarantees the whole team is on the *same* Node version.

---

## Tier 2 — Recommended

| Tool | Target version | Why | Check |
|---|---|---|---|
| **Watchman** | latest | Faster, more reliable file watching for Metro | `watchman --version` |

```bash
brew install watchman
```

---

## Tier 3 — Platform toolchains (only if NOT using Expo Go)

Choose based on which simulator/emulator you want. **Skip both if you test on a
physical phone via Expo Go.**

### iOS simulator (macOS only)

| Tool | Target version | Notes |
|---|---|---|
| **Xcode** | `15+` (App Store) | Full Xcode, not just Command Line Tools |
| **iOS Simulator** | bundled with Xcode | — |
| **CocoaPods** | `1.14+` | Only needed for native/dev builds, not Expo Go |

```bash
# Install Xcode from the App Store, then point the toolchain at it:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
# (CocoaPods, if you do a native build later)
brew install cocoapods
```

> Note: this machine currently has only the **Command Line Tools**, not full
> Xcode — installing the full Xcode app is required for the iOS simulator.

### Android emulator (macOS / Windows / Linux)

| Tool | Target version | Notes |
|---|---|---|
| **Android Studio** | latest (Hedgehog+) | Includes SDK + emulator |
| **Android SDK** | Platform 34/35 | Installed via Android Studio SDK Manager |
| **JDK (Java)** | `17` (Temurin) | Required by the Android build tools |

```bash
brew install --cask android-studio
brew install --cask temurin17    # JDK 17
# Then in Android Studio: SDK Manager → install an SDK platform + a virtual device.
# Add to ~/.zshrc:
#   export ANDROID_HOME="$HOME/Library/Android/sdk"
#   export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools"
```

> No Java runtime is installed on this machine yet — needed only for the Android
> path.

---

## Verify your setup

```bash
node --version        # v24.x
npm --version         # 11.x (or ≥10)
nvm --version         # 0.40.x
git --version         # 2.30+
watchman --version    # optional
npm ci                # installs deps with no errors
npm run typecheck     # 0 errors
npm start             # Expo dev server starts; press i / a / w, or scan QR in Expo Go
```

## Current status on this machine (2026-06-06)

| Tool | Installed | Target | OK? |
|---|---|---|---|
| Node | `24.7.0` | 24.x | ✅ |
| npm | `11.5.1` | ≥10 | ✅ |
| git | `2.39.5` | ≥2.30 | ✅ |
| Homebrew | `5.1.14` | any | ✅ |
| nvm | — | ≥0.40 | ❌ install |
| Watchman | — | latest | ⚠️ recommended |
| Xcode (full) | Command Line Tools only | 15+ | ⚠️ iOS sim only |
| JDK / Android Studio | — | JDK 17 | ⚠️ Android only |
