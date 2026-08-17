// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Smart App Launcher

import Shell from 'gi://Shell';
import GMenu from 'gi://GMenu';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import { ANIMATION } from '../lib/constants.js';

export class BeetaLauncher {
    constructor(settings, glassManager) {
        this._settings = settings;
        this._glassManager = glassManager;
        this._isOpen = false;
        this._overlay = null;
        this._tree = null;
        this._allApps = [];
        this._stageEventId = null;
    }

    enable() {
        // Nothing to do until opened
    }

    disable() {
        this.close(true);
    }

    toggle() {
        if (this._isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    get isOpen() {
        return this._isOpen;
    }

    open() {
        if (this._isOpen) return;
        this._isOpen = true;

        this._createOverlay();
        this._loadApps();
        this._populateCategories();
        this._populateFavorites();

        global.stage.add_child(this._overlay);

        const monitor = global.display.get_primary_monitor();
        const monitorGeometry = global.display.get_monitor_geometry(monitor);

        this._overlay.set_position(
            monitorGeometry.x + Math.floor((monitorGeometry.width - 640) / 2),
            monitorGeometry.y + monitorGeometry.height - 480 - 80 // Approx height above the dock
        );

        // Open Animation (Water ripple metaphor)
        this._overlay.opacity = 0;
        this._overlay.set_scale(0.95, 0.95);
        this._overlay.translation_y = 20;

        this._overlay.ease({
            opacity: 255,
            scale_x: 1.0,
            scale_y: 1.0,
            translation_y: 0,
            duration: ANIMATION.LAUNCHER_RISE || 350,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC
        });

        // Close on click outside or Escape key
        this._stageEventId = global.stage.connect('event', (actor, event) => {
            if (event.type() === Clutter.EventType.BUTTON_PRESS) {
                const target = event.get_source();
                if (this._overlay && !this._overlay.contains(target) && target !== this._overlay) {
                    this.close();
                }
            } else if (event.type() === Clutter.EventType.KEY_PRESS) {
                if (event.get_key_symbol() === Clutter.KEY_Escape) {
                    this.close();
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });
        
        // Ensure the search entry has focus
        this._searchEntry.clutter_text.grab_key_focus();
    }

    close(force = false) {
        if (!this._isOpen) return;
        this._isOpen = false;

        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = null;
        }

        if (force || !this._overlay) {
            this._destroyOverlay();
            return;
        }

        // Close Animation
        this._overlay.ease({
            opacity: 0,
            translation_y: 10,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => this._destroyOverlay()
        });
    }

    _destroyOverlay() {
        if (this._overlay) {
            this._glassManager.removeFrom(this._overlay);
            this._overlay.destroy();
            this._overlay = null;
        }
        this._tree = null;
    }

    _createOverlay() {
        this._overlay = new St.BoxLayout({
            style_class: 'beeta-launcher-overlay',
            vertical: true,
            width: 640,
            height: 480,
            reactive: true
        });

        // Apply glass blur effect
        this._glassManager.applyTo(this._overlay);

        // Search entry
        this._searchEntry = new St.Entry({
            style_class: 'beeta-search-entry',
            hint_text: 'Type to search...',
            can_focus: true,
            x_expand: true
        });

        this._searchEntry.clutter_text.connect('text-changed', () => {
            this._onSearchTextChanged();
        });

        const searchContainer = new St.BoxLayout({
            padding_bottom: 16
        });
        searchContainer.add_child(this._searchEntry);
        this._overlay.add_child(searchContainer);

        // Panes container
        const panesContainer = new St.BoxLayout({
            x_expand: true,
            y_expand: true
        });

        // Left pane (Most Used Apps / Filtered Apps)
        this._leftPaneScroll = new St.ScrollView({
            style_class: 'beeta-launcher-left-pane beeta-scrollbar',
            x_expand: false,
            y_expand: true,
            width: 220
        });

        this._leftPane = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });
        this._leftPaneScroll.add_actor(this._leftPane);

        // Right pane (Category Cards)
        this._rightPaneScroll = new St.ScrollView({
            style_class: 'beeta-launcher-right-pane beeta-scrollbar',
            x_expand: true,
            y_expand: true
        });

        this._rightPane = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });

        const layoutManager = new Clutter.GridLayout();
        layoutManager.column_spacing = 8;
        layoutManager.row_spacing = 8;

        this._categoryGrid = new St.Widget({
            layout_manager: layoutManager,
            x_expand: true,
            y_expand: true
        });

        this._rightPane.add_child(this._categoryGrid);
        this._rightPaneScroll.add_actor(this._rightPane);

        panesContainer.add_child(this._leftPaneScroll);
        panesContainer.add_child(this._rightPaneScroll);

        this._overlay.add_child(panesContainer);
    }

    _loadApps() {
        this._tree = new GMenu.Tree({ menu_basename: 'applications.menu' });
        this._tree.load_sync();

        this._allApps = Shell.AppSystem.get_default().get_installed().filter(app => {
            return app.get_app_info().should_show();
        });
    }

    _createAppItem(app) {
        if (typeof app === 'string') {
            app = Shell.AppSystem.get_default().lookup_app(app);
        }
        if (!app) return null;

        const btn = new St.Button({
            style_class: 'beeta-launcher-app-item',
            reactive: true,
            can_focus: true,
            x_expand: true
        });

        const box = new St.BoxLayout({
            vertical: false
        });

        const icon = app.create_icon_texture(28);
        if (icon) {
            icon.add_style_class_name('beeta-launcher-app-icon');
            box.add_child(icon);
        }

        const label = new St.Label({
            text: app.get_name(),
            style_class: 'beeta-launcher-app-name',
            y_align: Clutter.ActorAlign.CENTER
        });
        box.add_child(label);

        btn.set_child(box);

        btn.connect('clicked', () => {
            app.open_new_window(-1);
            this.close();
        });

        return btn;
    }

    _onSearchTextChanged() {
        const text = this._searchEntry.get_text().toLowerCase().trim();
        this._leftPane.destroy_all_children();

        if (text.length > 0) {
            // Hide categories during search
            this._rightPaneScroll.hide();

            const results = this._allApps.filter(app => {
                const name = app.get_name().toLowerCase();
                return name.includes(text);
            });

            this._leftPane.add_child(new St.Label({
                text: 'Search Results',
                style_class: 'beeta-launcher-section-title'
            }));

            for (const app of results) {
                const item = this._createAppItem(app);
                if (item) this._leftPane.add_child(item);
            }
        } else {
            // Restore default layout
            this._rightPaneScroll.show();
            this._populateFavorites();
        }
    }

    _showCategoryApps(categoryName, appIds) {
        this._leftPane.destroy_all_children();

        this._leftPane.add_child(new St.Label({
            text: categoryName,
            style_class: 'beeta-launcher-section-title'
        }));

        const appSys = Shell.AppSystem.get_default();
        for (const id of appIds) {
            const app = appSys.lookup_app(id);
            if (app) {
                const item = this._createAppItem(app);
                if (item) this._leftPane.add_child(item);
            }
        }

        const backBtn = new St.Button({
            style_class: 'beeta-launcher-app-item',
            reactive: true,
            can_focus: true,
            x_expand: true,
            margin_top: 8
        });
        const backLabel = new St.Label({
            text: '← Back to Most Used',
            style_class: 'beeta-launcher-app-name beeta-text-accent'
        });
        backBtn.set_child(backLabel);
        backBtn.connect('clicked', () => {
            this._populateFavorites();
        });
        this._leftPane.add_child(backBtn);
    }

    _populateFavorites() {
        this._leftPane.destroy_all_children();

        this._leftPane.add_child(new St.Label({
            text: 'Most Used',
            style_class: 'beeta-launcher-section-title'
        }));

        let favApps = [];
        try {
            if (global.settings && typeof global.settings.get_strv === 'function') {
                favApps = global.settings.get_strv('favorite-apps');
            } else {
                const settings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
                favApps = settings.get_strv('favorite-apps');
            }
        } catch (e) {
            console.warn(`[Beeta UI] Could not load favorite apps: ${e}`);
        }

        const appSys = Shell.AppSystem.get_default();
        for (const id of favApps) {
            const app = appSys.lookup_app(id);
            if (app) {
                const item = this._createAppItem(app);
                if (item) this._leftPane.add_child(item);
            }
        }

        const allAppsBtn = new St.Button({
            style_class: 'beeta-launcher-app-item',
            reactive: true,
            can_focus: true,
            x_expand: true,
            margin_top: 8
        });
        const allAppsLabel = new St.Label({
            text: 'All Applications →',
            style_class: 'beeta-launcher-app-name beeta-text-accent'
        });
        allAppsBtn.set_child(allAppsLabel);
        allAppsBtn.connect('clicked', () => {
            this._showCategoryApps('All Applications', this._allApps.map(a => a.get_id()));
        });
        this._leftPane.add_child(allAppsBtn);
    }

    _populateCategories() {
        this._categoryGrid.destroy_all_children();

        const root = this._tree.get_root_directory();
        const iter = root.iter();

        const categories = [];

        let nextType;
        while ((nextType = iter.next()) !== GMenu.TreeItemType.INVALID) {
            if (nextType === GMenu.TreeItemType.DIRECTORY) {
                const dir = iter.get_directory();
                const dirIter = dir.iter();
                let count = 0;
                let appType;
                const apps = [];
                while ((appType = dirIter.next()) !== GMenu.TreeItemType.INVALID) {
                    if (appType === GMenu.TreeItemType.ENTRY) {
                        const entry = dirIter.get_entry();
                        const appInfo = entry.get_app_info();
                        if (!appInfo.get_nodisplay()) {
                            count++;
                            apps.push(appInfo.get_id());
                        }
                    }
                }

                if (count > 0) {
                    categories.push({
                        name: dir.get_name(),
                        count: count,
                        apps: apps
                    });
                }
            }
        }

        const iconMap = {
            'Development': 'utilities-terminal-symbolic',
            'Games': 'applications-games-symbolic',
            'Multimedia': 'applications-multimedia-symbolic',
            'Audio & Video': 'applications-multimedia-symbolic',
            'Sound & Video': 'applications-multimedia-symbolic',
            'Office': 'x-office-document-symbolic',
            'Education': 'accessories-dictionary-symbolic',
            'System': 'preferences-system-symbolic',
            'System Tools': 'preferences-system-symbolic',
            'Utilities': 'applications-utilities-symbolic',
            'Accessories': 'applications-utilities-symbolic',
            'Internet': 'network-workgroup-symbolic',
            'Web': 'network-workgroup-symbolic'
        };

        const layoutManager = this._categoryGrid.layout_manager;
        let col = 0, row = 0;

        for (const cat of categories) {
            const card = new St.Button({
                style_class: 'beeta-category-card',
                reactive: true,
                can_focus: true,
                x_expand: true,
                y_expand: true
            });

            const box = new St.BoxLayout({
                vertical: true
            });

            const iconName = iconMap[cat.name] || 'application-x-executable-symbolic';
            const icon = new St.Icon({
                icon_name: iconName,
                style_class: 'beeta-category-icon'
            });

            const nameLabel = new St.Label({
                text: cat.name,
                style_class: 'beeta-category-name'
            });

            const countLabel = new St.Label({
                text: `${cat.count} Apps`,
                style_class: 'beeta-category-count'
            });

            box.add_child(icon);
            box.add_child(nameLabel);
            box.add_child(countLabel);

            card.set_child(box);

            card.connect('clicked', () => {
                this._showCategoryApps(cat.name, cat.apps);
            });

            layoutManager.attach(card, col, row, 1, 1);

            col++;
            if (col > 1) {
                col = 0;
                row++;
            }
        }
    }
}
