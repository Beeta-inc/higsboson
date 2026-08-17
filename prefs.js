// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Extension Preferences
// GTK4/Adwaita preferences window

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BeetaUIPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(720, 620);

        // ═══════════════════════════════════════════════════
        // General Page
        // ═══════════════════════════════════════════════════
        const generalPage = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(generalPage);

        // --- Adaptive Nature™ ---
        const adaptiveGroup = new Adw.PreferencesGroup({
            title: 'Adaptive Nature™',
            description: 'Environment-aware theming that adapts to time, weather, and context',
        });
        generalPage.add(adaptiveGroup);

        const adaptiveRow = new Adw.ComboRow({
            title: 'Theme Mode',
            subtitle: 'How the UI adapts to your environment',
        });
        adaptiveRow.set_model(Gtk.StringList.new(['Static', 'Adaptive', 'Expressive']));
        const modeMap = { 'static': 0, 'adaptive': 1, 'expressive': 2 };
        const modeMapReverse = ['static', 'adaptive', 'expressive'];
        adaptiveRow.set_selected(modeMap[settings.get_string('adaptive-nature-mode')] || 1);
        adaptiveRow.connect('notify::selected', () => {
            settings.set_string('adaptive-nature-mode', modeMapReverse[adaptiveRow.selected]);
        });
        adaptiveGroup.add(adaptiveRow);

        // --- Adaptive Motion™ ---
        const motionRow = new Adw.SwitchRow({
            title: 'Adaptive Motion™',
            subtitle: 'Automatically reduce animations on battery or low-end hardware',
        });
        settings.bind('adaptive-motion-enabled', motionRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        adaptiveGroup.add(motionRow);

        const animSpeedRow = new Adw.ComboRow({
            title: 'Animation Speed',
            subtitle: 'Controls animation intensity',
        });
        animSpeedRow.set_model(Gtk.StringList.new(['Reduced', 'Normal', 'Expressive']));
        const speedMap = { 'reduced': 0, 'normal': 1, 'expressive': 2 };
        const speedMapReverse = ['reduced', 'normal', 'expressive'];
        animSpeedRow.set_selected(speedMap[settings.get_string('animation-speed')] || 1);
        animSpeedRow.connect('notify::selected', () => {
            settings.set_string('animation-speed', speedMapReverse[animSpeedRow.selected]);
        });
        adaptiveGroup.add(animSpeedRow);

        // --- User ---
        const userGroup = new Adw.PreferencesGroup({
            title: 'User',
        });
        generalPage.add(userGroup);

        const nameRow = new Adw.EntryRow({
            title: 'Display Name',
        });
        settings.bind('user-display-name', nameRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        userGroup.add(nameRow);

        // ═══════════════════════════════════════════════════
        // Appearance Page
        // ═══════════════════════════════════════════════════
        const appearancePage = new Adw.PreferencesPage({
            title: 'Appearance',
            icon_name: 'applications-graphics-symbolic',
        });
        window.add(appearancePage);

        // --- Glass ---
        const glassGroup = new Adw.PreferencesGroup({
            title: 'Beeta Glass™',
            description: 'Frosted glassmorphism appearance settings',
        });
        appearancePage.add(glassGroup);

        const opacityRow = new Adw.SpinRow({
            title: 'Glass Opacity',
            subtitle: 'Background opacity of glass surfaces',
            adjustment: new Gtk.Adjustment({
                lower: 0.3,
                upper: 0.95,
                step_increment: 0.05,
                value: settings.get_double('glass-opacity'),
            }),
            digits: 2,
        });
        opacityRow.adjustment.connect('value-changed', () => {
            settings.set_double('glass-opacity', opacityRow.adjustment.value);
        });
        glassGroup.add(opacityRow);

        const blurRow = new Adw.SpinRow({
            title: 'Blur Intensity',
            subtitle: 'Gaussian blur radius (higher = more blurry, more GPU usage)',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 60,
                step_increment: 5,
                value: settings.get_int('blur-sigma'),
            }),
            digits: 0,
        });
        blurRow.adjustment.connect('value-changed', () => {
            settings.set_int('blur-sigma', Math.round(blurRow.adjustment.value));
        });
        glassGroup.add(blurRow);

        const brightnessRow = new Adw.SpinRow({
            title: 'Blur Brightness',
            subtitle: 'Brightness of the blurred background',
            adjustment: new Gtk.Adjustment({
                lower: 0.3,
                upper: 1.0,
                step_increment: 0.05,
                value: settings.get_double('blur-brightness'),
            }),
            digits: 2,
        });
        brightnessRow.adjustment.connect('value-changed', () => {
            settings.set_double('blur-brightness', brightnessRow.adjustment.value);
        });
        glassGroup.add(brightnessRow);

        // ═══════════════════════════════════════════════════
        // Dock Page
        // ═══════════════════════════════════════════════════
        const dockPage = new Adw.PreferencesPage({
            title: 'Dock',
            icon_name: 'view-app-grid-symbolic',
        });
        window.add(dockPage);

        const dockGroup = new Adw.PreferencesGroup({
            title: 'Bottom Dock',
        });
        dockPage.add(dockGroup);

        const autohideRow = new Adw.SwitchRow({
            title: 'Auto-Hide in Focus State',
            subtitle: 'Hide the dock when a window is maximized',
        });
        settings.bind('dock-autohide', autohideRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dockGroup.add(autohideRow);

        const iconSizeRow = new Adw.SpinRow({
            title: 'Icon Size',
            subtitle: 'Size of app icons in the dock',
            adjustment: new Gtk.Adjustment({
                lower: 24,
                upper: 64,
                step_increment: 4,
                value: settings.get_int('dock-icon-size'),
            }),
            digits: 0,
        });
        iconSizeRow.adjustment.connect('value-changed', () => {
            settings.set_int('dock-icon-size', Math.round(iconSizeRow.adjustment.value));
        });
        dockGroup.add(iconSizeRow);

        const pulseRow = new Adw.SwitchRow({
            title: 'Resource Pulse',
            subtitle: 'Show color-coded activity indicators on running apps',
        });
        settings.bind('dock-show-resource-pulse', pulseRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dockGroup.add(pulseRow);

        // ═══════════════════════════════════════════════════
        // Weather Page
        // ═══════════════════════════════════════════════════
        const weatherPage = new Adw.PreferencesPage({
            title: 'Weather',
            icon_name: 'weather-clear-symbolic',
        });
        window.add(weatherPage);

        const weatherGroup = new Adw.PreferencesGroup({
            title: 'Weather Settings',
        });
        weatherPage.add(weatherGroup);

        const autoLocRow = new Adw.SwitchRow({
            title: 'Auto-Detect Location',
            subtitle: 'Use GeoClue2 for automatic location detection',
        });
        settings.bind('weather-auto-location', autoLocRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        weatherGroup.add(autoLocRow);

        const latRow = new Adw.SpinRow({
            title: 'Latitude',
            adjustment: new Gtk.Adjustment({
                lower: -90,
                upper: 90,
                step_increment: 0.01,
                value: settings.get_double('weather-latitude'),
            }),
            digits: 4,
        });
        latRow.adjustment.connect('value-changed', () => {
            settings.set_double('weather-latitude', latRow.adjustment.value);
        });
        weatherGroup.add(latRow);

        const lonRow = new Adw.SpinRow({
            title: 'Longitude',
            adjustment: new Gtk.Adjustment({
                lower: -180,
                upper: 180,
                step_increment: 0.01,
                value: settings.get_double('weather-longitude'),
            }),
            digits: 4,
        });
        lonRow.adjustment.connect('value-changed', () => {
            settings.set_double('weather-longitude', lonRow.adjustment.value);
        });
        weatherGroup.add(lonRow);

        const unitRow = new Adw.ComboRow({
            title: 'Temperature Unit',
        });
        unitRow.set_model(Gtk.StringList.new(['Celsius', 'Fahrenheit']));
        unitRow.set_selected(settings.get_string('temperature-unit') === 'fahrenheit' ? 1 : 0);
        unitRow.connect('notify::selected', () => {
            settings.set_string('temperature-unit', unitRow.selected === 1 ? 'fahrenheit' : 'celsius');
        });
        weatherGroup.add(unitRow);

        // ═══════════════════════════════════════════════════
        // Live Wallpaper Page
        // ═══════════════════════════════════════════════════
        const wallpaperPage = new Adw.PreferencesPage({
            title: 'Wallpaper',
            icon_name: 'preferences-desktop-wallpaper-symbolic',
        });
        window.add(wallpaperPage);

        const wpGroup = new Adw.PreferencesGroup({
            title: 'Live Wallpaper',
            description: 'Use a video file as your desktop wallpaper',
        });
        wallpaperPage.add(wpGroup);

        const wpEnabledRow = new Adw.SwitchRow({
            title: 'Enable Live Wallpaper',
            subtitle: 'Requires GStreamer and may impact battery life',
        });
        settings.bind('live-wallpaper-enabled', wpEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        wpGroup.add(wpEnabledRow);

        const wpPathRow = new Adw.EntryRow({
            title: 'Video File Path',
        });
        settings.bind('live-wallpaper-path', wpPathRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        wpGroup.add(wpPathRow);

        const wpMuteRow = new Adw.SwitchRow({
            title: 'Mute Audio',
            subtitle: 'Mute the audio track of the live wallpaper',
        });
        settings.bind('live-wallpaper-mute', wpMuteRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        wpGroup.add(wpMuteRow);

        // ═══════════════════════════════════════════════════
        // Widgets Page
        // ═══════════════════════════════════════════════════
        const widgetsPage = new Adw.PreferencesPage({
            title: 'Widgets',
            icon_name: 'user-home-symbolic',
        });
        window.add(widgetsPage);

        const widgetGroup = new Adw.PreferencesGroup({
            title: 'Desktop Widgets',
        });
        widgetsPage.add(widgetGroup);

        const showWidgetsRow = new Adw.SwitchRow({
            title: 'Show Desktop Widgets',
            subtitle: 'Display weather and greeting on the desktop',
        });
        settings.bind('show-desktop-widgets', showWidgetsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        widgetGroup.add(showWidgetsRow);

        const liveCenterGroup = new Adw.PreferencesGroup({
            title: 'Live Center',
        });
        widgetsPage.add(liveCenterGroup);

        const lcMediaRow = new Adw.SwitchRow({
            title: 'Show Media in Live Center',
            subtitle: 'Display currently playing media info',
        });
        settings.bind('live-center-show-media', lcMediaRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        liveCenterGroup.add(lcMediaRow);

        const lcFocusRow = new Adw.SwitchRow({
            title: 'Show in Focus State',
            subtitle: 'Keep Live Center visible when apps are maximized',
        });
        settings.bind('live-center-show-in-focus', lcFocusRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        liveCenterGroup.add(lcFocusRow);
    }
}
