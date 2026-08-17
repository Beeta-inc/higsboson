// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Weather Service

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import { WEATHER_API } from '../lib/constants.js';
import { weatherCodeToCondition } from '../lib/utils.js';

/**
 * Service for fetching weather data from Open-Meteo.
 */
export class WeatherService {
    /**
     * @param {import('../lib/settings.js').SettingsManager} settings
     */
    constructor(settings) {
        this._settings = settings;
        
        this._session = new Soup.Session();
        this._cancellable = new Gio.Cancellable();
        this._timeoutId = null;
        
        this._isLoaded = false;
        this._temperature = 0;
        this._apparentTemperature = 0;
        this._weatherCode = 0;
        this._humidity = 0;
        
        /** @type {Function|null} */
        this.onWeatherUpdated = null;

        // Re-fetch when location changes
        this._latSignalId = this._settings.onChanged('weather-latitude', () => {
            this._fetchWeather();
        });
        
        this._lonSignalId = this._settings.onChanged('weather-longitude', () => {
            this._fetchWeather();
        });
        
        // Notify UI to re-render when unit changes
        this._unitSignalId = this._settings.onChanged('temperature-unit', () => {
            if (this.onWeatherUpdated) {
                this.onWeatherUpdated();
            }
        });
    }

    /**
     * Begin polling weather data
     */
    start() {
        // Immediate fetch
        this._fetchWeather();
        
        // Poll at intervals
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            WEATHER_API.POLL_INTERVAL,
            () => {
                this._fetchWeather();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }
    
    /**
     * Clean up resources
     */
    stop() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }
        
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        
        if (this._session) {
            this._session.abort();
            this._session = null;
        }
        
        if (this._settings && this._settings.raw) {
            if (this._latSignalId) {
                this._settings.raw.disconnect(this._latSignalId);
                this._latSignalId = null;
            }
            if (this._lonSignalId) {
                this._settings.raw.disconnect(this._lonSignalId);
                this._lonSignalId = null;
            }
            if (this._unitSignalId) {
                this._settings.raw.disconnect(this._unitSignalId);
                this._unitSignalId = null;
            }
        }
        
        this.onWeatherUpdated = null;
    }

    /**
     * @private
     */
    async _fetchWeather() {
        if (!this._session || !this._cancellable || this._cancellable.is_cancelled())
            return;
            
        const lat = this._settings.weatherLatitude;
        const lon = this._settings.weatherLongitude;
        // Accessing the unit here as required, UI formatter will use it.
        const unit = this._settings.temperatureUnit;
        
        const url = `${WEATHER_API.BASE_URL}?latitude=${lat}&longitude=${lon}&${WEATHER_API.PARAMS}`;
        const message = Soup.Message.new('GET', url);
        
        try {
            const bytes = await this._session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                this._cancellable
            );
            
            if (message.status_code !== 200) {
                console.error(`WeatherService: HTTP Error ${message.status_code}`);
                return;
            }
            
            const decoder = new TextDecoder('utf-8');
            const data = JSON.parse(decoder.decode(bytes.toArray()));
            
            if (data && data.current) {
                this._temperature = data.current.temperature_2m;
                this._apparentTemperature = data.current.apparent_temperature;
                this._weatherCode = data.current.weather_code;
                this._humidity = data.current.relative_humidity_2m;
                this._isLoaded = true;
                
                if (this.onWeatherUpdated) {
                    this.onWeatherUpdated();
                }
            }
        } catch (error) {
            if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                console.error(`WeatherService: Network error fetching weather: ${error.message}`);
            }
        }
    }

    /**
     * @returns {number} Temperature in Celsius
     */
    get temperature() {
        return this._temperature;
    }
    
    /**
     * @returns {number} Apparent temperature in Celsius
     */
    get apparentTemperature() {
        return this._apparentTemperature;
    }
    
    /**
     * @returns {number} WMO weather code
     */
    get weatherCode() {
        return this._weatherCode;
    }
    
    /**
     * @returns {number} Relative humidity percentage
     */
    get humidity() {
        return this._humidity;
    }
    
    /**
     * @returns {string} Weather condition description
     */
    get condition() {
        return weatherCodeToCondition(this._weatherCode);
    }
    
    /**
     * @returns {boolean} Whether weather data has been loaded
     */
    get isLoaded() {
        return this._isLoaded;
    }
}
