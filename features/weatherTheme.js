/**
 * Single WMO / Open-Meteo weather_code map for header, Awards sky, wallpaper, and the home card.
 * Intensity is a modifier (`weather-light` / `weather-heavy`) on rain, snow, ice, and hail.
 */

export const HEADER_WEATHER_CLASSES = [
    'header-night',
    'header-stormy',
    'header-rainy',
    'header-snowy',
    'header-cloudy',
    'header-foggy',
    'header-icy',
    'header-hail',
    'weather-light',
    'weather-heavy'
];

export const WALLPAPER_WEATHER_CLASSES = [
    'weather-clear',
    'weather-cloudy',
    'weather-rainy',
    'weather-snowy',
    'weather-stormy',
    'weather-foggy',
    'weather-icy',
    'weather-hail',
    'weather-light',
    'weather-heavy'
];

function skin({
    weatherBg,
    weatherIcon,
    weatherText,
    headerClass = '',
    wallpaperClass,
    intensity = ''
}) {
    return { weatherBg, weatherIcon, weatherText, headerClass, wallpaperClass, intensity };
}

function rain(weatherText, intensity = '') {
    return skin({
        weatherBg: 'w-rainy',
        weatherIcon: intensity === 'heavy' ? 'fa-cloud-showers-heavy' : 'fa-cloud-rain',
        weatherText,
        headerClass: 'header-rainy',
        wallpaperClass: 'weather-rainy',
        intensity
    });
}

function snow(weatherText, intensity = '') {
    return skin({
        weatherBg: 'w-snowy',
        weatherIcon: 'fa-snowflake',
        weatherText,
        headerClass: 'header-snowy',
        wallpaperClass: 'weather-snowy',
        intensity
    });
}

function icy(weatherText, intensity = '') {
    return skin({
        weatherBg: 'w-icy',
        weatherIcon: 'fa-icicles',
        weatherText,
        headerClass: 'header-icy',
        wallpaperClass: 'weather-icy',
        intensity
    });
}

function hail(weatherText, intensity = '') {
    return skin({
        weatherBg: 'w-hail',
        weatherIcon: 'fa-cloud-meatball',
        weatherText,
        headerClass: 'header-hail',
        wallpaperClass: 'weather-hail',
        intensity
    });
}

export function resolveWeatherTheme(code) {
    const n = Number(code);

    if (n === 0) {
        return skin({
            weatherBg: 'w-day',
            weatherIcon: 'fa-sun',
            weatherText: 'Sunny',
            wallpaperClass: 'weather-clear'
        });
    }
    if (n === 1 || n === 2) {
        return skin({
            weatherBg: 'w-day',
            weatherIcon: 'fa-cloud-sun',
            weatherText: 'Partly Cloudy',
            wallpaperClass: 'weather-clear'
        });
    }
    if (n === 3) {
        return skin({
            weatherBg: 'w-cloudy',
            weatherIcon: 'fa-cloud',
            weatherText: 'Overcast',
            headerClass: 'header-cloudy',
            wallpaperClass: 'weather-cloudy'
        });
    }
    if (n === 45 || n === 48) {
        return skin({
            weatherBg: 'w-foggy',
            weatherIcon: 'fa-smog',
            weatherText: 'Foggy',
            headerClass: 'header-foggy',
            wallpaperClass: 'weather-foggy'
        });
    }

    if (n === 51) return rain('Light Drizzle', 'light');
    if (n === 53) return rain('Drizzle');
    if (n === 55) return rain('Heavy Drizzle', 'heavy');
    if (n === 56) return icy('Icy Drizzle', 'light');
    if (n === 57) return icy('Icy Drizzle', 'heavy');

    if (n === 61) return rain('Light Rain', 'light');
    if (n === 63) return rain('Rainy');
    if (n === 65) return rain('Heavy Rain', 'heavy');
    if (n === 66) return icy('Icy', 'light');
    if (n === 67) return icy('Icy', 'heavy');

    if (n === 71) return snow('Light Snow', 'light');
    if (n === 73) return snow('Snowy');
    if (n === 75) return snow('Heavy Snow', 'heavy');
    if (n === 77) return snow('Snow Grains', 'light');

    if (n === 80) return rain('Light Showers', 'light');
    if (n === 81) return rain('Showers');
    if (n === 82) return rain('Heavy Showers', 'heavy');

    if (n === 85) return snow('Light Snow', 'light');
    if (n === 86) return snow('Heavy Snow', 'heavy');

    if (n === 95) {
        return skin({
            weatherBg: 'w-stormy',
            weatherIcon: 'fa-bolt',
            weatherText: 'Stormy',
            headerClass: 'header-stormy',
            wallpaperClass: 'weather-stormy'
        });
    }
    if (n === 96) return hail('Hail');
    if (n === 99) return hail('Hail', 'heavy');

    if (n >= 51 && n <= 55) return rain('Rainy');
    if (n >= 56 && n <= 57) return icy('Icy');
    if (n >= 61 && n <= 65) return rain('Rainy');
    if (n >= 66 && n <= 67) return icy('Icy');
    if (n >= 71 && n <= 77) return snow('Snowy');
    if (n >= 80 && n <= 82) return rain('Rainy');
    if (n >= 85 && n <= 86) return snow('Snowy');
    if (n >= 95) {
        return skin({
            weatherBg: 'w-stormy',
            weatherIcon: 'fa-bolt',
            weatherText: 'Stormy',
            headerClass: 'header-stormy',
            wallpaperClass: 'weather-stormy'
        });
    }

    return skin({
        weatherBg: 'w-cloudy',
        weatherIcon: 'fa-cloud',
        weatherText: 'Cloudy',
        headerClass: 'header-cloudy',
        wallpaperClass: 'weather-cloudy'
    });
}

export function withNightWeatherText(text) {
    if (text === 'Sunny') return 'Clear Night';
    if (text === 'Partly Cloudy') return 'Cloudy Night';
    if (typeof text === 'string' && text.endsWith(' Night')) return text;
    return `${text} Night`;
}

export function headerClassesForTheme(theme, isNight = false) {
    const classes = [];
    if (isNight) classes.push('header-night');
    if (theme?.headerClass) classes.push(theme.headerClass);
    if (theme?.intensity) classes.push(`weather-${theme.intensity}`);
    return classes;
}

export function wallpaperClassesForCode(code) {
    const theme = resolveWeatherTheme(code);
    const classes = [theme.wallpaperClass];
    if (theme.intensity) classes.push(`weather-${theme.intensity}`);
    return classes;
}
