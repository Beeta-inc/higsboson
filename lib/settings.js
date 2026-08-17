// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Settings Manager
// Reactive GSettings wrapper with signal-based change notifications

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * SettingsManager
 *
 * Wraps Gio.Settings for the Beeta UI extension schema.
 * Provides typed getters and a reactive `connect` API for
 * listening to individual key changes.
 *
 * Usage:
 *   const settings = new SettingsManager(extension.getSettings());
 *   const opacity = settings.glassOpacity;
 *   settings.onChanged('glass-opacity', (value) => { ... });
 *   settings.destroy();
 */
export class SettingsManager {
    /**
     * @param {Gio.Settings} gSettings - The GSettings instance from Extension.getSettings()
     */
    constructor(gSettings) {
        this._settings = gSettings;
        this._signalIds = [];
    }

    // ════════════════════════════════════════════════════
    // Adaptive Nature™
    // ════════════════════════════════════════════════════

    /** @returns {'static'|'adaptive'|'expressive'} */
    get adaptiveNatureMode() {
        return this._settings.get_string('adaptive-nature-mode');
    }

    // ════════════════════════════════════════════════════
    // Glass Appearance
    // ════════════════════════════════════════════════════

    /** @returns {number} 0.3–0.95 */
    get glassOpacity() {
        return this._settings.get_double('glass-opacity');
    }

    /** @returns {number} 5–60 */
    get blurSigma() {
        return this._settings.get_int('blur-sigma');
    }

    /** @returns {number} 0.3–1.0 */
    get blurBrightness() {
        return this._settings.get_double('blur-brightness');
    }

    // ════════════════════════════════════════════════════
    // Bottom Dock
    // ════════════════════════════════════════════════════

    /** @returns {boolean} */
    get dockAutohide() {
        return this._settings.get_boolean('dock-autohide');
    }

    /** @returns {number} */
    get dockIconSize() {
        return this._settings.get_int('dock-icon-size');
    }

    /** @returns {boolean} */
    get dockShowResourcePulse() {
        return this._settings.get_boolean('dock-show-resource-pulse');
    }

    // ════════════════════════════════════════════════════
    // Live Center
    // ════════════════════════════════════════════════════

    /** @returns {boolean} */
    get liveCenterShowMedia() {
        return this._settings.get_boolean('live-center-show-media');
    }

    /** @returns {boolean} */
    get liveCenterShowInFocus() {
        return this._settings.get_boolean('live-center-show-in-focus');
    }

    // ════════════════════════════════════════════════════
    // Desktop Widgets
    // ════════════════════════════════════════════════════

    /** @returns {boolean} */
    get showDesktopWidgets() {
        return this._settings.get_boolean('show-desktop-widgets');
    }

    // ════════════════════════════════════════════════════
    // Weather
    // ════════════════════════════════════════════════════

    /** @returns {boolean} */
    get weatherAutoLocation() {
        return this._settings.get_boolean('weather-auto-location');
    }

    /** @returns {number} */
    get weatherLatitude() {
        return this._settings.get_double('weather-latitude');
    }

    /** @returns {number} */
    get weatherLongitude() {
        return this._settings.get_double('weather-longitude');
    }

    /** @returns {'celsius'|'fahrenheit'} */
    get temperatureUnit() {
        return this._settings.get_string('temperature-unit');
    }

    // ════════════════════════════════════════════════════
    // Animation / Adaptive Motion™
    // ════════════════════════════════════════════════════

    /** @returns {'reduced'|'normal'|'expressive'} */
    get animationSpeed() {
        return this._settings.get_string('animation-speed');
    }

    /** @returns {boolean} */
    get adaptiveMotionEnabled() {
        return this._settings.get_boolean('adaptive-motion-enabled');
    }

    // ════════════════════════════════════════════════════
    // Live Wallpaper
    // ════════════════════════════════════════════════════

    /** @returns {boolean} */
    get liveWallpaperEnabled() {
        return this._settings.get_boolean('live-wallpaper-enabled');
    }

    /** @returns {string} */
    get liveWallpaperPath() {
        return this._settings.get_string('live-wallpaper-path');
    }

    /** @returns {boolean} */
    get liveWallpaperMute() {
        return this._settings.get_boolean('live-wallpaper-mute');
    }

    // ════════════════════════════════════════════════════
    // User
    // ════════════════════════════════════════════════════

    /** @returns {string} */
    get userDisplayName() {
        const name = this._settings.get_string('user-display-name');
        if (name)
            return name;
        // Fallback to system username
        return GLib.get_real_name() || GLib.get_user_name() || 'User';
    }

    // ════════════════════════════════════════════════════
    // Reactive Change Listener
    // ════════════════════════════════════════════════════

    /**
     * Listen for changes to a specific settings key.
     * @param {string} key - The GSettings key name (e.g. 'glass-opacity')
     * @param {Function} callback - Called with the new value
     * @returns {number} Signal ID (for manual disconnection if needed)
     */
    onChanged(key, callback) {
        const id = this._settings.connect(`changed::${key}`, () => {
            callback(this._settings.get_value(key).unpack());
        });
        this._signalIds.push(id);
        return id;
    }

    /**
     * Listen for changes to any settings key.
     * @param {Function} callback - Called with the changed key name
     * @returns {number} Signal ID
     */
    onAnyChanged(callback) {
        const id = this._settings.connect('changed', (_settings, key) => {
            callback(key);
        });
        this._signalIds.push(id);
        return id;
    }

    /**
     * Get the raw GSettings instance.
     * @returns {Gio.Settings}
     */
    get raw() {
        return this._settings;
    }

    /**
     * Disconnect all signals and clean up.
     */
    destroy() {
        for (const id of this._signalIds) {
            try {
                this._settings.disconnect(id);
            } catch {
                // Signal may already be disconnected
            }
        }
        this._signalIds = [];
        this._settings = null;
    }
}
