const axios = require('axios');
const axiosRetry = require('axios-retry').default;

const BACKEND_BASE_URL = 'https://randa-unhappi-castiel.ngrok-free.dev';

// Cache
let LOCATION_MAP = {};
let LOCATION_CACHE_TIME = null;
const CACHE_DURATION = 3600000; // 1 giờ

// Fallback map (ID thực tế từ log trước)
const FALLBACK_MAP = {
    'điện biên': 22,
    'dien bien': 22,
    'đà nẵng': 5,
    'da nang': 5,
    'hà nội': 1,
    'ha noi': 1,
    'an giang': 8,
    'đà lạt': 9,
    'da lat': 9,
    'huế': 10,
    'hue': 10,
};

axiosRetry(axios, { retries: 2, retryDelay: () => 1000 });

/**
 * Load locations với retry + fallback
 */
async function loadLocationsFromAPI() {
    try {
        console.log('Loading locations from API...');
        const response = await axios.get(`${BACKEND_BASE_URL}/api/locations`, {
            timeout: 10000, // Giảm timeout để fail nhanh
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        let locations = response.data.result || response.data.data || response.data;
        if (!Array.isArray(locations) || locations.length === 0) {
            throw new Error('Invalid locations data');
        }

        console.log(`Loaded ${locations.length} locations`);
        LOCATION_MAP = {};

        locations.forEach(loc => {
            const id = loc.locationId;
            const name = loc.locationName;
            if (!id || !name) return;

            const lower = name.toLowerCase();
            LOCATION_MAP[lower] = id;

            const base = name.split('-')[0].trim().toLowerCase();
            if (base !== lower) LOCATION_MAP[base] = id;

            // Alias phổ biến
            if (lower.includes('miền đông')) ['tp.hcm', 'tphcm', 'hồ chí minh', 'sài gòn', 'saigon'].forEach(k => LOCATION_MAP[k] = id);
            if (lower.includes('giáp bát')) ['hà nội', 'ha noi', 'hanoi', 'hn'].forEach(k => LOCATION_MAP[k] = id);
            if (lower.includes('điện biên')) LOCATION_MAP['điện biên'] = id;
            if (lower.includes('an giang')) LOCATION_MAP['an giang'] = id;
            if (lower.includes('đà lạt')) LOCATION_MAP['đà lạt'] = id;
            if (lower.includes('huế')) LOCATION_MAP['huế'] = id;
        });

        console.log(`LOCATION_MAP built with ${Object.keys(LOCATION_MAP).length} keys`);
        LOCATION_CACHE_TIME = Date.now();
        return true;
    } catch (error) {
        console.error('API load locations failed:', error.message);
        console.log('Using FALLBACK_MAP');
        LOCATION_MAP = { ...FALLBACK_MAP };
        LOCATION_CACHE_TIME = Date.now();
        return false;
    }
}

/**
 * Lấy ID location (luôn có fallback)
 */
async function getLocationId(name) {
    if (!name) return null;
    if (Array.isArray(name)) name = name[0] || '';

    const normalized = name.trim().toLowerCase();

    if (Object.keys(LOCATION_MAP).length === 0 || !LOCATION_CACHE_TIME || (Date.now() - LOCATION_CACHE_TIME > CACHE_DURATION)) {
        await loadLocationsFromAPI();
    }

    if (LOCATION_MAP[normalized]) return LOCATION_MAP[normalized];

    for (const [key, id] of Object.entries(LOCATION_MAP)) {
        if (key.includes(normalized) || normalized.includes(key)) return id;
    }

    console.log(`Không tìm thấy ID cho "${name}"`);
    return null;
}

/**
 * Format thoiGian từ Dialogflow (array phức tạp)
 */
function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;

    let dateStr = null;

    if (Array.isArray(thoiGian)) {
        // Bỏ object range năm, lấy string ISO gần nhất
        const isoStrings = thoiGian.filter(item => typeof item === 'string' && item.includes('T'));
        if (isoStrings.length > 0) {
            // Ưu tiên ngày xa nhất (người dùng nói "2025-11-24" → lấy cái gần nhất)
            dateStr = isoStrings[isoStrings.length - 1]; // Lấy cuối cùng
        }
    } else if (typeof thoiGian === 'string') {
        dateStr = thoiGian.replace(' ', 'T').split('.')[0];
    }

    if (!dateStr) {
        console.log('Không parse được thoiGian:', thoiGian);
        return null;
    }

    try {
        // Parse với +07:00 để giữ ngày đúng
        const date = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}+07:00`);
        if (isNaN(date)) throw new Error('Invalid date');
        const iso = date.toISOString();
        console.log(`Formatted departure: ${iso}`);
        return iso;
    } catch (error) {
        console.error('Lỗi parse ngày:', error.message);
        return null;
    }
}

function formatPrice(p) {
    return new Intl.NumberFormat('vi-VN').format(p) + ' VNĐ';
}

function formatTime(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });
    } catch {
        return iso;
    }
}

/**
 * Handler – CHỈ DÙNG INTENT.DISPLAYNAME
 */
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

    const body = req.body;
    console.log('Payload:', JSON.stringify(body, null, 2));

    try {
        const intentName = body.queryResult?.intent?.displayName || '';
        console.log("Intent:", intentName);

        if (intentName !== 'TimVeXe') {
            return res.status(200).json({ fulfillmentText: "Xin lỗi, tôi chưa hiểu ý bạn." });
        }

        console.log('Entered TimVeXe block');

        const p = body.queryResult.parameters;

        let diemDi = p.diemDi?.original || p.diemDi || '';
        if (Array.isArray(diemDi)) diemDi = diemDi[0] || '';

        let diemDen = p.diemDen?.original || p.diemDen || '';
        if (Array.isArray(diemDen)) diemDen = diemDen[0] || '';

        let thoiGian = p.thoiGian?.original || p.thoiGian;

        console.log("Điểm đi:", diemDi);
        console.log("Điểm đến:", diemDen);
        console.log("Thời gian:", JSON.stringify(thoiGian));

        if (!diemDi || !diemDen) {
            return res.status(200).json({ fulfillmentText: "Vui lòng cho tôi biết điểm đi và điểm đến." });
        }

        const startId = await getLocationId(diemDi);
        const endId = await getLocationId(diemDen);

        if (!startId || !endId) {
            return res.status(200).json({
                fulfillmentText: `Không tìm thấy địa điểm "${!startId ? diemDi : diemDen}".`
            });
        }

        console.log(`Mapped IDs: ${startId} → ${endId}`);

        const departureDate = formatDepartureDate(thoiGian);
        const payload = { startLocation: startId, endLocation: endId, status: 'on_sell' };
        if (departureDate) payload.departureDate = departureDate;

        console.log("Gửi API:", payload);

        const apiRes = await axios.post(`${BACKEND_BASE_URL}/api/trips/search`, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        const trips = apiRes.data.result || apiRes.data.data || apiRes.data || [];
        console.log(`Tìm thấy ${trips.length} chuyến`);

        let text = '';
        if (trips.length > 0) {
            const top = trips.slice(0, 5);
            text = `Tìm thấy ${trips.length} chuyến từ ${diemDi} đến ${diemDen}${thoiGian ? ` vào ${formatTime(departureDate)}` : ''}:\n\n`;
            top.forEach((t, i) => {
                const link = `${BACKEND_BASE_URL.replace('/api', '')}/booking?tripId=${t.tripId}`;
                text += `${i + 1}. ${t.operatorName || 'Nhà xe'}\n`;
                text += `   ${formatTime(t.departureTime)} → ${formatTime(t.arrivalEstimateTime)}\n`;
                text += `   ${formatPrice(t.pricePerSeat)}\n`;
                text += `   ${t.availableSeats || 0} chỗ trống\n`;
                if (t.averageRating > 0) text += `   ${t.averageRating.toFixed(1)}/5\n`;
                text += `   Đặt vé: ${link}\n\n`;
            });
            if (trips.length > 5) text += `... và ${trips.length - 5} chuyến khác.`;
        } else {
            text = `Không tìm thấy chuyến nào từ ${diemDi} đến ${diemDen}${thoiGian ? ` vào ${formatTime(departureDate)}` : ''}.`;
        }

        res.status(200).json({ fulfillmentText: text });

    } catch (error) {
        console.error("Webhook error:", error.message);
        res.status(200).json({ fulfillmentText: "Đã có lỗi xảy ra. Vui lòng thử lại." });
    }
}

// Pre-load
loadLocationsFromAPI().catch(() => {});