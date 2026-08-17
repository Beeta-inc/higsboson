// SPDX-License-Identifier: GPL-3.0-or-later
// Beeta UI — Shared Constants & Design Tokens
// Part of the Beeta Design Language (BDL)

/**
 * Extension identity
 */
export const UUID = 'beeta-ui@beeta-inc.com';
export const EXTENSION_NAME = 'Beeta UI';

/**
 * Animation durations (milliseconds)
 * Beeta Motion™ — consistent timing across all UI transitions
 */
export const ANIMATION = Object.freeze({
    INSTANT:    80,
    FAST:       150,
    NORMAL:     250,
    SLOW:       350,
    SMOOTH:     500,
    DRAMATIC:   700,

    // Specific interaction timings
    RIPPLE:             300,
    WORKSPACE_PILL:     300,
    DOCK_SLIDE:         250,
    LAUNCHER_RISE:      350,
    LIVE_CENTER_SWAP:   200,
    GLASS_TINT_CHANGE:  2000,  // Adaptive Nature™ color transitions
    ICON_HOVER:         150,
});

/**
 * Glass effect parameters
 * Beeta Glass™ — frosted glassmorphism design system
 */
export const GLASS = Object.freeze({
    // Shell.BlurEffect parameters
    SIGMA:          30,     // Gaussian blur radius (multiplied by HiDPI scale)
    BRIGHTNESS:     0.75,   // Background brightness factor (0.0 – 1.0)

    // CSS-level glass properties
    OPACITY:        0.72,   // Default background alpha (72% opaque)
    OPACITY_MIN:    0.50,
    OPACITY_MAX:    0.95,
    BORDER_RADIUS:  16,     // px
    BORDER_ALPHA:   0.12,   // White border opacity
    SHADOW_ALPHA:   0.25,   // Drop shadow opacity

    // Dock-specific
    DOCK_RADIUS:    20,
    DOCK_MARGIN:    8,      // px from screen edges
    DOCK_HEIGHT:    56,     // px

    // Card-specific (launcher, widgets)
    CARD_RADIUS:    16,
    CARD_PADDING:   16,
});

/**
 * Typography scale (px)
 * Follows a modular scale for visual rhythm
 */
export const TYPOGRAPHY = Object.freeze({
    CAPTION:    11,
    BODY:       13,
    SUBTITLE:   15,
    TITLE:      20,
    HEADLINE:   28,
    HERO:       48,     // Lock screen clock
    MEGA:       72,     // Desktop clock

    WEIGHT_REGULAR:     '400',
    WEIGHT_MEDIUM:      '500',
    WEIGHT_SEMIBOLD:    '600',
    WEIGHT_BOLD:        '700',

    FONT_FAMILY: '"Inter", "Roboto", "Cantarell", "Noto Sans", sans-serif',
});

/**
 * Spacing scale (px) — 4px base unit
 */
export const SPACING = Object.freeze({
    XXS:    2,
    XS:     4,
    SM:     8,
    MD:     12,
    LG:     16,
    XL:     24,
    XXL:    32,
    XXXL:   48,
});

/**
 * Time-of-day thresholds (24h format)
 * Used by Adaptive Nature™ for environment-aware theming
 */
export const TIME_PERIODS = Object.freeze({
    MORNING:    { start: 6,  end: 11, label: 'morning'   },
    AFTERNOON:  { start: 11, end: 16, label: 'afternoon' },
    EVENING:    { start: 16, end: 20, label: 'evening'   },
    NIGHT:      { start: 20, end: 6,  label: 'night'     },
});

/**
 * Adaptive Nature™ — Color palettes per time period
 * Each palette defines accent, surface tint, glass background, and border colors
 * Format: { accent: [h, s, l], surface: [h, s, l], glassBg: [r, g, b, a], border: [r, g, b, a] }
 */
export const ADAPTIVE_PALETTES = Object.freeze({
    morning: {
        accent:     [38, 70, 55],           // Warm golden
        surface:    [35, 30, 95],            // Soft warm white
        glassBg:    [25, 20, 15, 0.68],      // Slightly warm dark glass
        border:     [255, 220, 180, 0.15],   // Warm white border
        greeting:   'Good Morning',
    },
    afternoon: {
        accent:     [210, 50, 55],           // Clean blue
        surface:    [210, 15, 96],            // Neutral white
        glassBg:    [15, 15, 25, 0.72],      // Neutral dark glass
        border:     [255, 255, 255, 0.12],   // Standard white border
        greeting:   'Good Afternoon',
    },
    evening: {
        accent:     [30, 60, 45],            // Golden warm
        surface:    [28, 20, 93],             // Warm cream
        glassBg:    [20, 15, 12, 0.75],      // Warm dark glass
        border:     [255, 200, 150, 0.14],   // Golden border
        greeting:   'Good Evening',
    },
    night: {
        accent:     [220, 40, 50],           // Cool blue
        surface:    [220, 20, 92],            // Cool light
        glassBg:    [10, 10, 20, 0.78],      // Deep dark glass
        border:     [180, 200, 255, 0.10],   // Cool blue border
        greeting:   'Good Night',
    },
});

/**
 * Weather condition codes (WMO standard used by Open-Meteo)
 * Maps to Adaptive Nature™ accent adjustments
 */
export const WEATHER_CONDITIONS = Object.freeze({
    CLEAR:      [0, 1],
    CLOUDY:     [2, 3],
    FOG:        [45, 48],
    DRIZZLE:    [51, 53, 55],
    RAIN:       [61, 63, 65, 80, 81, 82],
    SNOW:       [71, 73, 75, 77, 85, 86],
    THUNDER:    [95, 96, 99],
});

/**
 * Weather accent modifiers applied on top of time-of-day palette
 */
export const WEATHER_ACCENTS = Object.freeze({
    clear:   { hueShift: 0,   satBoost: 0,   lightBoost: 0    },
    cloudy:  { hueShift: 0,   satBoost: -10, lightBoost: -5   },
    rain:    { hueShift: 10,  satBoost: -5,  lightBoost: -8   },
    snow:    { hueShift: -20, satBoost: -15, lightBoost: 5    },
    thunder: { hueShift: 15,  satBoost: 10,  lightBoost: -12  },
});

/**
 * Resource Pulse — app activity indicator colors
 */
export const RESOURCE_PULSE = Object.freeze({
    IDLE:       'rgba(100, 160, 255, 0.8)',   // Calm blue
    MODERATE:   'rgba(255, 180, 60, 0.85)',   // Amber
    HEAVY:      'rgba(255, 80, 60, 0.9)',     // Red
    HUNG:       'rgba(255, 160, 40, 0.9)',    // Warning amber (pulsing)
});

/**
 * Charging tiers for Beeta Turbo Charge™
 */
export const CHARGING_TIERS = Object.freeze({
    TURBO:      { minWatts: 25, label: 'Beeta® Turbo Charge™', color: 'rgba(0, 180, 255, 0.9)' },
    FAST:       { minWatts: 15, label: 'Fast Charging',         color: 'rgba(0, 220, 130, 0.85)' },
    STANDARD:   { minWatts: 0,  label: 'Charging',              color: 'rgba(100, 200, 100, 0.8)' },
});

/**
 * Live Center priority levels
 * Higher priority activities replace lower ones in the center display
 */
export const LIVE_CENTER_PRIORITY = Object.freeze({
    CLOCK:          0,
    WEATHER:        1,
    DOWNLOAD:       2,
    SCREEN_SHARE:   3,
    RECORDING:      4,
    TIMER:          5,
    NAVIGATION:     6,
    MEDIA:          7,
    CALL:           8,
});

/**
 * Dock icon sizes
 */
export const DOCK_ICONS = Object.freeze({
    SIZE:           40,     // px
    SIZE_HOVER:     46,     // px (on hover scale)
    INDICATOR_SIZE: 4,      // px (running app dot)
    SPACING:        8,      // px between icons
});

/**
 * Weather API configuration
 */
export const WEATHER_API = Object.freeze({
    BASE_URL:       'https://api.open-meteo.com/v1/forecast',
    POLL_INTERVAL:  1800,   // 30 minutes in seconds
    PARAMS:         'current=temperature_2m,weather_code,relative_humidity_2m,apparent_temperature',
});

/**
 * Adaptive Nature™ poll interval
 */
export const ADAPTIVE_POLL_INTERVAL = 300; // 5 minutes in seconds
