// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Glass Effect Manager
// Beeta Glass™ — Shell.BlurEffect orchestration for frosted glassmorphism

import Shell from 'gi://Shell';
import St from 'gi://St';

import { GLASS } from '../lib/constants.js';
import { getScaleFactor } from '../lib/utils.js';

/**
 * GlassEffectManager
 *
 * Manages Shell.BlurEffect instances across all Beeta UI surfaces.
 * Handles HiDPI scaling, performance-aware blur toggling, and
 * consistent visual parameters across all glass panels.
 *
 * Usage:
 *   const glass = new GlassEffectManager();
 *   glass.applyTo(actor, { sigma: 30, brightness: 0.75 });
 *   glass.removeFrom(actor);
 *   glass.destroy();  // Cleans up all managed effects
 */
export class GlassEffectManager {
    constructor() {
        this._managedEffects = new Map();  // actor → Shell.BlurEffect
        this._enabled = true;
        this._scaleFactor = getScaleFactor();

        // Listen for scale factor changes (monitor hotplug, HiDPI toggle)
        this._themeContext = St.ThemeContext.get_for_stage(global.stage);
        this._scaleChangedId = this._themeContext.connect('notify::scale-factor', () => {
            this._scaleFactor = this._themeContext.scale_factor;
            this._updateAllEffects();
        });
    }

    /**
     * Apply a frosted glass blur effect to an actor.
     *
     * @param {import('gi://Clutter').Actor} actor - The Clutter/St actor
     * @param {object} [options] - Effect parameters
     * @param {number} [options.sigma] - Blur radius (before HiDPI scaling)
     * @param {number} [options.brightness] - Background brightness (0.0–1.0)
     * @param {string} [options.name] - Effect name for identification
     * @returns {Shell.BlurEffect} The created effect
     */
    applyTo(actor, options = {}) {
        const {
            sigma = GLASS.SIGMA,
            brightness = GLASS.BRIGHTNESS,
            name = 'beeta-glass-blur',
        } = options;

        // Remove existing effect if any
        this.removeFrom(actor, name);

        const effect = new Shell.BlurEffect({
            sigma: Math.round(sigma * this._scaleFactor),
            brightness,
            mode: Shell.BlurMode.BACKGROUND,
        });

        actor.add_effect_with_name(name, effect);
        this._managedEffects.set(actor, { effect, name, sigma, brightness });

        return effect;
    }

    /**
     * Remove a glass blur effect from an actor.
     *
     * @param {import('gi://Clutter').Actor} actor
     * @param {string} [name] - Effect name
     */
    removeFrom(actor, name = 'beeta-glass-blur') {
        if (this._managedEffects.has(actor)) {
            try {
                actor.remove_effect_by_name(name);
            } catch {
                // Effect may have been removed already
            }
            this._managedEffects.delete(actor);
        } else {
            // Try removing by name even if not tracked
            try {
                actor.remove_effect_by_name(name);
            } catch {
                // No effect to remove
            }
        }
    }

    /**
     * Update blur parameters for an existing effect.
     *
     * @param {import('gi://Clutter').Actor} actor
     * @param {object} params
     * @param {number} [params.sigma]
     * @param {number} [params.brightness]
     */
    updateEffect(actor, params = {}) {
        const managed = this._managedEffects.get(actor);
        if (!managed) return;

        if (params.sigma !== undefined) {
            managed.sigma = params.sigma;
            managed.effect.sigma = Math.round(params.sigma * this._scaleFactor);
        }
        if (params.brightness !== undefined) {
            managed.brightness = params.brightness;
            managed.effect.brightness = params.brightness;
        }
    }

    /**
     * Enable or disable all managed glass effects.
     * Used by Adaptive Motion™ for Power Saver mode.
     *
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this._enabled = enabled;

        for (const [actor, managed] of this._managedEffects) {
            try {
                const effect = actor.get_effect(managed.name);
                if (effect)
                    effect.set_enabled(enabled);
            } catch {
                // Actor may have been destroyed
            }
        }
    }

    /**
     * Reduce blur quality for power saving.
     * Lowers sigma and increases brightness to reduce GPU load.
     *
     * @param {boolean} reduced
     */
    setPowerSaving(reduced) {
        for (const [actor, managed] of this._managedEffects) {
            try {
                if (reduced) {
                    managed.effect.sigma = Math.round((managed.sigma * 0.5) * this._scaleFactor);
                    managed.effect.brightness = Math.min(managed.brightness + 0.1, 1.0);
                } else {
                    managed.effect.sigma = Math.round(managed.sigma * this._scaleFactor);
                    managed.effect.brightness = managed.brightness;
                }
            } catch {
                // Actor may have been destroyed
            }
        }
    }

    /**
     * Update all effects when scale factor changes.
     * @private
     */
    _updateAllEffects() {
        for (const [actor, managed] of this._managedEffects) {
            try {
                managed.effect.sigma = Math.round(managed.sigma * this._scaleFactor);
            } catch {
                // Actor may have been destroyed, clean up
                this._managedEffects.delete(actor);
            }
        }
    }

    /**
     * Clean up all managed effects and signal connections.
     */
    destroy() {
        // Remove all blur effects from actors
        for (const [actor, managed] of this._managedEffects) {
            try {
                actor.remove_effect_by_name(managed.name);
            } catch {
                // Actor may already be destroyed
            }
        }
        this._managedEffects.clear();

        // Disconnect scale factor listener
        if (this._scaleChangedId && this._themeContext) {
            this._themeContext.disconnect(this._scaleChangedId);
            this._scaleChangedId = null;
        }
        this._themeContext = null;
    }
}
