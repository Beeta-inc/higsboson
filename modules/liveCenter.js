// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Live Center
// Dynamic status island in the center of the top bar
// The signature feature of Beeta OS

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { ANIMATION, LIVE_CENTER_PRIORITY } from '../lib/constants.js';
import { getFormattedTime, safeDestroy } from '../lib/utils.js';

/**
 * LiveCenter
 *
 * A dynamic status island that sits in the center of the top bar.
 * It intelligently switches between showing different content based
 * on what's happening:
 *
 * Default:   10:42 · Tuesday
 * Media:     ▶ Spotify — Imagine Dragons · Believer
 * Timer:     ⏳ 12:41 remaining
 * Download:  ⬇ Ubuntu.iso · 73%
 * Recording: 🎤 Recording...
 *
 * The Live Center prioritizes content based on activity type.
 * Media playback takes highest priority (after calls).
 * When clicked, it expands into a floating card showing all
 * active activities.
 */
export class LiveCenter {
    /**
     * @param {import('../lib/settings.js').SettingsManager} settings
     * @param {import('./mediaController.js').MediaController} mediaController
     */
    constructor(settings, mediaController) {
        this._settings = settings;
        this._mediaController = mediaController;
        this._actor = null;
        this._clockTimerId = null;
        this._currentMode = 'clock';    // 'clock' | 'media' | 'timer' | 'download' | 'recording'
        this._signalIds = [];
    }

    /**
     * Create the Live Center widget and start updating.
     */
    enable() {
        // ─── Main container (clickable pill) ─────────────────────
        this._actor = new St.Button({
            style_class: 'beeta-live-center',
            reactive: true,
            can_focus: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        // ─── Content box (swapped based on mode) ─────────────────
        this._contentBox = new St.BoxLayout({
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._actor.set_child(this._contentBox);

        // ─── Build clock display (default) ───────────────────────
        this._buildClockDisplay();
        this._showClock();

        // ─── Start clock timer ───────────────────────────────────
        this._updateClock();
        this._clockTimerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            30,  // Update every 30 seconds
            () => {
                this._updateClock();
                return GLib.SOURCE_CONTINUE;
            }
        );

        // ─── Connect to media controller ─────────────────────────
        if (this._mediaController && this._settings.liveCenterShowMedia) {
            this._mediaController.onTrackChanged = (trackInfo) => {
                this._onTrackChanged(trackInfo);
            };
            this._mediaController.onStatusChanged = (status) => {
                this._onPlaybackStatusChanged(status);
            };
            this._mediaController.onPlayerVanished = (busName) => {
                this._onPlayerGone(busName);
            };

            // Check if media is already playing
            if (this._mediaController.hasActivePlayer &&
                this._mediaController.playbackStatus === 'Playing') {
                this._onTrackChanged(this._mediaController.currentTrack);
            }
        }

        // ─── Click handler: expand card ──────────────────────────
        this._clickId = this._actor.connect('clicked', () => {
            this._toggleExpanded();
        });
    }

    /**
     * Destroy the Live Center and clean up.
     */
    disable() {
        // Remove clock timer
        if (this._clockTimerId) {
            GLib.Source.remove(this._clockTimerId);
            this._clockTimerId = null;
        }

        // Disconnect click handler
        if (this._clickId && this._actor) {
            this._actor.disconnect(this._clickId);
            this._clickId = null;
        }

        // Disconnect media controller callbacks
        if (this._mediaController) {
            this._mediaController.onTrackChanged = null;
            this._mediaController.onStatusChanged = null;
            this._mediaController.onPlayerVanished = null;
        }

        // Destroy expanded card if open
        this._closeExpanded();

        // Destroy actor
        safeDestroy(this._actor);
        this._actor = null;
        this._contentBox = null;
        this._clockBox = null;
        this._mediaBox = null;
    }

    /**
     * Get the main actor for embedding in the panel.
     * @returns {St.Button}
     */
    get actor() {
        return this._actor;
    }

    // ═══════════════════════════════════════════════════════════
    // Clock Display
    // ═══════════════════════════════════════════════════════════

    /**
     * Build the clock/time display widgets.
     * @private
     */
    _buildClockDisplay() {
        this._clockBox = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._timeLabel = new St.Label({
            style_class: 'beeta-live-center-time',
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._dayLabel = new St.Label({
            style_class: 'beeta-live-center-subtitle',
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._clockBox.add_child(this._timeLabel);
        this._clockBox.add_child(this._dayLabel);
    }

    /**
     * Update the clock labels with current time.
     * @private
     */
    _updateClock() {
        if (!this._timeLabel) return;

        const { time, period, day } = getFormattedTime(false);
        this._timeLabel.set_text(`${time} ${period}`);
        this._dayLabel.set_text(day);
    }

    /**
     * Show the clock display (default mode).
     * @private
     */
    _showClock() {
        if (this._currentMode === 'clock') return;
        this._switchContent(this._clockBox, 'clock');
        this._actor.style_class = 'beeta-live-center';
    }

    // ═══════════════════════════════════════════════════════════
    // Media Display
    // ═══════════════════════════════════════════════════════════

    /**
     * Build the media display widgets.
     * @private
     */
    _buildMediaDisplay() {
        this._mediaBox = new St.BoxLayout({
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
            spacing: 8,
        });

        // Album art (small circle)
        this._mediaArt = new St.Icon({
            style_class: 'beeta-live-center-album-art',
            icon_name: 'audio-x-generic-symbolic',
            icon_size: 24,
        });

        // Text column
        this._mediaTextBox = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._mediaTrackLabel = new St.Label({
            style_class: 'beeta-live-center-track',
            x_align: Clutter.ActorAlign.START,
        });

        this._mediaArtistLabel = new St.Label({
            style_class: 'beeta-live-center-artist',
            x_align: Clutter.ActorAlign.START,
        });

        this._mediaTextBox.add_child(this._mediaTrackLabel);
        this._mediaTextBox.add_child(this._mediaArtistLabel);

        // Control buttons
        this._mediaControls = new St.BoxLayout({
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
            spacing: 2,
        });

        this._prevButton = this._createMediaButton('media-skip-backward-symbolic', () => {
            this._mediaController?.previous();
        });

        this._playPauseButton = this._createMediaButton('media-playback-start-symbolic', () => {
            this._mediaController?.playPause();
        });

        this._nextButton = this._createMediaButton('media-skip-forward-symbolic', () => {
            this._mediaController?.next();
        });

        this._mediaControls.add_child(this._prevButton);
        this._mediaControls.add_child(this._playPauseButton);
        this._mediaControls.add_child(this._nextButton);

        this._mediaBox.add_child(this._mediaArt);
        this._mediaBox.add_child(this._mediaTextBox);
        this._mediaBox.add_child(this._mediaControls);
    }

    /**
     * Create a media control button.
     * @param {string} iconName
     * @param {Function} callback
     * @returns {St.Button}
     * @private
     */
    _createMediaButton(iconName, callback) {
        const button = new St.Button({
            style_class: 'beeta-media-control',
            can_focus: true,
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
            child: new St.Icon({
                icon_name: iconName,
                icon_size: 14,
            }),
        });

        button.connect('clicked', () => {
            callback();
            return Clutter.EVENT_STOP;
        });

        return button;
    }

    /**
     * Handle track change from media controller.
     * @param {{ title: string, artist: string, album: string, artUrl: string }} trackInfo
     * @private
     */
    _onTrackChanged(trackInfo) {
        if (!trackInfo || !trackInfo.title) {
            this._showClock();
            return;
        }

        // Build media display if not created
        if (!this._mediaBox)
            this._buildMediaDisplay();

        // Update labels
        const title = trackInfo.title || 'Unknown Track';
        const artist = trackInfo.artist || 'Unknown Artist';

        // Truncate long titles
        this._mediaTrackLabel.set_text(
            title.length > 25 ? title.substring(0, 25) + '…' : title
        );
        this._mediaArtistLabel.set_text(
            artist.length > 30 ? artist.substring(0, 30) + '…' : artist
        );

        // Switch to media mode
        if (this._currentMode !== 'media') {
            this._switchContent(this._mediaBox, 'media');
            this._actor.style_class = 'beeta-live-center-media';
        }
    }

    /**
     * Handle playback status change.
     * @param {'Playing'|'Paused'|'Stopped'} status
     * @private
     */
    _onPlaybackStatusChanged(status) {
        if (!this._playPauseButton) return;

        if (status === 'Playing') {
            this._playPauseButton.child.icon_name = 'media-playback-pause-symbolic';
        } else {
            this._playPauseButton.child.icon_name = 'media-playback-start-symbolic';
        }

        // If stopped, go back to clock
        if (status === 'Stopped') {
            this._showClock();
        }
    }

    /**
     * Handle player disappearing.
     * @param {string} busName
     * @private
     */
    _onPlayerGone(busName) {
        if (!this._mediaController?.hasActivePlayer) {
            this._showClock();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Content Switching
    // ═══════════════════════════════════════════════════════════

    /**
     * Smoothly switch the displayed content with a crossfade.
     * @param {St.Widget} newContent - The new content widget
     * @param {string} mode - The new mode name
     * @private
     */
    _switchContent(newContent, mode) {
        if (!this._contentBox) return;

        const oldMode = this._currentMode;
        this._currentMode = mode;

        // If content box has existing children, crossfade
        const existingChildren = this._contentBox.get_children();
        if (existingChildren.length > 0) {
            // Fade out old content
            for (const child of existingChildren) {
                child.ease({
                    opacity: 0,
                    duration: ANIMATION.LIVE_CENTER_SWAP,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        if (child.get_parent() === this._contentBox)
                            this._contentBox.remove_child(child);
                    },
                });
            }

            // Fade in new content after a small delay
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, ANIMATION.LIVE_CENTER_SWAP, () => {
                if (!this._contentBox) return GLib.SOURCE_REMOVE;

                newContent.opacity = 0;
                this._contentBox.add_child(newContent);
                newContent.ease({
                    opacity: 255,
                    duration: ANIMATION.LIVE_CENTER_SWAP,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });

                return GLib.SOURCE_REMOVE;
            });
        } else {
            // No existing content, just add
            newContent.opacity = 0;
            this._contentBox.add_child(newContent);
            newContent.ease({
                opacity: 255,
                duration: ANIMATION.NORMAL,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Expanded Card View
    // ═══════════════════════════════════════════════════════════

    /**
     * Toggle the expanded card view below the Live Center.
     * @private
     */
    _toggleExpanded() {
        if (this._expandedCard) {
            this._closeExpanded();
        } else {
            this._openExpanded();
        }
    }

    /**
     * Open the expanded card showing all active activities.
     * @private
     */
    _openExpanded() {
        if (this._expandedCard) return;

        this._expandedCard = new St.BoxLayout({
            style_class: 'beeta-live-center-expanded',
            vertical: true,
            reactive: true,
        });

        // ─── Now Playing section ─────────────────────────────────
        if (this._mediaController?.hasActivePlayer) {
            const track = this._mediaController.currentTrack;
            const mediaSection = this._buildExpandedMediaSection(track);
            this._expandedCard.add_child(mediaSection);
        }

        // ─── Clock section ───────────────────────────────────────
        const clockSection = this._buildExpandedClockSection();
        this._expandedCard.add_child(clockSection);

        // ─── Position below the Live Center ──────────────────────
        const [actorX, actorY] = this._actor.get_transformed_position();
        const [actorW, actorH] = this._actor.get_transformed_size();

        this._expandedCard.set_position(
            actorX + (actorW / 2) - 160,  // Center-ish
            actorY + actorH + 8
        );

        // Add to UI layer
        this._expandedCard.opacity = 0;
        this._expandedCard.translation_y = -10;

        global.stage.add_child(this._expandedCard);

        this._expandedCard.ease({
            opacity: 255,
            translation_y: 0,
            duration: ANIMATION.NORMAL,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
        });

        // Close on click outside
        this._expandedClickId = global.stage.connect('event', (actor, event) => {
            if (event.type() !== Clutter.EventType.BUTTON_PRESS &&
                event.type() !== Clutter.EventType.TOUCH_BEGIN)
                return Clutter.EVENT_PROPAGATE;

            const [eventX, eventY] = event.get_coords();
            const [cardX, cardY] = this._expandedCard.get_transformed_position();
            const [cardW, cardH] = this._expandedCard.get_transformed_size();

            // Check if click is inside the card or the Live Center button
            const inCard = eventX >= cardX && eventX <= cardX + cardW &&
                           eventY >= cardY && eventY <= cardY + cardH;
            const inButton = eventX >= actorX && eventX <= actorX + actorW &&
                             eventY >= actorY && eventY <= actorY + actorH;

            if (!inCard && !inButton) {
                this._closeExpanded();
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        });
    }

    /**
     * Close the expanded card.
     * @private
     */
    _closeExpanded() {
        if (this._expandedClickId) {
            global.stage.disconnect(this._expandedClickId);
            this._expandedClickId = null;
        }

        if (this._expandedCard) {
            this._expandedCard.ease({
                opacity: 0,
                translation_y: -10,
                duration: ANIMATION.FAST,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => {
                    safeDestroy(this._expandedCard);
                    this._expandedCard = null;
                },
            });
        }
    }

    /**
     * Build the media section for the expanded card.
     * @param {{ title: string, artist: string }} track
     * @returns {St.BoxLayout}
     * @private
     */
    _buildExpandedMediaSection(track) {
        const section = new St.BoxLayout({
            vertical: false,
            spacing: 12,
            style: 'margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);',
        });

        const albumArt = new St.Icon({
            icon_name: 'audio-x-generic-symbolic',
            icon_size: 48,
            style: 'border-radius: 8px;',
        });

        const textBox = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });

        textBox.add_child(new St.Label({
            text: 'Now Playing',
            style: 'font-size: 10px; font-weight: 600; color: rgba(140, 180, 255, 0.8); text-transform: uppercase; letter-spacing: 1px;',
        }));

        textBox.add_child(new St.Label({
            text: track?.title || 'Unknown Track',
            style: 'font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.95); margin-top: 2px;',
        }));

        textBox.add_child(new St.Label({
            text: track?.artist || 'Unknown Artist',
            style: 'font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.60); margin-top: 1px;',
        }));

        section.add_child(albumArt);
        section.add_child(textBox);

        // Control buttons
        const controls = new St.BoxLayout({
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
            spacing: 8,
        });

        const prevBtn = this._createMediaButton('media-skip-backward-symbolic', () => {
            this._mediaController?.previous();
        });
        const playBtn = this._createMediaButton(
            this._mediaController?.playbackStatus === 'Playing'
                ? 'media-playback-pause-symbolic'
                : 'media-playback-start-symbolic',
            () => { this._mediaController?.playPause(); }
        );
        const nextBtn = this._createMediaButton('media-skip-forward-symbolic', () => {
            this._mediaController?.next();
        });

        controls.add_child(prevBtn);
        controls.add_child(playBtn);
        controls.add_child(nextBtn);

        section.add_child(controls);

        return section;
    }

    /**
     * Build the clock section for the expanded card.
     * @returns {St.BoxLayout}
     * @private
     */
    _buildExpandedClockSection() {
        const section = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
        });

        const { time, period, day, date } = getFormattedTime(false);

        section.add_child(new St.Label({
            text: `${time} ${period}`,
            style: 'font-size: 28px; font-weight: 700; color: rgba(255,255,255,0.95); text-align: center;',
            x_align: Clutter.ActorAlign.CENTER,
        }));

        section.add_child(new St.Label({
            text: `${day}, ${date}`,
            style: 'font-size: 13px; font-weight: 400; color: rgba(255,255,255,0.55); text-align: center; margin-top: 2px;',
            x_align: Clutter.ActorAlign.CENTER,
        }));

        return section;
    }
}
