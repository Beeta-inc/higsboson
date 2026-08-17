// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';

import {
    ADAPTIVE_PALETTES,
    WEATHER_ACCENTS,
    ADAPTIVE_POLL_INTERVAL,
    ANIMATION
} from '../lib/constants.js';

import {
    getTimeOfDay,
    rgba,
    hsla,
    clamp
} from '../lib/utils.js';

/**
 * AdaptiveNature
 * 
 * Beeta Adaptive Nature™ environment-aware theming engine.
 * Shifts UI colors gradually based on time of day and weather conditions.
 */
export class AdaptiveNature {
    /**
     * @param {import('../lib/settings.js').SettingsManager} settings 
     * @param {object} glassManager 
     * @param {object} weatherService 
     * @param {object} topBar 
     * @param {object} bottomDock 
     */
    constructor(settings, glassManager, weatherService, topBar, bottomDock) {
        this._settings = settings;
        this._glassManager = glassManager;
        this._weatherService = weatherService;
        this._topBar = topBar;
        this._bottomDock = bottomDock;
        
        this._updateTimerId = null;
        this._settingsChangedId = null;
        
        this._currentPalette = null;
        this._currentGreeting = '';
        this._currentAccentHSL = [0, 0, 0];
    }

    /**
     * Enables Adaptive Nature™ by setting up timers and applying the initial palette.
     */
    enable() {
        this._settingsChangedId = this._settings.onChanged('adaptive-nature-mode', () => {
            this.update();
        });

        this._updateTimerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            ADAPTIVE_POLL_INTERVAL,
            () => {
                this.update();
                return GLib.SOURCE_CONTINUE;
            }
        );

        this.update();
    }

    /**
     * Disables Adaptive Nature™ and cleans up resources.
     */
    disable() {
        if (this._updateTimerId) {
            GLib.Source.remove(this._updateTimerId);
            this._updateTimerId = null;
        }

        if (this._settingsChangedId) {
            try {
                this._settings.raw.disconnect(this._settingsChangedId);
            } catch (e) {
                // Ignore if already disconnected
            }
            this._settingsChangedId = null;
        }

        this._currentPalette = null;
        this._settings = null;
        this._glassManager = null;
        this._weatherService = null;
        this._topBar = null;
        this._bottomDock = null;
    }

    /**
     * Returns the current greeting based on the active palette (time of day).
     * @returns {string}
     */
    get greeting() {
        return this._currentGreeting || 'Hello';
    }

    /**
     * Returns the currently active accent color in HSL format.
     * @returns {number[]} [h, s, l]
     */
    get currentAccentHSL() {
        return this._currentAccentHSL;
    }

    /**
     * Computes the current palette and applies it to UI elements.
     */
    update() {
        if (!this._settings) return;

        const mode = this._settings.adaptiveNatureMode;
        let timeOfDay = getTimeOfDay();
        let palette = ADAPTIVE_PALETTES[timeOfDay];

        if (mode === 'static') {
            palette = ADAPTIVE_PALETTES.afternoon;
        }

        this._currentPalette = palette;
        this._currentGreeting = palette.greeting;

        // Base color values
        let [aH, aS, aL] = palette.accent;
        let [r, g, b, a] = palette.glassBg;
        let [br, bg, bb, ba] = palette.border;

        // Apply weather accents if applicable
        if (mode !== 'static' && this._weatherService && this._weatherService.condition) {
            const condition = this._weatherService.condition;
            const weatherAccent = WEATHER_ACCENTS[condition];

            if (weatherAccent) {
                aH = (aH + weatherAccent.hueShift + 360) % 360;
                aS += weatherAccent.satBoost;
                aL += weatherAccent.lightBoost;
            }
        }

        // Apply expressive mode enhancements
        if (mode === 'expressive') {
            aS += 20; 
            aL += 5;
        }

        aS = clamp(aS, 0, 100);
        aL = clamp(aL, 0, 100);

        this._currentAccentHSL = [aH, aS, aL];

        const bgColor = rgba(r, g, b, a);
        const borderColor = rgba(br, bg, bb, ba);
        const accentGlow = hsla(aH, aS, aL, 0.3);

        const styleString = `
            background-color: ${bgColor};
            border-color: ${borderColor};
            box-shadow: 0 2px 12px 0 ${accentGlow};
            transition-property: background-color, border-color, box-shadow;
            transition-duration: ${ANIMATION.GLASS_TINT_CHANGE}ms;
        `.replace(/\s+/g, ' ').trim();

        if (this._topBar && typeof this._topBar.setAdaptiveTint === 'function') {
            this._topBar.setAdaptiveTint(styleString);
        }

        if (this._bottomDock && typeof this._bottomDock.setAdaptiveTint === 'function') {
            this._bottomDock.setAdaptiveTint(styleString);
        }
    }
}
