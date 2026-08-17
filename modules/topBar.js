// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Top Bar Manager
// Transforms the GNOME Shell top panel into the Beeta glass surface

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { ANIMATION, GLASS } from '../lib/constants.js';

/**
 * TopBarManager
 *
 * Manages the transformation of the default GNOME Shell top panel
 * into the Beeta UI glass surface. Hides default panel contents
 * and injects Beeta components (workspace indicator, Live Center,
 * system status) into the three panel sections.
 *
 * Supports two states:
 * - Desktop State: Full panel visible with all sections
 * - Focus State: Minimal panel (Live Center + battery only)
 */
export class TopBarManager {
    /**
     * @param {import('../lib/settings.js').SettingsManager} settings
     * @param {import('./glassEffect.js').GlassEffectManager} glassManager
     * @param {import('./workspaceIndicator.js').WorkspaceIndicator} workspaceIndicator
     * @param {import('./liveCenter.js').LiveCenter} liveCenter
     * @param {import('./systemStatus.js').SystemStatus} systemStatus
     */
    constructor(settings, glassManager, workspaceIndicator, liveCenter, systemStatus) {
        this._settings = settings;
        this._glassManager = glassManager;
        this._workspaceIndicator = workspaceIndicator;
        this._liveCenter = liveCenter;
        this._systemStatus = systemStatus;

        this._panel = null;
        this._originalChildren = { left: [], center: [], right: [] };
        this._focusState = false;
    }

    /**
     * Enable the Beeta top bar transformation.
     * Saves original panel children, makes panel transparent,
     * applies glass blur, and injects Beeta components.
     */
    enable() {
        this._panel = Main.panel;
        if (!this._panel) return;

        // ─── Save original panel children ────────────────────────
        this._saveOriginalChildren();

        // ─── Hide default panel contents ─────────────────────────
        this._hideDefaultContent();

        // ─── Apply glass styling ─────────────────────────────────
        this._panel.add_style_class_name('beeta-top-bar');
        this._panel.add_style_class_name('beeta-panel-transparent');

        // Apply backdrop blur to the panel
        this._glassManager.applyTo(this._panel, {
            sigma: this._settings.blurSigma,
            brightness: this._settings.blurBrightness,
            name: 'beeta-panel-blur',
        });

        // ─── Inject Beeta components ─────────────────────────────
        this._injectComponents();

        // ─── Listen for settings changes ─────────────────────────
        this._settingsSignals = [];
        this._settingsSignals.push(
            this._settings.onChanged('blur-sigma', () => {
                this._glassManager.updateEffect(this._panel, {
                    sigma: this._settings.blurSigma,
                });
            })
        );
        this._settingsSignals.push(
            this._settings.onChanged('blur-brightness', () => {
                this._glassManager.updateEffect(this._panel, {
                    brightness: this._settings.blurBrightness,
                });
            })
        );
    }

    /**
     * Restore the original GNOME Shell panel.
     */
    disable() {
        if (!this._panel) return;

        // Remove Beeta components
        this._removeComponents();

        // Remove glass effect
        this._glassManager.removeFrom(this._panel, 'beeta-panel-blur');

        // Remove Beeta styling
        this._panel.remove_style_class_name('beeta-top-bar');
        this._panel.remove_style_class_name('beeta-panel-transparent');

        // Restore original panel children
        this._restoreOriginalChildren();

        this._panel = null;
    }

    /**
     * Switch between Desktop State and Focus State.
     * @param {boolean} focus - true = Focus State (minimal)
     */
    setFocusState(focus) {
        if (this._focusState === focus) return;
        this._focusState = focus;

        if (focus) {
            // Focus State: hide workspace indicator, show only Live Center + minimal status
            if (this._workspaceIndicator?.actor) {
                this._workspaceIndicator.actor.ease({
                    opacity: 0,
                    duration: ANIMATION.NORMAL,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        this._workspaceIndicator.actor.hide();
                    },
                });
            }

            // Fade system status to minimal (just time/battery)
            if (this._systemStatus)
                this._systemStatus.setMinimal(true);
        } else {
            // Desktop State: show everything
            if (this._workspaceIndicator?.actor) {
                this._workspaceIndicator.actor.show();
                this._workspaceIndicator.actor.ease({
                    opacity: 255,
                    duration: ANIMATION.NORMAL,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
            }

            if (this._systemStatus)
                this._systemStatus.setMinimal(false);
        }
    }

    /**
     * Get the adaptive tint color for the panel.
     * Called by Adaptive Nature™ to update the panel border/accent.
     * @param {string} style - CSS style string for inline tinting
     */
    setAdaptiveTint(style) {
        if (this._panel)
            this._panel.set_style(style);
    }

    // ═══════════════════════════════════════════════════════════
    // Private Methods
    // ═══════════════════════════════════════════════════════════

    /**
     * Save references to original panel children for restoration.
     * @private
     */
    _saveOriginalChildren() {
        const boxes = {
            left: this._panel._leftBox,
            center: this._panel._centerBox,
            right: this._panel._rightBox,
        };

        for (const [section, box] of Object.entries(boxes)) {
            this._originalChildren[section] = [];
            const children = box.get_children();
            for (const child of children) {
                this._originalChildren[section].push({
                    actor: child,
                    visible: child.visible,
                });
            }
        }
    }

    /**
     * Hide default GNOME panel contents.
     * @private
     */
    _hideDefaultContent() {
        // Hide all children in left, center, right boxes
        for (const section of ['left', 'center', 'right']) {
            for (const { actor } of this._originalChildren[section]) {
                actor.hide();
            }
        }
    }

    /**
     * Restore original panel children visibility.
     * @private
     */
    _restoreOriginalChildren() {
        for (const section of ['left', 'center', 'right']) {
            for (const { actor, visible } of this._originalChildren[section]) {
                if (visible)
                    actor.show();
            }
        }
        this._originalChildren = { left: [], center: [], right: [] };
    }

    /**
     * Inject Beeta UI components into the panel boxes.
     * @private
     */
    _injectComponents() {
        // ─── Left Box: Workspace Indicator ───────────────────────
        if (this._workspaceIndicator?.actor) {
            this._panel._leftBox.insert_child_at_index(
                this._workspaceIndicator.actor, 0
            );
        }

        // ─── Center Box: Live Center ─────────────────────────────
        if (this._liveCenter?.actor) {
            this._panel._centerBox.insert_child_at_index(
                this._liveCenter.actor, 0
            );
        }

        // ─── Right Box: System Status ────────────────────────────
        if (this._systemStatus?.actor) {
            this._panel._rightBox.insert_child_at_index(
                this._systemStatus.actor, 0
            );
        }
    }

    /**
     * Remove Beeta UI components from the panel boxes.
     * @private
     */
    _removeComponents() {
        // Remove workspace indicator
        if (this._workspaceIndicator?.actor) {
            const parent = this._workspaceIndicator.actor.get_parent();
            if (parent)
                parent.remove_child(this._workspaceIndicator.actor);
        }

        // Remove Live Center
        if (this._liveCenter?.actor) {
            const parent = this._liveCenter.actor.get_parent();
            if (parent)
                parent.remove_child(this._liveCenter.actor);
        }

        // Remove System Status
        if (this._systemStatus?.actor) {
            const parent = this._systemStatus.actor.get_parent();
            if (parent)
                parent.remove_child(this._systemStatus.actor);
        }
    }
}
