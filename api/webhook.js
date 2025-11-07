// /api/webhook.js

const axios = require('axios');
const axiosRetry = require('axios-retry').default;

const BACKEND_BASE_URL = 'https://randa-unhappi-castiel.ngrok-free.dev';

let LOCATION_MAP = {};
let LOCATION_CACHE_TIME = null;
const CACHE_DURATION = 3600000;

const FALLBACK_MAP = {
    'điện biên': 22, 'dien bien': 22,
    'an giang': 8,
    'đà lạt': 9, 'da lat': 9,
    'huế': 10, 'hue': 10,
};

axiosRetry(axios, { retries: 2, retryDelay: () => 1000 });

async function loadLocationsFromAPI() {
    try {
        console.log('Loading locations...');
        const res = await axios.get(`${BACKEND_BASE_URL}/api/locations`, {
            timeout: 8000,
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        let data = res.data.result || res.data.data || res.data;
        if (!Array.isArray(data)) throw new Error('Not array');

        LOCATION_MAP = {};
        data.forEach(loc => {
            const id = loc.locationId;
            const name = loc.locationName;
            if (!id || !name) return;
            const lower = name.toLowerCase();
            LOCATION_MAP[lower] = id;
            if (lower.includes('điện biên')) LOCATION_MAP['điện biên'] = id;
            if (lower.includes('an giang')) LOCATION_MAP['an giang'] = id;
        });

        console.log(`Loaded ${Object.keys(LOCATION_MAP).length} locations`);
        LOCATION_CACHE_TIME = Date.now();
    } catch (err) {
        console.error('Load locations failed:', err.message);
        LOCATION_MAP = { ...FALLBACK_MAP };
        LOCATION_CACHE_TIME = Date.now();
    }
}

async function getLocationId(name) {
    if (!name) return null;
    if (Array.isArray(name)) name = name[0] || '';
    const norm = name.trim().toLowerCase();

    if (!LOCATION_CACHE_TIME || Date.now() - LOCATION_CACHE_TIME > CACHE_DURATION) {
        await loadLocationsFromAPI();
    }

    return LOCATION_MAP[norm] || null;
}

// === FIX: Parse thoiGian array + ưu tiên ngày người dùng nói ===
function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;
    let dateStr = null;

    if (Array.isArray(thoiGian)) {
        const isos = thoiGian.filter(s => typeof s === 'string' && s.includes('T'));
        dateStr = isos.pop(); // Lấy cuối cùng (ngày người dùng nói: 2025-11-24)
    } else if (typeof thoiGian === 'string') {
        dateStr = thoiGian.replace(' ', 'T').split('.')[0];
    }

    if (!dateStr) return null;

    try {
        const d = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}+07:00`);
        if (isNaN(d)) return null;
        return d.toISOString(); // Gửi UTC cho backend
    } catch {
        return null;
    }
}

// === FIX: Hiển thị đúng giờ VN (UTC → +07:00) ===
function formatTime(isoString) {
    if (!isoString) return 'Invalid Date';
    try {
        const date = new Date(isoString);
        if (isNaN(date)) return 'Invalid Date';
        return date.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });
    } catch {
        return 'Invalid Date';
    }
}

function formatPrice(price) {
    const n = parseFloat(price);
    return isNaN(n) ? 'NaN VNĐ' : new Intl.NumberFormat('vi-VN').format(n) + ' VNĐ';
}

function safeSeats(seats) {
    const n = parseInt(seats);
    return isNaN(n) ? 0 : n;
}

// === MAIN HANDLER ===
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const body = req.body;
    console.log('Payload:', JSON.stringify(body, null, 2));

    try {
        const intentName = body.queryResult?.intent?.displayName || '';
        if (intentName !== 'TimVeXe') {
            return res.status(200).json({ fulfillmentText: "Xin lỗi, tôi chưa hiểu." });
        }

        const p = body.queryResult.parameters;
        let diemDi = (Array.isArray(p.diemDi) ? p.diemDi[0] : p.diemDi) || '';
        let diemDen = (Array.isArray(p.diemDen) ? p.diemDen[0] : p.diemDen) || '';
        let thoiGian = p.thoiGian;

        if (!diemDi || !diemDen) {
            return res.status(200).json({ fulfillmentText: "Vui lòng cho biết điểm đi và điểm đến." });
        }

        const startId = await getLocationId(diemDi);
        const endId = await getLocationId(diemDen);
        if (!startId || !endId) {
            return res.status(200).json({ fulfillmentText: `Không tìm thấy địa điểm "${!startId ? diemDi : diemDen}".` });
        }

        const departureDate = formatDepartureDate(thoiGian);
        const payload = { startLocation: startId, endLocation: endId, status: 'on_sell' };
        if (departureDate) payload.departureDate = departureDate;

        console.log("Gửi API:", payload);

        const apiRes = await axios.post(`${BACKEND_BASE_URL}/api/trips/search`, payload, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });

        // === FIX: Lấy từ .result (object), không phải mảng ===
        const result = apiRes.data.result;
        if (!result || !result.trip_id) {
            return res.status(200).json({
                fulfillmentText: `Không tìm thấy chuyến nào từ ${diemDi} đến ${diemDen}.`
            });
        }

        const trip = result;
        const link = `${BACKEND_BASE_URL.replace('/api', '')}/booking?tripId=${trip.trip_id}`;

        const text = `Tìm thấy 1 chuyến từ ${diemDi} đến ${diemDen} vào ${formatTime(trip.departure_time)}:\n\n` +
                     `1. ${trip.operator_name || 'Nhà xe'}\n` +
                     `   ${formatTime(trip.departure_time)} → ${formatTime(trip.arrival_time)}\n` +
                     `   ${formatPrice(trip.price_per_seat)}\n` +
                     `   ${safeSeats(trip.available_seats)} chỗ trống\n` +
                     (trip.average_rating ? `   ${trip.average_rating.toFixed(1)}/5\n` : '') +
                     `   Đặt vé: ${link}`;

        res.status(200).json({ fulfillmentText: text });

    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(200).json({ fulfillmentText: "Lỗi hệ thống. Vui lòng thử lại." });
    }
};

loadLocationsFromAPI().catch(() => {});