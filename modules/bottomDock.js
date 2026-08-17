import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { safeDestroy, getPrimaryMonitor } from '../lib/utils.js';
import { GLASS } from '../lib/constants.js';

export class BottomDock {
    constructor(settings, glassManager, beetaLauncher, weatherService) {
        this._settings = settings;
        this._glassManager = glassManager;
        this._beetaLauncher = beetaLauncher;
        this._weatherService = weatherService;

        this._dock = null;
        this._edgeTrigger = null;
        this._signalHandlers = [];
        this._timeoutIds = new Set();
        
        this._isFocused = false;
        this._isRevealed = false;
        
        this._appIcons = new Map();
        this._gnomeSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
    }

    enable() {
        this._createDock();
        this._createEdgeTrigger();
        
        this._updatePosition();

        this._connectSignal(Main.layoutManager, 'monitors-changed', () => this._updatePosition());
        this._connectSignal(this._dock, 'notify::width', () => this._updatePosition());
        
        let appSystem = Shell.AppSystem.get_default();
        this._connectSignal(appSystem, 'app-state-changed', () => this._updateAppStates());
        this._connectSignal(appSystem, 'installed-changed', () => this._refreshApps());
        
        this._connectSignal(this._gnomeSettings, 'changed::favorite-apps', () => this._refreshApps());

        if (this._weatherService) {
            if (typeof this._weatherService.onWeatherUpdated === 'function') {
                this._weatherService.onWeatherUpdated(weather => this._updateWeather(weather));
            } else if (typeof this._weatherService.connect === 'function') {
                this._connectSignal(this._weatherService, 'weather-updated', (obj, weather) => this._updateWeather(weather));
            }
        }
    }

    disable() {
        for (let id of this._timeoutIds) {
            GLib.Source.remove(id);
        }
        this._timeoutIds.clear();

        for (let { obj, id } of this._signalHandlers) {
            try {
                obj.disconnect(id);
            } catch (e) {
                // Ignore disconnect errors
            }
        }
        this._signalHandlers = [];

        if (this._dock) {
            this._glassManager.removeFrom(this._dock);
            Main.layoutManager.removeChrome(this._dock);
            safeDestroy(this._dock);
            this._dock = null;
        }

        if (this._edgeTrigger) {
            Main.layoutManager.removeChrome(this._edgeTrigger);
            safeDestroy(this._edgeTrigger);
            this._edgeTrigger = null;
        }
        
        this._appIcons.clear();
        this._gnomeSettings = null;
    }

    _connectSignal(obj, signal, callback) {
        if (!obj) return;
        const id = obj.connect(signal, callback);
        this._signalHandlers.push({ obj, id });
    }

    _addTimeout(delay, callback) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this._timeoutIds.delete(id);
            callback();
            return GLib.SOURCE_REMOVE;
        });
        this._timeoutIds.add(id);
        return id;
    }

    _clearTimeout(id) {
        if (id && this._timeoutIds.has(id)) {
            GLib.Source.remove(id);
            this._timeoutIds.delete(id);
        }
    }

    _createDock() {
        this._dock = new St.BoxLayout({
            style_class: 'beeta-dock',
            vertical: false,
            reactive: true,
            track_hover: true
        });

        this._glassManager.applyTo(this._dock);

        Main.layoutManager.addChrome(this._dock, {
            affectsStruts: true,
            affectsInputRegion: true,
            trackFullscreen: true
        });

        // Left: Beeta Launcher Button
        this._launcherButton = new St.Button({
            style_class: 'beeta-launcher-button',
            reactive: true,
            can_focus: true,
            child: new St.Icon({
                icon_name: 'view-app-grid-symbolic',
                style_class: 'beeta-launcher-button-icon'
            })
        });
        this._connectSignal(this._launcherButton, 'clicked', () => {
            if (this._beetaLauncher && typeof this._beetaLauncher.toggle === 'function') {
                this._beetaLauncher.toggle();
            }
        });
        this._dock.add_child(this._launcherButton);

        // Separator
        let sep1 = new St.Widget({ style_class: 'beeta-dock-separator' });
        this._dock.add_child(sep1);

        // Center: App Icons
        this._appsBox = new St.BoxLayout({
            style_class: 'beeta-dock-icon-container',
            vertical: false
        });
        this._dock.add_child(this._appsBox);
        
        this._refreshApps();

        // Add "+" button
        let addButton = new St.Button({
            style_class: 'beeta-dock-icon',
            reactive: true,
            can_focus: true,
            child: new St.Icon({
                icon_name: 'list-add-symbolic',
                icon_size: this._settings.dockIconSize || 36
            })
        });
        this._dock.add_child(addButton);

        // Separator
        let sep2 = new St.Widget({ style_class: 'beeta-dock-separator' });
        this._dock.add_child(sep2);

        // Right: Weather + AI
        this._weatherBox = new St.BoxLayout({
            style_class: 'beeta-dock-weather',
            vertical: false,
            reactive: true
        });
        this._weatherTempLabel = new St.Label({
            text: '--°',
            style_class: 'beeta-dock-weather-temp',
            y_align: Clutter.ActorAlign.CENTER
        });
        this._weatherBox.add_child(this._weatherTempLabel);
        this._dock.add_child(this._weatherBox);

        this._aiButton = new St.Button({
            style_class: 'beeta-dock-ai-button',
            reactive: true,
            can_focus: true,
            child: new St.Icon({
                icon_name: 'system-help-symbolic',
                style_class: 'beeta-dock-ai-icon'
            })
        });
        this._dock.add_child(this._aiButton);

        this._connectSignal(this._dock, 'leave-event', () => {
            if (this._isFocused && this._isRevealed) {
                this._hideTimeoutId = this._addTimeout(500, () => {
                    if (this._dock.has_pointer) return;
                    this._hideDock();
                });
            }
        });
        
        this._connectSignal(this._dock, 'enter-event', () => {
            if (this._hideTimeoutId) {
                this._clearTimeout(this._hideTimeoutId);
                this._hideTimeoutId = null;
            }
        });
    }

    _refreshApps() {
        if (!this._appsBox) return;

        this._appsBox.destroy_all_children();
        this._appIcons.clear();

        let appSystem = Shell.AppSystem.get_default();
        let favoriteAppIds = this._gnomeSettings.get_strv('favorite-apps');

        for (let appId of favoriteAppIds) {
            let app = appSystem.lookup_app(appId);
            if (!app) continue;

            let btn = new St.Button({
                style_class: 'beeta-dock-icon',
                reactive: true,
                can_focus: true
            });

            let box = new St.BoxLayout({
                vertical: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER
            });
            let iconSize = this._settings.dockIconSize || 36;
            let icon = app.create_icon_texture(iconSize);
            icon.set_pivot_point(0.5, 0.5); // Center pivot for scaling
            
            // Set up hover animation for icon
            btn.connect('enter-event', () => {
                icon.ease({
                    scale_x: 1.1,
                    scale_y: 1.1,
                    duration: 150,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD
                });
            });
            btn.connect('leave-event', () => {
                icon.ease({
                    scale_x: 1.0,
                    scale_y: 1.0,
                    duration: 150,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD
                });
            });

            let indicator = new St.Widget({
                style_class: 'beeta-dock-running-indicator',
                visible: app.get_state() === Shell.AppState.RUNNING
            });

            box.add_child(icon);
            box.add_child(indicator);
            btn.set_child(box);

            btn.connect('clicked', () => {
                app.activate();
            });

            this._appsBox.add_child(btn);
            this._appIcons.set(appId, { app, indicator });
        }

        // Trigger position update since layout may change width
        this._updatePosition();
    }

    _updateAppStates() {
        for (let [, { app, indicator }] of this._appIcons.entries()) {
            indicator.visible = (app.get_state() === Shell.AppState.RUNNING);
        }
    }

    _updateWeather(weatherInfo) {
        if (!weatherInfo || !this._weatherTempLabel) return;
        if (weatherInfo.temperature !== undefined) {
            this._weatherTempLabel.text = `${Math.round(weatherInfo.temperature)}°`;
        }
    }

    _createEdgeTrigger() {
        this._edgeTrigger = new St.Widget({
            height: 2,
            reactive: true,
            track_hover: true,
            opacity: 0
        });

        Main.layoutManager.addChrome(this._edgeTrigger, {
            affectsStruts: false,
            affectsInputRegion: true,
            trackFullscreen: true
        });

        this._connectSignal(this._edgeTrigger, 'enter-event', () => {
            if (this._isFocused && !this._isRevealed) {
                this._revealTimeoutId = this._addTimeout(150, () => {
                    if (this._edgeTrigger.has_pointer) {
                        this._revealDock();
                    }
                });
            }
        });

        this._connectSignal(this._edgeTrigger, 'leave-event', () => {
            if (this._revealTimeoutId) {
                this._clearTimeout(this._revealTimeoutId);
                this._revealTimeoutId = null;
            }
        });
    }

    _updatePosition() {
        if (!this._dock || !this._edgeTrigger) return;

        let monitor = getPrimaryMonitor();
        let dockHeight = GLASS.DOCK_HEIGHT || 56;
        let margin = GLASS.DOCK_MARGIN || 8;

        // Get preferred width
        let [, prefWidth] = this._dock.get_preferred_width(-1);

        this._dock.set_position(
            monitor.x + (monitor.width - prefWidth) / 2,
            monitor.y + monitor.height - dockHeight - margin
        );
        this._dock.set_height(dockHeight);

        this._edgeTrigger.set_position(monitor.x, monitor.y + monitor.height - 2);
        this._edgeTrigger.set_size(monitor.width, 2);
    }

    /**
     * Set the adaptive tint color for the dock.
     * Called by Adaptive Nature™ to update the dock border/accent.
     * @param {string} style - CSS style string for inline tinting
     */
    setAdaptiveTint(style) {
        if (this._dock)
            this._dock.set_style(style);
    }

    setFocusState(focus) {
        this._isFocused = focus;

        if (focus) {
            this._hideDock();
        } else {
            this._isRevealed = false; // reset state
            this._dock.ease({
                translation_y: 0,
                opacity: 255,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        }
    }

    _hideDock() {
        let dockHeight = GLASS.DOCK_HEIGHT || 56;
        let margin = GLASS.DOCK_MARGIN || 8;

        this._isRevealed = false;
        this._dock.ease({
            translation_y: dockHeight + margin,
            opacity: 0,
            duration: 250,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    _revealDock() {
        this._isRevealed = true;
        this._dock.ease({
            translation_y: 0,
            opacity: 255,
            duration: 250,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }
}
