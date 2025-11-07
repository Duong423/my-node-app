const axios = require('axios');
const axiosRetry = require('axios-retry').default;

// === CẤU HÌNH ===
const BACKEND_BASE_URL = 'https://randa-unhappi-castiel.ngrok-free.dev';

// Cache locations
let LOCATION_MAP = {};
let LOCATION_CACHE_TIME = null;
const CACHE_DURATION = 3600000; // 1 giờ

// Fallback khi API locations lỗi
const FALLBACK_MAP = {
    'điện biên': 22,
    'dien bien': 22,
    'an giang': 8,
    'đà lạt': 9,
    'da lat': 9,
    'huế': 10,
    'hue': 10,
    'hà nội': 1,
    'ha noi': 1,
    'tp.hcm': 2,
    'sài gòn': 2,
    'saigon': 2,
};

// Cấu hình retry cho axios
axiosRetry(axios, {
    retries: 2,
    retryDelay: () => 1000,
});

// === LOAD LOCATIONS ===
async function loadLocationsFromAPI() {
    try {
        console.log('Loading locations from API...');
        const response = await axios.get(`${BACKEND_BASE_URL}/api/locations`, {
            timeout: 8000,
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        let locations = response.data.result || response.data.data || response.data;
        if (!Array.isArray(locations)) throw new Error('Locations not array');

        LOCATION_MAP = {};
        locations.forEach(loc => {
            const id = loc.locationId;
            const name = loc.locationName;
            if (!id || !name) return;

            const lower = name.toLowerCase();
            LOCATION_MAP[lower] = id;

            // Alias
            const base = name.split('-')[0].trim().toLowerCase();
            if (base !== lower) LOCATION_MAP[base] = id;

            if (lower.includes('điện biên')) LOCATION_MAP['điện biên'] = id;
            if (lower.includes('an giang')) LOCATION_MAP['an giang'] = id;
            if (lower.includes('miền đông')) ['tp.hcm', 'tphcm', 'hồ chí minh', 'sài gòn', 'saigon'].forEach(k => LOCATION_MAP[k] = id);
            if (lower.includes('giáp bát')) ['hà nội', 'ha noi', 'hanoi', 'hn'].forEach(k => LOCATION_MAP[k] = id);
        });

        console.log(`Loaded ${Object.keys(LOCATION_MAP).length} locations`);
        LOCATION_CACHE_TIME = Date.now();
        return true;
    } catch (error) {
        console.error('Load locations failed:', error.message);
        console.log('Using FALLBACK_MAP');
        LOCATION_MAP = { ...FALLBACK_MAP };
        LOCATION_CACHE_TIME = Date.now();
        return false;
    }
}

// === LẤY LOCATION ID ===
async function getLocationId(name) {
    if (!name) return null;
    if (Array.isArray(name)) name = name[0] || '';
    const normalized = name.trim().toLowerCase();

    // Reload nếu cache hết hạn
    if (!LOCATION_CACHE_TIME || Date.now() - LOCATION_CACHE_TIME > CACHE_DURATION) {
        await loadLocationsFromAPI();
    }

    if (LOCATION_MAP[normalized]) return LOCATION_MAP[normalized];

    // Tìm gần đúng
    for (const [key, id] of Object.entries(LOCATION_MAP)) {
        if (key.includes(normalized) || normalized.includes(key)) return id;
    }

    console.log(`Không tìm thấy ID cho "${name}"`);
    return null;
}

// === PARSE NGÀY TỪ DIALOGFLOW ===
function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;

    let dateStr = null;
    if (Array.isArray(thoiGian)) {
        // Lọc các string ISO, bỏ object range
        const isos = thoiGian.filter(item => typeof item === 'string' && item.includes('T'));
        dateStr = isos.length > 0 ? isos.pop() : null; // Lấy cuối cùng (ngày người dùng nói)
    } else if (typeof thoiGian === 'string') {
        dateStr = thoiGian.replace(' ', 'T').split('.')[0];
    }

    if (!dateStr) return null;

    try {
        const date = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}+07:00`);
        if (isNaN(date)) return null;
        return date.toISOString(); // Gửi UTC cho backend
    } catch (error) {
        console.error('Parse ngày lỗi:', error.message);
        return null;
    }
}

// === HIỂN THỊ GIỜ VIỆT NAM (UTC → +07:00) ===
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

// === FORMAT GIÁ & CHỖ ===
function formatPrice(price) {
    const num = parseFloat(price);
    return isNaN(num) ? 'NaN VNĐ' : new Intl.NumberFormat('vi-VN').format(num) + ' VNĐ';
}

function safeSeats(seats) {
    const num = parseInt(seats);
    return isNaN(num) ? 0 : num;
}

// === MAIN HANDLER ===
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    const body = req.body;
    console.log('Incoming payload:', JSON.stringify(body, null, 2));

    try {
        // CHỈ DÙNG INTENT.DISPLAYNAME
        const intentName = body.queryResult?.intent?.displayName || '';
        if (intentName !== 'TimVeXe') {
            return res.status(200).json({ fulfillmentText: "Xin lỗi, tôi chưa hiểu ý bạn." });
        }

        console.log('Entered TimVeXe block');

        const params = body.queryResult.parameters;

        // Xử lý array
        let diemDi = params.diemDi;
        if (Array.isArray(diemDi)) diemDi = diemDi[0] || '';
        else diemDi = diemDi || '';

        let diemDen = params.diemDen;
        if (Array.isArray(diemDen)) diemDen = diemDen[0] || '';
        else diemDen = diemDen || '';

        let thoiGian = params.thoiGian;

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
                fulfillmentText: `Xin lỗi, không tìm thấy địa điểm "${!startId ? diemDi : diemDen}".`
            });
        }

        console.log(`Mapped IDs: ${startId} → ${endId}`);

        const departureDate = formatDepartureDate(thoiGian);
        const requestBody = {
            startLocation: startId,
            endLocation: endId,
            status: 'on_sell'
        };
        if (departureDate) requestBody.departureDate = departureDate;

        console.log("Gửi API search:", requestBody);

        const apiResponse = await axios.post(`${BACKEND_BASE_URL}/api/trips/search`, requestBody, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        // === LẤY DỮ LIỆU TỪ .result (object) ===
        const result = apiResponse.data.result;
        if (!result || !result.trip_id) {
            return res.status(200).json({
                fulfillmentText: `Không tìm thấy chuyến nào từ ${diemDi} đến ${diemDen}${thoiGian ? ` vào ${formatTime(departureDate)}` : ''}.`
            });
        }

        const trip = result;
        const bookingLink = `${BACKEND_BASE_URL.replace('/api', '')}/booking?tripId=${trip.trip_id}`;

        let responseText = `Tìm thấy 1 chuyến từ ${diemDi} đến ${diemDen} vào ${formatTime(trip.departure_time)}:\n\n`;
        responseText += `1. ${trip.operator_name || 'Nhà xe'}\n`;
        responseText += `   ${formatTime(trip.departure_time)} → ${formatTime(trip.arrival_time)}\n`;
        responseText += `   ${formatPrice(trip.price_per_seat)}\n`;
        responseText += `   ${safeSeats(trip.available_seats)} chỗ trống\n`;
        if (trip.average_rating && trip.average_rating > 0) {
            responseText += `   ${trip.average_rating.toFixed(1)}/5\n`;
        }
        responseText += `   Đặt vé: ${bookingLink}`;

        res.status(200).json({ fulfillmentText: responseText });

    } catch (error) {
        console.error("Webhook error:", error.message);
        let errorMsg = "Đã có lỗi xảy ra. Vui lòng thử lại.";
        if (error.response) {
            errorMsg = `Lỗi server: ${error.response.data?.message || error.message}`;
        }
        res.status(200).json({ fulfillmentText: errorMsg });
    }
};

// === PRE-LOAD LOCATIONS ===
loadLocationsFromAPI().catch(() => console.log('Preload locations skipped'));