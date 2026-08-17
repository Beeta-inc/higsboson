// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { safeDestroy } from '../lib/utils.js';

/**
 * WorkspaceIndicator class for the Beeta UI top bar.
 * Creates a row of dots representing workspaces, with interactive
 * switching and animated transitions on active workspace change.
 */
export class WorkspaceIndicator {
    /**
     * @param {object} settings - The settings manager instance.
     */
    constructor(settings) {
        this._settings = settings;
        this._actor = null;
        this._dots = [];
        this._signalIds = [];
        this._workspaceManager = global.workspace_manager;
    }

    /**
     * @returns {St.BoxLayout} The workspace indicator container actor.
     */
    get actor() {
        return this._actor;
    }

    /**
     * Creates the indicator widget and connects signals.
     */
    enable() {
        this._actor = new St.BoxLayout({
            style_class: 'beeta-workspace-container',
            vertical: false,
        });

        // Initialize dots
        this._syncDots();

        // Listen for workspace changes
        this._signalIds.push(
            this._workspaceManager.connect('notify::n-workspaces', this._syncDots.bind(this)),
            this._workspaceManager.connect('active-workspace-changed', this._updateActiveDot.bind(this))
        );
    }

    /**
     * Disconnects signals and destroys all actors.
     */
    disable() {
        for (const signalId of this._signalIds) {
            this._workspaceManager.disconnect(signalId);
        }
        this._signalIds = [];
        this._dots = [];

        safeDestroy(this._actor);
        this._actor = null;
    }

    /**
     * Synchronizes the number of dots with the number of workspaces.
     * @private
     */
    _syncDots() {
        if (!this._actor) return;

        this._actor.destroy_all_children();
        this._dots = [];

        const nWorkspaces = this._workspaceManager.get_n_workspaces();
        const activeWorkspaceIndex = this._workspaceManager.get_active_workspace().index();

        for (let i = 0; i < nWorkspaces; i++) {
            const isActive = (i === activeWorkspaceIndex);
            
            const dot = new St.Widget({
                style_class: isActive ? 'beeta-workspace-dot-active' : 'beeta-workspace-dot',
                reactive: true,
                track_hover: true,
            });
            
            // Allow clicking a dot to switch to its workspace
            dot.connect('button-press-event', () => {
                const workspace = this._workspaceManager.get_workspace_by_index(i);
                if (workspace) {
                    workspace.activate(global.get_current_time());
                }
                return Clutter.EVENT_STOP;
            });

            this._actor.add_child(dot);
            this._dots.push(dot);
        }
    }

    /**
     * Updates the active dot and triggers the pill animation.
     * @private
     */
    _updateActiveDot() {
        if (!this._actor) return;
        
        const activeWorkspaceIndex = this._workspaceManager.get_active_workspace().index();
        
        for (let i = 0; i < this._dots.length; i++) {
            const dot = this._dots[i];
            
            if (i === activeWorkspaceIndex) {
                dot.style_class = 'beeta-workspace-dot-pill';
                
                // Pill animation sequence on workspace switch
                dot.ease({
                    width: 20,
                    duration: 150,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        dot.style_class = 'beeta-workspace-dot-active';
                        dot.ease({
                            width: 8,
                            duration: 150,
                            mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD
                        });
                    }
                });
            } else {
                // Ensure inactive dots are reset properly
                dot.style_class = 'beeta-workspace-dot';
                dot.remove_transition('width');
                dot.width = 8;
            }
        }
    }
}
