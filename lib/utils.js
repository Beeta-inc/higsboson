// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Utility Helpers
// Color math, time queries, HiDPI scaling, and common operations

import GLib from 'gi://GLib';
import St from 'gi://St';

import { TIME_PERIODS, WEATHER_CONDITIONS } from './constants.js';

/**
 * Determine the current time-of-day period.
 * @returns {'morning'|'afternoon'|'evening'|'night'}
 */
export function getTimeOfDay() {
    const now = GLib.DateTime.new_now_local();
    const hour = now.get_hour();

    if (hour >= TIME_PERIODS.MORNING.start && hour < TIME_PERIODS.MORNING.end)
        return 'morning';
    if (hour >= TIME_PERIODS.AFTERNOON.start && hour < TIME_PERIODS.AFTERNOON.end)
        return 'afternoon';
    if (hour >= TIME_PERIODS.EVENING.start && hour < TIME_PERIODS.EVENING.end)
        return 'evening';
    return 'night';
}

/**
 * Get current time formatted for display.
 * @param {boolean} use24h - Use 24-hour format
 * @returns {{ time: string, period: string, day: string, date: string }}
 */
export function getFormattedTime(use24h = false) {
    const now = GLib.DateTime.new_now_local();

    let time, period;
    if (use24h) {
        time = now.format('%H:%M');
        period = '';
    } else {
        time = now.format('%I:%M');
        period = now.format('%p');
        // Remove leading zero from 12h format
        if (time.startsWith('0'))
            time = time.substring(1);
    }

    const day = now.format('%A');       // "Tuesday"
    const date = now.format('%B %e');   // "July 14"

    return { time, period, day, date };
}

/**
 * Get the HiDPI scale factor from the current Shell theme context.
 * @returns {number}
 */
export function getScaleFactor() {
    const themeContext = St.ThemeContext.get_for_stage(global.stage);
    return themeContext ? themeContext.scale_factor : 1;
}

/**
 * Construct an RGBA CSS color string.
 * @param {number} r - Red (0–255)
 * @param {number} g - Green (0–255)
 * @param {number} b - Blue (0–255)
 * @param {number} a - Alpha (0.0–1.0)
 * @returns {string}
 */
export function rgba(r, g, b, a = 1.0) {
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(3)})`;
}

/**
 * Construct an HSLA CSS color string.
 * @param {number} h - Hue (0–360)
 * @param {number} s - Saturation (0–100)
 * @param {number} l - Lightness (0–100)
 * @param {number} a - Alpha (0.0–1.0)
 * @returns {string}
 */
export function hsla(h, s, l, a = 1.0) {
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a.toFixed(3)})`;
}

/**
 * Convert HSL to RGB.
 * @param {number} h - Hue (0–360)
 * @param {number} s - Saturation (0–100)
 * @param {number} l - Lightness (0–100)
 * @returns {[number, number, number]} [r, g, b] each 0–255
 */
export function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r, g, b;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }

    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255),
    ];
}

/**
 * Convert RGB to HSL.
 * @param {number} r - Red (0–255)
 * @param {number} g - Green (0–255)
 * @param {number} b - Blue (0–255)
 * @returns {[number, number, number]} [h, s, l] where h is 0–360, s and l are 0–100
 */
export function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));

        if (max === r)
            h = 60 * (((g - b) / delta) % 6);
        else if (max === g)
            h = 60 * ((b - r) / delta + 2);
        else
            h = 60 * ((r - g) / delta + 4);

        if (h < 0) h += 360;
    }

    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Linearly interpolate between two colors (RGBA arrays).
 * Used for smooth Adaptive Nature™ transitions.
 * @param {number[]} colorA - [r, g, b, a]
 * @param {number[]} colorB - [r, g, b, a]
 * @param {number} t - Interpolation factor (0.0 = colorA, 1.0 = colorB)
 * @returns {number[]} [r, g, b, a]
 */
export function lerpColor(colorA, colorB, t) {
    t = clamp(t, 0, 1);
    return [
        colorA[0] + (colorB[0] - colorA[0]) * t,
        colorA[1] + (colorB[1] - colorA[1]) * t,
        colorA[2] + (colorB[2] - colorA[2]) * t,
        colorA[3] + (colorB[3] - colorA[3]) * t,
    ];
}

/**
 * Linearly interpolate between two HSL colors.
 * Handles hue wrapping across 0/360 boundary.
 * @param {number[]} hslA - [h, s, l]
 * @param {number[]} hslB - [h, s, l]
 * @param {number} t - Interpolation factor
 * @returns {number[]} [h, s, l]
 */
export function lerpHSL(hslA, hslB, t) {
    t = clamp(t, 0, 1);

    // Shortest path around the hue circle
    let dh = hslB[0] - hslA[0];
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;

    const h = (hslA[0] + dh * t + 360) % 360;
    const s = hslA[1] + (hslB[1] - hslA[1]) * t;
    const l = hslA[2] + (hslB[2] - hslA[2]) * t;

    return [h, s, l];
}

/**
 * Clamp a number between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Map a WMO weather code to a condition category.
 * @param {number} code - WMO weather code from Open-Meteo
 * @returns {'clear'|'cloudy'|'rain'|'snow'|'thunder'}
 */
export function weatherCodeToCondition(code) {
    if (WEATHER_CONDITIONS.THUNDER.includes(code)) return 'thunder';
    if (WEATHER_CONDITIONS.SNOW.includes(code))    return 'snow';
    if (WEATHER_CONDITIONS.RAIN.includes(code))    return 'rain';
    if (WEATHER_CONDITIONS.DRIZZLE.includes(code)) return 'rain';
    if (WEATHER_CONDITIONS.FOG.includes(code))     return 'cloudy';
    if (WEATHER_CONDITIONS.CLOUDY.includes(code))  return 'cloudy';
    return 'clear';
}

/**
 * Get a weather emoji icon for a WMO code.
 * @param {number} code - WMO weather code
 * @param {boolean} isNight - Whether it's currently night
 * @returns {string}
 */
export function weatherCodeToEmoji(code, isNight = false) {
    if (WEATHER_CONDITIONS.THUNDER.includes(code)) return '⛈️';
    if (WEATHER_CONDITIONS.SNOW.includes(code))    return '❄️';
    if (WEATHER_CONDITIONS.RAIN.includes(code))    return '🌧️';
    if (WEATHER_CONDITIONS.DRIZZLE.includes(code)) return '🌦️';
    if (WEATHER_CONDITIONS.FOG.includes(code))     return '🌫️';
    if (WEATHER_CONDITIONS.CLOUDY.includes(code))  return isNight ? '☁️' : '⛅';
    return isNight ? '🌙' : '☀️';
}

/**
 * Get a weather description for a WMO code.
 * @param {number} code
 * @returns {string}
 */
export function weatherCodeToDescription(code) {
    if (WEATHER_CONDITIONS.THUNDER.includes(code)) return 'Thunderstorm';
    if (WEATHER_CONDITIONS.SNOW.includes(code))    return 'Snowy';
    if (WEATHER_CONDITIONS.RAIN.includes(code))    return 'Rainy';
    if (WEATHER_CONDITIONS.DRIZZLE.includes(code)) return 'Drizzle';
    if (WEATHER_CONDITIONS.FOG.includes(code))     return 'Foggy';
    if (WEATHER_CONDITIONS.CLOUDY.includes(code))  return 'Cloudy';
    return 'Clear';
}

/**
 * Format temperature with unit.
 * @param {number} tempC - Temperature in Celsius
 * @param {'celsius'|'fahrenheit'} unit
 * @returns {string}
 */
export function formatTemperature(tempC, unit = 'celsius') {
    if (unit === 'fahrenheit') {
        const tempF = (tempC * 9 / 5) + 32;
        return `${Math.round(tempF)}°F`;
    }
    return `${Math.round(tempC)}°C`;
}

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} delayMs
 * @returns {Function}
 */
export function debounce(fn, delayMs) {
    let timeoutId = null;
    return function (...args) {
        if (timeoutId !== null)
            GLib.Source.remove(timeoutId);

        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            fn.apply(this, args);
            timeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
    };
}

/**
 * Safely destroy a Clutter/St actor.
 * Checks existence and parent before destroying.
 * @param {import('gi://Clutter').Actor|null} actor
 */
export function safeDestroy(actor) {
    if (actor) {
        if (actor.get_parent())
            actor.get_parent().remove_child(actor);
        actor.destroy();
    }
}

/**
 * Get the primary monitor geometry.
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function getPrimaryMonitor() {
    const monitor = global.display.get_monitor_geometry(
        global.display.get_primary_monitor()
    );
    return {
        x: monitor.x,
        y: monitor.y,
        width: monitor.width,
        height: monitor.height,
    };
}
