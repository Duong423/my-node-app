const axios = require('axios');
const axiosRetry = require('axios-retry').default;

const BACKEND_BASE_URL = 'https://randa-unhappi-castiel.ngrok-free.dev';

let LOCATION_MAP = {};
let LOCATION_CACHE_TIME = null;
const CACHE_DURATION = 3600000; // 1 giờ

const FALLBACK_MAP = {
    'điện biên': 22, 'dien bien': 22,
    'an giang': 8,
    'đà lạt': 9, 'da lat': 9,
    'huế': 10, 'hue': 10,
    'hà nội': 1, 'ha noi': 1,
    'tp.hcm': 2, 'sài gòn': 2, 'saigon': 2,
};

axiosRetry(axios, { retries: 2, retryDelay: () => 1000 });

// === LOAD LOCATIONS (TĂNG TIMEOUT) ===
async function loadLocationsFromAPI() {
    try {
        console.log('Loading locations from API...');
        const response = await axios.get(`${BACKEND_BASE_URL}/api/locations`, {
            timeout: 15000, // Tăng lên 15s
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        let locations = response.data.result || response.data.data || response.data;
        if (!Array.isArray(locations)) throw new Error('Not array');

        LOCATION_MAP = {};
        locations.forEach(loc => {
            const id = loc.locationId;
            const name = loc.locationName;
            if (!id || !name) return;

            const lower = name.toLowerCase();
            LOCATION_MAP[lower] = id;

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

    if (!LOCATION_CACHE_TIME || Date.now() - LOCATION_CACHE_TIME > CACHE_DURATION) {
        await loadLocationsFromAPI();
    }

    if (LOCATION_MAP[normalized]) return LOCATION_MAP[normalized];

    for (const [key, id] of Object.entries(LOCATION_MAP)) {
        if (key.includes(normalized) || normalized.includes(key)) return id;
    }

    console.log(`Không tìm thấy ID cho "${name}"`);
    return null;
}

// === XỬ LÝ THỜI GIAN TỪ DIALOGFLOW ===
function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;

    console.log('📅 Input từ Dialogflow:', thoiGian);

    let dateStr = null;

    // Case 1: Object với date_time (Dialogflow mới nhất)
    if (typeof thoiGian === 'object' && !Array.isArray(thoiGian)) {
        if (thoiGian.date_time) {
            dateStr = thoiGian.date_time;
            console.log('🎯 Lấy từ object.date_time:', dateStr);
        }
    }
    // Case 2: String trực tiếp
    else if (typeof thoiGian === 'string') {
        const trimmed = thoiGian.trim().replace(/\.000000$/, '');
        
        // Case 2a: Đã có format ISO với timezone (2025-11-24T07:00:00+07:00)
        if (trimmed.includes('T') && trimmed.includes(':')) {
            dateStr = trimmed;
            // Thêm timezone nếu chưa có
            if (!dateStr.includes('+') && !dateStr.includes('Z')) {
                dateStr = dateStr + '+07:00';
            }
        }
        // Case 2b: Format "YYYY-MM-DD HH:mm:ss" (2025-11-24 07:00:00)
        else if (trimmed.includes(' ') && trimmed.includes(':')) {
            const [date, time] = trimmed.split(' ');
            const timePart = time.split(':').slice(0, 3).join(':');
            dateStr = `${date}T${timePart}+07:00`;
        }
        // Case 2c: Chỉ có ngày "YYYY-MM-DD" (2025-11-24)
        else {
            dateStr = trimmed + 'T00:00:00+07:00';
        }
    }
    // Case 3: Array (backward compatibility)
    else if (Array.isArray(thoiGian)) {
        console.log('⚠️ Nhận array thay vì string:', thoiGian);
        const candidates = thoiGian.filter(item => 
            typeof item === 'string' && item.includes('T') && item.includes(':')
        );
        
        if (candidates.length > 0) {
            // Ưu tiên lấy thời gian trong khoảng 5h-22h (giờ hành chính/xe chạy)
            // Tránh lấy 00:00 (nửa đêm) và 23:00 (gần nửa đêm)
            const withRealisticTime = candidates.filter(item => {
                const timePart = item.split('T')[1];
                if (!timePart) return false;
                const hour = parseInt(timePart.split(':')[0]);
                // Lấy giờ từ 5h sáng đến 22h tối (thời gian xe khách thường chạy)
                return hour >= 5 && hour <= 22;
            });
            
            // Nếu có giờ hợp lý, lấy cái cuối cùng (thường là giờ người dùng chỉ định)
            // Nếu không, fallback lấy cái cuối trong candidates
            dateStr = withRealisticTime.length > 0 
                ? withRealisticTime[withRealisticTime.length - 1] 
                : candidates[candidates.length - 1];
                
            console.log(`🎯 Đã chọn: ${dateStr} từ ${candidates.length} candidates`);
        }
    }

    if (!dateStr) {
        console.error('❌ Không parse được thời gian');
        return null;
    }

    try {
        // Validate datetime
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            console.error('❌ Invalid date:', dateStr);
            return null;
        }
        
        console.log(`✅ Thời gian đã format: ${dateStr}`);
        return dateStr;
    } catch (error) {
        console.error('❌ Parse error:', error.message);
        return null;
    }
}

// === HIỂN THỊ GIỜ VIỆT NAM ===
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
        const intentName = body.queryResult?.intent?.displayName || '';
        if (intentName !== 'TimVeXe') {
            return res.status(200).json({ fulfillmentText: "Xin lỗi, tôi chưa hiểu ý bạn." });
        }

        console.log('Entered TimVeXe block');

        const params = body.queryResult.parameters;

        let diemDi = params.diemDi;
        if (Array.isArray(diemDi)) diemDi = diemDi[0] || '';
        else diemDi = diemDi || '';

        let diemDen = params.diemDen;
        if (Array.isArray(diemDen)) diemDen = diemDen[0] || '';
        else diemDen = diemDen || '';

        let thoiGian = params.thoiGian;

        console.log("Điểm đi:", diemDi);
        console.log("Điểm đến:", diemDen);
        console.log("Thời gian:", thoiGian);

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
            timeout: 15000
        });

        const result = apiResponse.data.result;
        if (!result || !result.trip_id) {
            const timeDisplay = thoiGian ? ` vào ${formatTime(departureDate)}` : '';
            return res.status(200).json({
                fulfillmentText: `Không tìm thấy chuyến nào từ ${diemDi} đến ${diemDen}${timeDisplay}.`
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
        if (error.response?.data?.message) errorMsg = error.response.data.message;
        res.status(200).json({ fulfillmentText: errorMsg });
    }
};

// Pre-load
loadLocationsFromAPI().catch(() => {});