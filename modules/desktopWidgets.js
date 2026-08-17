import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { getTimeOfDay, weatherCodeToEmoji, weatherCodeToCondition, formatTemperature } from '../lib/utils.js';

export class DesktopWidgets {
    /**
     * @param {object} settings - Extension settings
     * @param {object} glassManager - GlassEffectManager instance
     * @param {object} weatherService - WeatherService instance
     */
    constructor(settings, glassManager, weatherService) {
        this._settings = settings;
        this._glassManager = glassManager;
        this._weatherService = weatherService;

        this._widgetContainer = null;
        this._greetingLabel = null;
        this._tempEmoji = null;
        this._tempLarge = null;
        this._tempCondition = null;
        this._detailsLabel = null;
        this._forecastRow = null;

        this._updateTimerId = null;
        this._weatherCallback = null;
    }

    enable() {
        if (!this._settings.showDesktopWidgets) return;

        this._createWidgets();

        // Subscribe to weather updates
        if (this._weatherService) {
            this._weatherCallback = (data) => this._updateWeather(data);
            if (typeof this._weatherService.onWeatherUpdated === 'function') {
                this._weatherService.onWeatherUpdated(this._weatherCallback);
            } else {
                this._weatherService.onWeatherUpdated = this._weatherCallback;
            }
            
            // Initial weather load if available
            if (this._weatherService.currentWeather) {
                this._updateWeather(this._weatherService.currentWeather);
            }
        }

        // Update greeting every 5 minutes (300 seconds)
        this._updateTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 300, () => {
            this._updateGreeting();
            return GLib.SOURCE_CONTINUE;
        });

        this._updateGreeting();
    }

    disable() {
        if (this._updateTimerId) {
            GLib.Source.remove(this._updateTimerId);
            this._updateTimerId = null;
        }

        if (this._weatherService && this._weatherCallback) {
            if (typeof this._weatherService.removeWeatherUpdatedListener === 'function') {
                this._weatherService.removeWeatherUpdatedListener(this._weatherCallback);
            } else if (this._weatherService.onWeatherUpdated === this._weatherCallback) {
                this._weatherService.onWeatherUpdated = null;
            }
            this._weatherCallback = null;
        }

        if (this._widgetContainer) {
            if (this._widgetContainer.get_parent()) {
                this._widgetContainer.get_parent().remove_child(this._widgetContainer);
            }
            this._widgetContainer.destroy();
            this._widgetContainer = null;
        }
    }

    setFocusState(focus) {
        if (!this._widgetContainer) return;

        if (focus) {
            this._widgetContainer.ease({
                opacity: 0,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        } else {
            this._widgetContainer.ease({
                opacity: 255,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        }
    }

    _createWidgets() {
        const monitor = Main.layoutManager.primaryMonitor;

        this._widgetContainer = new St.BoxLayout({
            vertical: true,
            style_class: 'beeta-desktop-widget',
            x: monitor.x + 40,
            y: monitor.y + 80,
            opacity: 255
        });

        if (this._glassManager) {
            this._glassManager.applyTo(this._widgetContainer);
        }

        // Greeting
        this._greetingLabel = new St.Label({
            text: 'Good Morning, User',
            style_class: 'beeta-widget-greeting'
        });
        this._widgetContainer.add_child(this._greetingLabel);

        // Temperature Row
        const tempRow = new St.BoxLayout({
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER
        });
        
        this._tempEmoji = new St.Label({
            text: '☀️',
            style_class: 'beeta-widget-temp-large'
        });
        tempRow.add_child(this._tempEmoji);

        this._tempLarge = new St.Label({
            text: '31°C',
            style_class: 'beeta-widget-temp-large',
            margin_left: 8
        });
        tempRow.add_child(this._tempLarge);

        this._tempCondition = new St.Label({
            text: 'Sunny',
            style_class: 'beeta-widget-temp-condition',
            y_align: Clutter.ActorAlign.END,
            margin_left: 12,
            margin_bottom: 6
        });
        tempRow.add_child(this._tempCondition);

        this._widgetContainer.add_child(tempRow);

        // Location
        const locationLabel = new St.Label({
            text: '📍 Kolkata, India',
            style_class: 'beeta-widget-detail',
            margin_top: 8
        });
        this._widgetContainer.add_child(locationLabel);

        // Details
        this._detailsLabel = new St.Label({
            text: 'Feels like 34°C · Humidity 68%',
            style_class: 'beeta-widget-detail',
            margin_top: 4
        });
        this._widgetContainer.add_child(this._detailsLabel);

        // Forecast Row
        this._forecastRow = new St.BoxLayout({
            vertical: false,
            style_class: 'beeta-widget-forecast-row'
        });

        // Mock forecast data
        const forecasts = [
            { time: '12 PM', emoji: '☀️', temp: '33°' },
            { time: '3 PM', emoji: '☀️', temp: '34°' },
            { time: '6 PM', emoji: '⛅', temp: '32°' },
            { time: '9 PM', emoji: '🌙', temp: '29°' }
        ];

        for (const item of forecasts) {
            const forecastItem = new St.BoxLayout({
                vertical: true,
                style_class: 'beeta-widget-forecast-item'
            });

            const timeLabel = new St.Label({
                text: item.time,
                style_class: 'beeta-widget-forecast-time'
            });
            forecastItem.add_child(timeLabel);

            const iconLabel = new St.Label({
                text: item.emoji,
                style_class: 'beeta-widget-forecast-icon'
            });
            forecastItem.add_child(iconLabel);

            const tempLabel = new St.Label({
                text: item.temp,
                style_class: 'beeta-widget-forecast-temp'
            });
            forecastItem.add_child(tempLabel);

            this._forecastRow.add_child(forecastItem);
        }

        this._widgetContainer.add_child(this._forecastRow);

        // Add to background group (behind windows)
        Main.layoutManager._backgroundGroup.add_child(this._widgetContainer);
    }

    _updateGreeting() {
        if (!this._greetingLabel) return;

        const timeOfDay = getTimeOfDay(); // 'morning', 'afternoon', 'evening', 'night'
        const displayName = this._settings.userDisplayName || 'Noywrit';
        
        let greetingText = 'Good Morning';
        if (timeOfDay === 'afternoon') greetingText = 'Good Afternoon';
        else if (timeOfDay === 'evening') greetingText = 'Good Evening';
        else if (timeOfDay === 'night') greetingText = 'Good Night';

        this._greetingLabel.set_text(`${greetingText}, ${displayName}`);
    }

    _updateWeather(data) {
        if (!data || !this._widgetContainer) return;

        // Extracting data assuming structure similar to what we expect
        const temp = data.temperature !== undefined ? data.temperature : 31;
        const apparentTemp = data.apparent_temperature !== undefined ? data.apparent_temperature : 34;
        const humidity = data.relative_humidity !== undefined ? data.relative_humidity : 68;
        const code = data.weather_code !== undefined ? data.weather_code : 0;
        
        // Update labels
        this._tempLarge.set_text(formatTemperature(temp, 'celsius'));
        this._tempCondition.set_text(weatherCodeToCondition(code).charAt(0).toUpperCase() + weatherCodeToCondition(code).slice(1));
        
        const isNight = getTimeOfDay() === 'night';
        this._tempEmoji.set_text(weatherCodeToEmoji(code, isNight));
        
        this._detailsLabel.set_text(`Feels like ${formatTemperature(apparentTemp, 'celsius')} · Humidity ${Math.round(humidity)}%`);
    }
}
