// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — MPRIS Media Controller
// Handles D-Bus integration for media players

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const MPRIS_PLAYER_IFACE_XML = `
<node>
    <interface name="org.mpris.MediaPlayer2.Player">
        <method name="PlayPause" />
        <method name="Next" />
        <method name="Previous" />
        <method name="Stop" />
        <method name="Play" />
        <method name="Pause" />
        <property name="PlaybackStatus" type="s" access="read" />
        <property name="Metadata" type="a{sv}" access="read" />
    </interface>
</node>
`;

const PlayerProxy = Gio.DBusProxy.makeProxyWrapper(MPRIS_PLAYER_IFACE_XML);

/**
 * Controller for MPRIS D-Bus integration
 */
export class MediaController {
    constructor() {
        this.onTrackChanged = null;
        this.onStatusChanged = null;
        this.onPlayerAppeared = null;
        this.onPlayerVanished = null;

        this._players = new Map();
        this._activePlayerName = null;
        this._dbusConnection = null;
        this._nameOwnerChangedId = 0;
    }

    /**
     * Begin watching D-Bus for MPRIS players
     */
    start() {
        this._dbusConnection = Gio.bus_get_sync(Gio.BusType.SESSION, null);

        // Watch for org.mpris.MediaPlayer2.* bus names appearing/disappearing
        // We use NameOwnerChanged to catch all names matching the wildcard
        this._nameOwnerChangedId = this._dbusConnection.signal_subscribe(
            'org.freedesktop.DBus',
            'org.freedesktop.DBus',
            'NameOwnerChanged',
            '/org/freedesktop/DBus',
            null,
            Gio.DBusSignalFlags.NONE,
            this._onNameOwnerChanged.bind(this)
        );

        // Get initially active players
        this._dbusConnection.call(
            'org.freedesktop.DBus',
            '/org/freedesktop/DBus',
            'org.freedesktop.DBus',
            'ListNames',
            null,
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, result) => {
                try {
                    const reply = connection.call_finish(result);
                    if (reply) {
                        const names = reply.get_child_value(0).get_strv();
                        for (const name of names) {
                            if (name.startsWith('org.mpris.MediaPlayer2.')) {
                                this._addPlayer(name);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to get initial DBus names:', e);
                }
            }
        );
    }

    /**
     * Clean up all proxies and watchers
     */
    stop() {
        if (this._nameOwnerChangedId && this._dbusConnection) {
            this._dbusConnection.signal_unsubscribe(this._nameOwnerChangedId);
            this._nameOwnerChangedId = 0;
        }

        for (const [busName, player] of this._players.entries()) {
            if (player.signalId) {
                player.proxy.disconnect(player.signalId);
            }
        }

        this._players.clear();
        this._activePlayerName = null;
        this._dbusConnection = null;
    }

    _onNameOwnerChanged(connection, sender, objectPath, interfaceName, signalName, parameters) {
        const [name, oldOwner, newOwner] = parameters.deep_unpack();
        if (name.startsWith('org.mpris.MediaPlayer2.')) {
            if (newOwner && !oldOwner) {
                this._addPlayer(name);
            } else if (!newOwner && oldOwner) {
                this._removePlayer(name);
            }
        }
    }

    _addPlayer(busName) {
        if (this._players.has(busName)) {
            return;
        }

        const proxy = new PlayerProxy(
            Gio.DBus.session,
            busName,
            '/org/mpris/MediaPlayer2',
            (p, error) => {
                if (error) {
                    console.error(`Failed to create proxy for ${busName}:`, error);
                    return;
                }

                const signalId = proxy.connect('g-properties-changed', this._onPropertiesChanged.bind(this, busName));
                
                this._players.set(busName, {
                    proxy,
                    signalId,
                    metadata: proxy.Metadata,
                    playbackStatus: proxy.PlaybackStatus,
                });

                this._setActivePlayer(busName);

                if (this.onPlayerAppeared) {
                    this.onPlayerAppeared(busName);
                }
                
                this._notifyChanges();
            }
        );
    }

    _removePlayer(busName) {
        const player = this._players.get(busName);
        if (player) {
            if (player.signalId) {
                player.proxy.disconnect(player.signalId);
            }
            this._players.delete(busName);

            if (this._activePlayerName === busName) {
                this._activePlayerName = this._players.keys().next().value || null;
            }

            if (this.onPlayerVanished) {
                this.onPlayerVanished(busName);
            }
            
            this._notifyChanges();
        }
    }

    _onPropertiesChanged(busName, proxy, changed) {
        const player = this._players.get(busName);
        if (!player) return;

        const unpacked = changed.deep_unpack();
        
        if (unpacked.Metadata !== undefined) {
            player.metadata = unpacked.Metadata;
        }
        
        if (unpacked.PlaybackStatus !== undefined) {
            player.playbackStatus = unpacked.PlaybackStatus.unpack();
        }

        // Set as active player due to interaction/activity
        this._setActivePlayer(busName);
        this._notifyChanges();
    }

    _setActivePlayer(busName) {
        this._activePlayerName = busName;
    }

    _notifyChanges() {
        if (this.onTrackChanged) {
            this.onTrackChanged(this.currentTrack);
        }
        if (this.onStatusChanged) {
            this.onStatusChanged(this.playbackStatus);
        }
    }

    /**
     * Unpack MPRIS metadata variant to a clean object
     * @param {GLib.Variant} metadataVariant 
     * @returns {Object|null}
     */
    _parseMetadata(metadataVariant) {
        if (!metadataVariant) return null;
        
        let unpacked;
        try {
            unpacked = metadataVariant.deep_unpack();
        } catch (e) {
            return null;
        }

        let title = 'Unknown Title';
        let artist = 'Unknown Artist';
        let album = '';
        let artUrl = '';

        if (unpacked['xesam:title']) {
            title = unpacked['xesam:title'].deep_unpack();
        }

        if (unpacked['xesam:artist']) {
            const artistVariant = unpacked['xesam:artist'].deep_unpack();
            if (Array.isArray(artistVariant) && artistVariant.length > 0) {
                artist = artistVariant[0];
            } else if (typeof artistVariant === 'string') {
                artist = artistVariant;
            }
        }

        if (unpacked['xesam:album']) {
            album = unpacked['xesam:album'].deep_unpack();
        }

        if (unpacked['mpris:artUrl']) {
            artUrl = unpacked['mpris:artUrl'].deep_unpack();
        }

        return { title, artist, album, artUrl };
    }

    /**
     * @returns {Object|null} { title, artist, album, artUrl, busName }
     */
    get currentTrack() {
        if (!this._activePlayerName || !this._players.has(this._activePlayerName)) {
            return null;
        }
        
        const player = this._players.get(this._activePlayerName);
        const parsed = this._parseMetadata(player.metadata);
        if (!parsed) return null;

        return {
            ...parsed,
            busName: this._activePlayerName
        };
    }

    /**
     * @returns {string} 'Playing' | 'Paused' | 'Stopped'
     */
    get playbackStatus() {
        if (!this._activePlayerName || !this._players.has(this._activePlayerName)) {
            return 'Stopped';
        }
        return this._players.get(this._activePlayerName).playbackStatus || 'Stopped';
    }

    /**
     * @returns {boolean}
     */
    get hasActivePlayer() {
        return this._players.size > 0;
    }

    /**
     * Send PlayPause to the most recent active player
     */
    playPause() {
        if (this._activePlayerName && this._players.has(this._activePlayerName)) {
            this._players.get(this._activePlayerName).proxy.PlayPauseRemote();
        }
    }

    /**
     * Send Next to the most recent active player
     */
    next() {
        if (this._activePlayerName && this._players.has(this._activePlayerName)) {
            this._players.get(this._activePlayerName).proxy.NextRemote();
        }
    }

    /**
     * Send Previous to the most recent active player
     */
    previous() {
        if (this._activePlayerName && this._players.has(this._activePlayerName)) {
            this._players.get(this._activePlayerName).proxy.PreviousRemote();
        }
    }
}
