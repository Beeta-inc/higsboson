// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import { CHARGING_TIERS } from '../lib/constants.js';

const UPowerIface = `
<node>
  <interface name="org.freedesktop.UPower.Device">
    <property name="Percentage" type="d" access="read"/>
    <property name="State" type="u" access="read"/>
    <property name="EnergyRate" type="d" access="read"/>
    <property name="IsPresent" type="b" access="read"/>
  </interface>
</node>`;

const UPowerProxy = Gio.DBusProxy.makeProxyWrapper(UPowerIface);

/**
 * SystemStatus module for Beeta UI.
 * Creates the right section of the top bar showing battery, Wi-Fi, volume, and time.
 */
export class SystemStatus {
    /**
     * @param {object} settings - Settings manager
     */
    constructor(settings) {
        this._settings = settings;
        this._actor = null;
        this._timeoutId = null;
        this._batteryProxy = null;
        this._batteryProxySignal = null;
        this._cancellable = new Gio.Cancellable();

        this._batteryBox = null;
        this._batteryIcon = null;
        this._batteryLabel = null;
        this._wifiIcon = null;
        this._bluetoothIcon = null;
        this._volumeIcon = null;
        this._timeLabel = null;
    }

    /**
     * Returns the St.BoxLayout container for the right panel
     * @returns {St.BoxLayout|null}
     */
    get actor() {
        return this._actor;
    }

    /**
     * Create the status widget and connect system signals
     */
    enable() {
        if (this._cancellable.is_cancelled()) {
            this._cancellable = new Gio.Cancellable();
        }

        this._actor = new St.BoxLayout({
            style_class: 'beeta-system-status',
            vertical: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'spacing: 8px;'
        });

        // 1. Wi-Fi
        this._wifiIcon = new St.Icon({
            icon_name: 'network-wireless-symbolic',
            style_class: 'beeta-status-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });

        // 2. Bluetooth
        this._bluetoothIcon = new St.Icon({
            icon_name: 'bluetooth-active-symbolic',
            style_class: 'beeta-status-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });

        // 3. Volume
        this._volumeIcon = new St.Icon({
            icon_name: 'audio-volume-medium-symbolic',
            style_class: 'beeta-status-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });

        // 4. Battery
        this._batteryBox = new St.BoxLayout({
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'spacing: 4px;'
        });

        this._batteryIcon = new St.Icon({
            icon_name: 'battery-level-100-symbolic',
            style_class: 'beeta-status-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._batteryLabel = new St.Label({
            text: '100%',
            style_class: 'beeta-status-label',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._batteryBox.add_child(this._batteryIcon);
        this._batteryBox.add_child(this._batteryLabel);

        // 5. Time
        this._timeLabel = new St.Label({
            text: this._getTimeString(),
            style_class: 'beeta-status-label',
            y_align: Clutter.ActorAlign.CENTER,
        });

        // Add all elements to the main container
        this._actor.add_child(this._wifiIcon);
        this._actor.add_child(this._bluetoothIcon);
        this._actor.add_child(this._volumeIcon);
        this._actor.add_child(this._batteryBox);
        this._actor.add_child(this._timeLabel);

        // Connect D-Bus proxy for UPower
        this._setupBattery();

        // Update time every minute
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
            this._updateTime();
            return GLib.SOURCE_CONTINUE;
        });
    }

    /**
     * Initialize the UPower DBus proxy
     * @private
     */
    _setupBattery() {
        // Hide by default until we confirm battery presence
        this._batteryBox.hide();

        new UPowerProxy(
            Gio.DBus.system,
            'org.freedesktop.UPower',
            '/org/freedesktop/UPower/devices/DisplayDevice',
            (proxy, error) => {
                if (error) {
                    console.error('Beeta UI: Failed to connect to UPower:', error.message);
                    return;
                }

                this._batteryProxy = proxy;

                // Connect to property changes
                this._batteryProxySignal = this._batteryProxy.connect(
                    'g-properties-changed',
                    this._updateBattery.bind(this)
                );

                this._updateBattery();
            },
            this._cancellable
        );
    }

    /**
     * Update battery icon and label based on UPower state
     * @private
     */
    _updateBattery() {
        if (!this._batteryProxy) return;

        const isPresent = this._batteryProxy.IsPresent;
        if (!isPresent) {
            this._batteryBox.hide();
            return;
        }

        this._batteryBox.show();

        const percentage = this._batteryProxy.Percentage || 0;
        const state = this._batteryProxy.State || 0;
        const energyRate = this._batteryProxy.EnergyRate || 0;

        // State: 1=Charging, 2=Discharging, 4=Full
        const isCharging = state === 1;
        const isFull = state === 4;

        this._batteryLabel.set_text(`${Math.round(percentage)}%`);

        // Icon name logic: round to nearest 10
        let level = Math.round(percentage / 10) * 10;
        level = Math.max(0, Math.min(100, level));

        let iconName = `battery-level-${level}-symbolic`;
        if (isCharging) {
            iconName = `battery-level-${level}-charging-symbolic`;
        } else if (isFull) {
            iconName = 'battery-level-100-charged-symbolic';
        }

        this._batteryIcon.set_icon_name(iconName);

        // Update CSS classes for Beeta styling
        this._batteryBox.remove_style_class_name('beeta-battery-charging');
        this._batteryBox.remove_style_class_name('beeta-battery-turbo');
        this._batteryBox.remove_style_class_name('beeta-battery-low');

        if (isCharging) {
            this._batteryBox.add_style_class_name('beeta-battery-charging');
            if (energyRate > CHARGING_TIERS.TURBO.minWatts) {
                this._batteryBox.add_style_class_name('beeta-battery-turbo');
            }
        } else if (percentage <= 20) {
            this._batteryBox.add_style_class_name('beeta-battery-low');
        }
    }

    /**
     * Get the current time string formatted as HH:MM AM/PM
     * @returns {string}
     * @private
     */
    _getTimeString() {
        return GLib.DateTime.new_now_local().format('%I:%M %p');
    }

    /**
     * Update the time label.
     * @private
     */
    _updateTime() {
        if (this._timeLabel) {
            this._timeLabel.set_text(this._getTimeString());
        }
    }

    /**
     * Destroy everything and clean up event listeners/timers.
     */
    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        this._cancellable.cancel();

        if (this._batteryProxy) {
            if (this._batteryProxySignal) {
                this._batteryProxy.disconnect(this._batteryProxySignal);
                this._batteryProxySignal = null;
            }
            this._batteryProxy = null;
        }

        if (this._actor) {
            this._actor.destroy();
            this._actor = null;
        }

        this._batteryBox = null;
        this._batteryIcon = null;
        this._batteryLabel = null;
        this._wifiIcon = null;
        this._bluetoothIcon = null;
        this._volumeIcon = null;
        this._timeLabel = null;
    }
}
