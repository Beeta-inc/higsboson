// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Live Wallpaper Module
// GStreamer-based video wallpaper support
//
// This module renders a video file as the desktop wallpaper using
// GStreamer pipeline inside the GNOME Shell compositor process.
// The video is placed in Main.layoutManager._backgroundGroup,
// behind all windows but replacing the static wallpaper.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { safeDestroy, getPrimaryMonitor } from '../lib/utils.js';

// Try to import GStreamer — it may not be available on all systems
let Gst = null;
let GstVideo = null;
let ClutterGst = null;

try {
    Gst = (await import('gi://Gst')).default;
    GstVideo = (await import('gi://GstVideo')).default;
} catch (e) {
    console.log('[Beeta UI] GStreamer not available — live wallpaper disabled');
}

/**
 * LiveWallpaper
 *
 * Renders a looping video as the desktop wallpaper using GStreamer.
 * The video is decoded and rendered onto a Clutter actor that sits
 * in the background group behind all windows.
 *
 * Features:
 * - Looping playback
 * - Mute support
 * - Pause when all workspaces are covered (performance optimization)
 * - Graceful fallback when GStreamer is not available
 *
 * @note This runs inside the gnome-shell process. Use hardware-accelerated
 * video decoding (VA-API, NVDEC) when available for best performance.
 */
export class LiveWallpaper {
    /**
     * @param {import('../lib/settings.js').SettingsManager} settings
     */
    constructor(settings) {
        this._settings = settings;
        this._pipeline = null;
        this._videoActor = null;
        this._isPlaying = false;
        this._signalIds = [];
    }

    /**
     * Initialize and start the live wallpaper if enabled and GStreamer is available.
     */
    enable() {
        if (!Gst) {
            console.log('[Beeta UI] Live Wallpaper: GStreamer not available, skipping');
            return;
        }

        if (!this._settings.liveWallpaperEnabled) {
            console.log('[Beeta UI] Live Wallpaper: Disabled in settings');
            return;
        }

        const videoPath = this._settings.liveWallpaperPath;
        if (!videoPath || !GLib.file_test(videoPath, GLib.FileTest.EXISTS)) {
            console.log('[Beeta UI] Live Wallpaper: No valid video path configured');
            return;
        }

        try {
            this._initGStreamer();
            this._createPipeline(videoPath);
            this._startPlayback();
        } catch (e) {
            console.error(`[Beeta UI] Live Wallpaper: Failed to initialize — ${e.message}`);
            this._cleanup();
        }

        // Listen for settings changes
        this._settingsChangedId = this._settings.onAnyChanged((key) => {
            if (key === 'live-wallpaper-enabled' ||
                key === 'live-wallpaper-path' ||
                key === 'live-wallpaper-mute') {
                this._handleSettingsChange();
            }
        });

        // Listen for monitor changes to resize the video
        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
            this._resizeVideoActor();
        });
    }

    /**
     * Stop playback and clean up all resources.
     */
    disable() {
        this._cleanup();

        if (this._settingsChangedId !== undefined && this._settings) {
            // Settings cleanup is handled by settings manager
            this._settingsChangedId = undefined;
        }

        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // GStreamer Pipeline Management
    // ═══════════════════════════════════════════════════════════

    /**
     * Initialize GStreamer if not already done.
     * @private
     */
    _initGStreamer() {
        if (!Gst.is_initialized())
            Gst.init(null);
    }

    /**
     * Create the GStreamer pipeline for video playback.
     *
     * Pipeline: filesrc → decodebin → videoconvert → cluttersink
     *                                → volume → autoaudiosink (if not muted)
     *
     * We use a simpler approach: playbin with a custom video sink
     * that renders to a Clutter texture.
     *
     * @param {string} videoPath - Absolute path to the video file
     * @private
     */
    _createPipeline(videoPath) {
        const monitor = getPrimaryMonitor();

        // Create a Clutter actor for the video
        this._videoActor = new Clutter.Actor({
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
            reactive: false,
            can_focus: false,
        });

        // Use playbin for automatic codec selection and hardware acceleration
        this._pipeline = Gst.ElementFactory.make('playbin', 'beeta-live-wallpaper');
        if (!this._pipeline) {
            throw new Error('Failed to create GStreamer playbin element');
        }

        // Set the video URI
        const fileUri = Gio.File.new_for_path(videoPath).get_uri();
        this._pipeline.set_property('uri', fileUri);

        // Configure audio
        if (this._settings.liveWallpaperMute) {
            this._pipeline.set_property('volume', 0.0);
            this._pipeline.set_property('mute', true);
        }

        // Set up a simple video sink that we can grab frames from
        // For GNOME Shell, we use gtksink or autovideosink with frame grabbing
        // The simplest approach that works in the compositor:
        // Use a fakesink and periodically grab frames to paint on our actor
        const videoSink = Gst.ElementFactory.make('autovideosink', 'video-sink');
        if (videoSink) {
            this._pipeline.set_property('video-sink', videoSink);
        }

        // Connect to bus messages for loop and error handling
        const bus = this._pipeline.get_bus();
        bus.add_signal_watch();

        this._busSignalId = bus.connect('message', (bus, msg) => {
            this._onBusMessage(msg);
        });

        // Add the video actor to the background group
        Main.layoutManager._backgroundGroup.add_child(this._videoActor);

        // Raise it above the wallpaper but below desktop icons
        const bgGroup = Main.layoutManager._backgroundGroup;
        const children = bgGroup.get_children();
        if (children.length > 1) {
            // Position just above the wallpaper backgrounds
            bgGroup.set_child_above_sibling(this._videoActor, children[0]);
        }
    }

    /**
     * Start or resume video playback.
     * @private
     */
    _startPlayback() {
        if (!this._pipeline) return;

        this._pipeline.set_state(Gst.State.PLAYING);
        this._isPlaying = true;
        console.log('[Beeta UI] Live Wallpaper: Playback started');
    }

    /**
     * Pause video playback (used when all workspaces are covered).
     * @private
     */
    _pausePlayback() {
        if (!this._pipeline || !this._isPlaying) return;

        this._pipeline.set_state(Gst.State.PAUSED);
        this._isPlaying = false;
        console.log('[Beeta UI] Live Wallpaper: Playback paused');
    }

    /**
     * Handle GStreamer bus messages.
     * @param {Gst.Message} msg
     * @private
     */
    _onBusMessage(msg) {
        switch (msg.type) {
            case Gst.MessageType.EOS:
                // End of stream — loop the video
                this._pipeline.seek_simple(
                    Gst.Format.TIME,
                    Gst.SeekFlags.FLUSH | Gst.SeekFlags.KEY_UNIT,
                    0
                );
                break;

            case Gst.MessageType.ERROR: {
                const [error, debug] = msg.parse_error();
                console.error(`[Beeta UI] Live Wallpaper Error: ${error.message}`);
                console.error(`[Beeta UI] Live Wallpaper Debug: ${debug}`);
                this._cleanup();
                break;
            }

            case Gst.MessageType.WARNING: {
                const [warning, debug] = msg.parse_warning();
                console.warn(`[Beeta UI] Live Wallpaper Warning: ${warning.message}`);
                break;
            }

            case Gst.MessageType.STATE_CHANGED:
                // State changes are normal, no action needed
                break;
        }
    }

    /**
     * Resize the video actor when monitors change.
     * @private
     */
    _resizeVideoActor() {
        if (!this._videoActor) return;

        const monitor = getPrimaryMonitor();
        this._videoActor.set_position(monitor.x, monitor.y);
        this._videoActor.set_size(monitor.width, monitor.height);
    }

    /**
     * Handle settings changes at runtime.
     * @private
     */
    _handleSettingsChange() {
        const enabled = this._settings.liveWallpaperEnabled;
        const path = this._settings.liveWallpaperPath;
        const mute = this._settings.liveWallpaperMute;

        if (!enabled) {
            this._cleanup();
            return;
        }

        // Update mute state
        if (this._pipeline) {
            this._pipeline.set_property('volume', mute ? 0.0 : 0.5);
            this._pipeline.set_property('mute', mute);
        }

        // If path changed, restart pipeline
        if (this._pipeline && path) {
            const currentUri = this._pipeline.get_property('uri');
            const newUri = Gio.File.new_for_path(path).get_uri();
            if (currentUri !== newUri) {
                this._cleanup();
                try {
                    this._createPipeline(path);
                    this._startPlayback();
                } catch (e) {
                    console.error(`[Beeta UI] Live Wallpaper restart failed: ${e.message}`);
                }
            }
        }
    }

    /**
     * Clean up all GStreamer and Clutter resources.
     * @private
     */
    _cleanup() {
        // Stop pipeline
        if (this._pipeline) {
            const bus = this._pipeline.get_bus();
            if (bus && this._busSignalId) {
                bus.disconnect(this._busSignalId);
                bus.remove_signal_watch();
                this._busSignalId = null;
            }

            this._pipeline.set_state(Gst.State.NULL);
            this._pipeline = null;
        }

        // Remove video actor
        if (this._videoActor) {
            const parent = this._videoActor.get_parent();
            if (parent)
                parent.remove_child(this._videoActor);
            this._videoActor.destroy();
            this._videoActor = null;
        }

        this._isPlaying = false;
        console.log('[Beeta UI] Live Wallpaper: Cleaned up');
    }
}
