# Beeta UI — GNOME Shell Extension

> *Premium glassmorphic desktop experience with Adaptive Nature™, Live Center, Smart Launcher, and Live Wallpaper support.*

![GNOME Shell 50](https://img.shields.io/badge/GNOME_Shell-50-blue?style=flat-square)
![License](https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square)

## What is Beeta UI?

Beeta UI transforms the standard GNOME desktop into a professional, environment-aware desktop experience. It's not just a theme — it's a complete **interaction model** with intelligent features:

### 🌤️ Beeta Adaptive Nature™
The UI adapts to your environment. Morning brings warm golden tones, evening shifts to amber, night goes cool blue. Weather conditions subtly influence the palette. You don't notice it changing — you just feel it always fits.

### 📍 Live Center
A dynamic status island in the center of the top bar. Shows the time when idle, switches to media controls when music plays, displays timers, downloads, and other active tasks. Click to expand into a card stack of all activities.

### 🎨 Beeta Glass™
Frosted glassmorphism with `Shell.BlurEffect` backdrop blur across all UI surfaces — top bar, dock, launcher, desktop widgets. 70-80% opacity with soft blur, thin borders, and gentle shadows.

### 🚀 Smart Launcher
Two-pane app menu with a ripple-rising animation. Left pane shows most-used apps, right pane shows smart category cards. Search filters everything instantly.

### 🖥️ Desktop & Focus States
- **Desktop State**: Rich, informative — all panels, dock, and widgets visible
- **Focus State**: Minimal — dock hides, widgets fade, only Live Center and battery remain

### 🎬 Live Wallpaper
GStreamer-based video wallpaper support. Loop any video as your desktop background.

## Installation

### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/Beeta-inc/higsboson.git
cd higsboson

# Compile GSettings schemas
glib-compile-schemas schemas/

# Symlink to GNOME Shell extensions directory
ln -sf $(pwd) ~/.local/share/gnome-shell/extensions/beeta-ui@beeta-inc.com

# Restart GNOME Shell (X11) or log out and back in (Wayland)
# Then enable the extension:
gnome-extensions enable beeta-ui@beeta-inc.com
```

### Preferences

Open extension preferences via:
```bash
gnome-extensions prefs beeta-ui@beeta-inc.com
```

## Architecture

```
higsboson/
├── extension.js              # Main orchestrator
├── prefs.js                  # GTK4/Adwaita preferences
├── stylesheet.css            # Beeta Design Language tokens
├── metadata.json             # Extension manifest
├── lib/
│   ├── constants.js          # Design tokens & palettes
│   ├── settings.js           # GSettings wrapper
│   └── utils.js              # Color math, time helpers
├── modules/
│   ├── adaptiveNature.js     # Adaptive Nature™ engine
│   ├── beetaLauncher.js      # Two-pane smart launcher
│   ├── bottomDock.js         # Floating glass dock
│   ├── desktopWidgets.js     # Desktop weather/greeting
│   ├── glassEffect.js        # Shell.BlurEffect manager
│   ├── liveCenter.js         # Dynamic status island
│   ├── liveWallpaper.js      # GStreamer video wallpaper
│   ├── mediaController.js    # MPRIS D-Bus integration
│   ├── systemStatus.js       # Battery, Wi-Fi, volume
│   ├── topBar.js             # Panel transformation
│   ├── weatherService.js     # Open-Meteo weather API
│   └── workspaceIndicator.js # Workspace dot indicator
├── schemas/
│   └── org.gnome.shell.extensions.beeta-ui.gschema.xml
└── icons/
    └── beeta-logo.png        # 3D Beeta logo icon
```

## Technologies

| Technology | Purpose |
|---|---|
| **Beeta Adaptive Nature™** | Environment-aware UI theming |
| **Beeta Glass™** | Consistent glassmorphism design |
| **Beeta Motion™** | Unified animation system |
| **Beeta Turbo Charge™** | Enhanced charging experience |
| **Live Center** | Dynamic status & activity hub |

## Requirements

- GNOME Shell 50
- GStreamer (for live wallpaper)
- Internet connection (for weather data)

## License

GPL-3.0-or-later
