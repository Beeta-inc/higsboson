// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Main Extension Entry Point
// Orchestrates all Beeta UI modules with proper lifecycle management

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { SettingsManager } from './lib/settings.js';
import { GlassEffectManager } from './modules/glassEffect.js';
import { TopBarManager } from './modules/topBar.js';
import { WorkspaceIndicator } from './modules/workspaceIndicator.js';
import { LiveCenter } from './modules/liveCenter.js';
import { SystemStatus } from './modules/systemStatus.js';
import { MediaController } from './modules/mediaController.js';
import { BottomDock } from './modules/bottomDock.js';
import { BeetaLauncher } from './modules/beetaLauncher.js';
import { AdaptiveNature } from './modules/adaptiveNature.js';
import { WeatherService } from './modules/weatherService.js';
import { DesktopWidgets } from './modules/desktopWidgets.js';
import { LiveWallpaper } from './modules/liveWallpaper.js';

/**
 * BeetaUIExtension
 *
 * The main orchestrator for the Beeta UI GNOME Shell extension.
 * Manages the lifecycle of all sub-modules with proper enable/disable
 * symmetry and resource cleanup.
 *
 * Architecture:
 *   Extension (this) → Settings, GlassEffect, TopBar, LiveCenter,
 *                       WorkspaceIndicator, SystemStatus, MediaController,
 *                       BottomDock, BeetaLauncher, AdaptiveNature,
 *                       WeatherService, DesktopWidgets
 *
 * Lifecycle:
 *   enable()  → Create all managers in dependency order
 *   disable() → Destroy all managers in reverse order
 */
export default class BeetaUIExtension extends Extension {

    enable() {
        console.log('[Beeta UI] Enabling Beeta UI Extension...');

        // ─── 1. Settings ─────────────────────────────────────────
        this._settings = new SettingsManager(this.getSettings());

        // ─── 2. Core Services (no UI dependencies) ───────────────
        this._glassManager = new GlassEffectManager();

        this._liveWallpaper = new LiveWallpaper(this._settings);
        this._liveWallpaper.enable();

        this._weatherService = new WeatherService(this._settings);
        this._weatherService.start();

        this._mediaController = new MediaController();
        this._mediaController.start();

        // ─── 3. Top Bar Components ───────────────────────────────
        this._workspaceIndicator = new WorkspaceIndicator(this._settings);
        this._workspaceIndicator.enable();

        this._liveCenter = new LiveCenter(this._settings, this._mediaController);
        this._liveCenter.enable();

        this._systemStatus = new SystemStatus(this._settings);
        this._systemStatus.enable();

        this._topBar = new TopBarManager(
            this._settings,
            this._glassManager,
            this._workspaceIndicator,
            this._liveCenter,
            this._systemStatus
        );
        this._topBar.enable();

        // ─── 4. Bottom Dock & Launcher ───────────────────────────
        this._beetaLauncher = new BeetaLauncher(this._settings, this._glassManager);
        this._beetaLauncher.enable();

        this._bottomDock = new BottomDock(
            this._settings,
            this._glassManager,
            this._beetaLauncher,
            this._weatherService
        );
        this._bottomDock.enable();

        // ─── 5. Desktop Widgets ──────────────────────────────────
        this._desktopWidgets = new DesktopWidgets(
            this._settings,
            this._glassManager,
            this._weatherService
        );
        this._desktopWidgets.enable();

        // ─── 6. Adaptive Nature™ (last — adjusts all surfaces) ──
        this._adaptiveNature = new AdaptiveNature(
            this._settings,
            this._glassManager,
            this._weatherService,
            this._topBar,
            this._bottomDock
        );
        this._adaptiveNature.enable();

        // ─── 7. Focus State Management ───────────────────────────
        this._setupFocusStateTracking();

        console.log('[Beeta UI] Beeta UI Extension enabled successfully.');
    }

    disable() {
        console.log('[Beeta UI] Disabling Beeta UI Extension...');

        // ─── Reverse order teardown ──────────────────────────────

        // 7. Focus state tracking
        this._teardownFocusStateTracking();

        // 6. Adaptive Nature™
        if (this._adaptiveNature) {
            this._adaptiveNature.disable();
            this._adaptiveNature = null;
        }

        // 5. Desktop Widgets
        if (this._desktopWidgets) {
            this._desktopWidgets.disable();
            this._desktopWidgets = null;
        }

        // 4. Bottom Dock & Launcher
        if (this._bottomDock) {
            this._bottomDock.disable();
            this._bottomDock = null;
        }

        if (this._beetaLauncher) {
            this._beetaLauncher.disable();
            this._beetaLauncher = null;
        }

        // 3. Top Bar Components
        if (this._topBar) {
            this._topBar.disable();
            this._topBar = null;
        }

        if (this._systemStatus) {
            this._systemStatus.disable();
            this._systemStatus = null;
        }

        if (this._liveCenter) {
            this._liveCenter.disable();
            this._liveCenter = null;
        }

        if (this._workspaceIndicator) {
            this._workspaceIndicator.disable();
            this._workspaceIndicator = null;
        }

        // 2. Core Services
        if (this._mediaController) {
            this._mediaController.stop();
            this._mediaController = null;
        }

        if (this._weatherService) {
            this._weatherService.stop();
            this._weatherService = null;
        }

        if (this._liveWallpaper) {
            this._liveWallpaper.disable();
            this._liveWallpaper = null;
        }

        if (this._glassManager) {
            this._glassManager.destroy();
            this._glassManager = null;
        }

        // 1. Settings
        if (this._settings) {
            this._settings.destroy();
            this._settings = null;
        }

        console.log('[Beeta UI] Beeta UI Extension disabled successfully.');
    }

    // ═══════════════════════════════════════════════════════════
    // Focus State Management
    // ═══════════════════════════════════════════════════════════

    /**
     * Track when windows are maximized/fullscreen to switch between
     * Desktop State (full UI) and Focus State (minimal UI).
     *
     * Desktop State: All panels, dock, widgets visible
     * Focus State: Top bar minimal (Live Center + battery only),
     *              bottom dock hidden, desktop widgets hidden
     * @private
     */
    _setupFocusStateTracking() {
        this._focusState = false;  // false = Desktop, true = Focus
        this._focusSignals = [];

        // Track window restacking (maximized, focused, etc.)
        const restackId = global.display.connect('restacked', () => {
            this._evaluateFocusState();
        });
        this._focusSignals.push({ target: global.display, id: restackId });

        // Track workspace switches
        const wsId = global.workspace_manager.connect('active-workspace-changed', () => {
            this._evaluateFocusState();
        });
        this._focusSignals.push({ target: global.workspace_manager, id: wsId });

        // Initial evaluation
        this._evaluateFocusState();
    }

    /**
     * Clean up focus state tracking signals.
     * @private
     */
    _teardownFocusStateTracking() {
        if (this._focusSignals) {
            for (const { target, id } of this._focusSignals) {
                try {
                    target.disconnect(id);
                } catch {
                    // Target may be destroyed
                }
            }
            this._focusSignals = [];
        }

        // Ensure Desktop State is restored
        if (this._focusState) {
            this._setFocusState(false);
        }
    }

    /**
     * Check if any window on the current workspace is maximized
     * or fullscreen on the primary monitor.
     * @private
     */
    _evaluateFocusState() {
        const workspace = global.workspace_manager.get_active_workspace();
        if (!workspace) return;

        const primaryMonitor = global.display.get_primary_monitor();
        const windows = workspace.list_windows();

        let shouldFocus = false;

        for (const win of windows) {
            if (win.is_override_redirect())
                continue;
            if (!win.showing_on_its_workspace())
                continue;
            if (win.get_monitor() !== primaryMonitor)
                continue;

            if (win.get_maximized() === Meta.MaximizeFlags.BOTH ||
                win.is_fullscreen()) {
                shouldFocus = true;
                break;
            }
        }

        if (shouldFocus !== this._focusState) {
            this._setFocusState(shouldFocus);
        }
    }

    /**
     * Apply Focus or Desktop state to all UI components.
     * @param {boolean} focus - true = Focus State, false = Desktop State
     * @private
     */
    _setFocusState(focus) {
        this._focusState = focus;

        if (this._topBar)
            this._topBar.setFocusState(focus);

        if (this._bottomDock)
            this._bottomDock.setFocusState(focus);

        if (this._desktopWidgets)
            this._desktopWidgets.setFocusState(focus);
    }
}
