/** Provider adapters. Every renderer continues to receive the same WMO reading. */
export const WMO_CODES = new Set([0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);
const HOUR = 60 * 60 * 1000;

export function weatherNumber(value) {
    if (value === null || value === undefined || typeof value === 'boolean'
        || (typeof value === 'string' && value.trim() === '')) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function rounded(value) {
    const n = weatherNumber(value);
    return n === null ? null : Math.round(n);
}

function codeFor(value) {
    const code = weatherNumber(value);
    return WMO_CODES.has(code) ? code : null;
}

function timeMs(value, utcOffsetSeconds = 0) {
    if (typeof value === 'number') return value * 1000;
    if (typeof value !== 'string' || !value) return NaN;
    // Legacy Open-Meteo local ISO strings must never use the device's timezone.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
        return Date.parse(`${value}Z`) - utcOffsetSeconds * 1000;
    }
    return Date.parse(value);
}

function percent(value) {
    const n = rounded(value);
    return n !== null && n >= 0 && n <= 100 ? n : null;
}

export function isValidWeatherReading(reading) {
    return !!reading && Number.isFinite(reading.temp) && WMO_CODES.has(reading.code);
}

/** Next whole hours, stored as unambiguous ISO instants for existing consumers. */
export function pickUpcomingHours(hourly, nowMs = Date.now(), count = 4, utcOffsetSeconds = 0) {
    const out = [];
    for (let i = 0; i < (hourly?.time?.length || 0) && out.length < count; i++) {
        const t = timeMs(hourly.time[i], utcOffsetSeconds);
        const code = codeFor(hourly.weather_code?.[i]);
        const temp = rounded(hourly.temperature_2m?.[i]);
        if (!Number.isFinite(t) || t <= nowMs || code === null || temp === null) continue;
        out.push({ time: new Date(t).toISOString(), code, temp, pop: percent(hourly.precipitation_probability?.[i]) });
    }
    return out;
}

export function readingFromOpenMeteo(data, nowMs = Date.now()) {
    const cur = data?.current || {};
    const observedAt = timeMs(cur.time, data?.utc_offset_seconds);
    const reading = {
        temp: rounded(cur.temperature_2m), code: codeFor(cur.weather_code),
        hi: rounded(data?.daily?.temperature_2m_max?.[0]), lo: rounded(data?.daily?.temperature_2m_min?.[0]),
        cloudCover: percent(cur.cloud_cover), windSpeed: weatherNumber(cur.wind_speed_10m),
        windDirection: weatherNumber(cur.wind_direction_10m),
        isDay: cur.is_day === 1 ? true : cur.is_day === 0 ? false : null,
        hours: pickUpcomingHours(data?.hourly, nowMs, 4, data?.utc_offset_seconds),
        provider: 'open-meteo', timezone: data?.timezone || 'UTC', observedAt
    };
    if (!isValidWeatherReading(reading) || !Number.isFinite(observedAt)
        || nowMs - observedAt > 90 * 60 * 1000 || observedAt - nowMs > HOUR) return null;
    return reading;
}

export function openMeteoUrl(location) {
    const params = new URLSearchParams({
        latitude: location.latitude, longitude: location.longitude,
        current: 'temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day',
        hourly: 'temperature_2m,weather_code,precipitation_probability',
        daily: 'temperature_2m_max,temperature_2m_min',
        models: 'best_match', cell_selection: 'land', temperature_unit: 'celsius', wind_speed_unit: 'kmh',
        forecast_days: '2', timezone: location.timezone || 'auto', timeformat: 'unixtime'
    });
    return `https://api.open-meteo.com/v1/forecast?${params}`;
}

// MET symbols do not distinguish hail/freezing rain. Never invent these hazards.
const MET_CODES = {
    clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45,
    lightrain: 61, rain: 63, heavyrain: 65,
    lightrainshowers: 80, rainshowers: 81, heavyrainshowers: 82,
    lightsnow: 71, snow: 73, heavysnow: 75,
    lightsnowshowers: 85, snowshowers: 85, heavysnowshowers: 86,
    // Mixed rain/snow has no exact WMO code in the app's vocabulary.
    lightsleet: 71, sleet: 73, heavysleet: 75,
    lightsleetshowers: 85, sleetshowers: 85, heavysleetshowers: 86
};

export function wmoFromMetSymbol(symbol) {
    // The extra "s" is a documented typo retained in MET's v2 API.
    const base = String(symbol || '').replace(/_(day|night|polartwilight)$/, '').replace(/^lightss/, 'lights');
    if (base.endsWith('andthunder') && Object.prototype.hasOwnProperty.call(MET_CODES, base.replace(/andthunder$/, ''))) return 95;
    return Object.prototype.hasOwnProperty.call(MET_CODES, base) ? MET_CODES[base] : null;
}

function metPeriod(row) {
    return row?.data?.next_1_hours;
}

/** MET's instant + next-hour symbol represent a forecast, not a station observation. */
export function readingFromMetNorway(data, nowMs = Date.now(), timezone = 'Europe/Athens') {
    const series = data?.properties?.timeseries;
    if (!Array.isArray(series) || !series.length) return null;
    const rows = series.filter(row => Number.isFinite(Date.parse(row.time))).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    const past = rows.filter(item => Date.parse(item.time) <= nowMs);
    const row = past[past.length - 1] || rows[0];
    const observedAt = Date.parse(row?.time);
    if (!Number.isFinite(observedAt) || nowMs - observedAt > 90 * 60 * 1000 || observedAt - nowMs > HOUR) return null;
    const details = row.data?.instant?.details || {};
    const speed = weatherNumber(details.wind_speed);
    const hours = rows.filter(item => Date.parse(item.time) > nowMs).map(item => ({
        time: item.time, code: wmoFromMetSymbol(metPeriod(item)?.summary?.symbol_code),
        temp: rounded(item.data?.instant?.details?.air_temperature),
        pop: percent(metPeriod(item)?.details?.probability_of_precipitation)
    })).filter(item => item.code !== null && item.temp !== null).slice(0, 4);
    const reading = {
        temp: rounded(details.air_temperature), code: wmoFromMetSymbol(metPeriod(row)?.summary?.symbol_code),
        // A partial day cannot supply the day's true high/low.
        hi: null, lo: null, cloudCover: percent(details.cloud_area_fraction),
        windSpeed: speed === null ? null : Math.round(speed * 3.6 * 10) / 10,
        windDirection: weatherNumber(details.wind_from_direction), isDay: null, hours,
        provider: 'met-norway', timezone, observedAt
    };
    return isValidWeatherReading(reading) ? reading : null;
}

export function metNorwayUrl(location) {
    return `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`;
}
