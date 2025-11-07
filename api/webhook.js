const axios = require('axios');
const axiosRetry = require('axios-retry').default;

// !!! THAY ĐỔI URL API THỰC TẾ CỦA BẠN !!!
const BACKEND_BASE_URL = 'https://randa-unhappi-castiel.ngrok-free.dev';

// Cache locations
let LOCATION_MAP = {};
let LOCATION_CACHE_TIME = null;
const CACHE_DURATION = 3600000; // 1 giờ

// Fallback static map
const FALLBACK_MAP = {
    'điện biên': 22,
    'dien bien': 22,
    'an giang': 8,
    'đà lạt': 9,
    'da lat': 9,
    'huế': 10,
    'hue': 10,
};

// Config retry cho axios
axiosRetry(axios, { retries: 3, retryDelay: (retryCount) => retryCount * 2000 });

/**
 * Load danh sách locations từ API
 */
async function loadLocationsFromAPI() {
    try {
        console.log('Loading locations from API...');
        const response = await axios.get(`${BACKEND_BASE_URL}/api/locations`, {
            timeout: 15000,
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        let locations = response.data.result || response.data.data || response.data;
        if (!Array.isArray(locations)) {
            console.error('Locations not array');
            return false;
        }

        console.log(`Loaded ${locations.length} locations`);
        LOCATION_MAP = {};

        locations.forEach((location) => {
            const id = location.locationId;
            const name = location.locationName;
            if (!id || !name) return;

            const lowerName = name.toLowerCase();
            LOCATION_MAP[lowerName] = id;

            // Thêm alias
            const baseName = name.split('-')[0].trim().toLowerCase();
            if (baseName !== lowerName) LOCATION_MAP[baseName] = id;

            // Mapping phổ biến
            if (lowerName.includes('miền đông')) {
                ['tp.hcm', 'tphcm', 'hồ chí minh', 'sài gòn', 'saigon'].forEach(k => LOCATION_MAP[k] = id);
            }
            if (lowerName.includes('giáp bát')) {
                ['hà nội', 'ha noi', 'hanoi', 'hn'].forEach(k => LOCATION_MAP[k] = id);
            }
            if (lowerName.includes('điện biên') || lowerName.includes('dien bien')) {
                LOCATION_MAP['điện biên'] = id;
                LOCATION_MAP['dien bien'] = id;
            }
            if (lowerName.includes('an giang')) LOCATION_MAP['an giang'] = id;
            if (lowerName.includes('đà lạt') || lowerName.includes('da lat')) {
                LOCATION_MAP['đà lạt'] = id;
                LOCATION_MAP['da lat'] = id;
            }
            if (lowerName.includes('huế') || lowerName.includes('hue')) {
                LOCATION_MAP['huế'] = id;
                LOCATION_MAP['hue'] = id;
            }
        });

        console.log(`LOCATION_MAP built with ${Object.keys(LOCATION_MAP).length} keys`);
        LOCATION_CACHE_TIME = Date.now();
        return true;
    } catch (error) {
        console.error('Error loading locations:', error.message);
        return false;
    }
}

/**
 * Lấy Location ID
 */
async function getLocationId(locationName) {
    if (!locationName) return null;
    if (Array.isArray(locationName)) locationName = locationName[0] || '';

    const needReload = !LOCATION_CACHE_TIME || (Date.now() - LOCATION_CACHE_TIME > CACHE_DURATION);
    if (needReload || Object.keys(LOCATION_MAP).length === 0) {
        const success = await loadLocationsFromAPI();
        if (!success) {
            console.log('Using fallback map');
            LOCATION_MAP = { ...FALLBACK_MAP };
        }
    }

    const normalized = locationName.trim().toLowerCase();
    if (LOCATION_MAP[normalized]) return LOCATION_MAP[normalized];

    for (const [key, value] of Object.entries(LOCATION_MAP)) {
        if (key.includes(normalized) || normalized.includes(key)) return value;
    }

    console.log(`Không tìm thấy ID cho "${locationName}"`);
    return null;
}

/**
 * Format thời gian từ Dialogflow sang ISO local VN (KHÔNG chuyển UTC)
 */
function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;
    try {
        let dateStr;
        if (Array.isArray(thoiGian)) {
            dateStr = thoiGian.find(item => typeof item === 'string' && item.includes('T')) || thoiGian[thoiGian.length - 1];
            if (typeof dateStr === 'object') dateStr = dateStr.startDate || dateStr.endDate;
        } else if (typeof thoiGian === 'string') {
            // Fix: Parse thành local date, KHÔNG + timezone, giữ nguyên ngày/giờ
            dateStr = thoiGian.replace(' ', 'T').split('.')[0]; // "2025-11-24T07:00:00" (local)
        } else {
            dateStr = thoiGian;
        }

        const date = new Date(dateStr + '+07:00'); // Parse với VN timezone để giữ ngày đúng
        if (isNaN(date)) throw new Error('Invalid date');
        
        // Trả về ISO với timezone VN (backend sẽ hiểu đúng ngày 24/11)
        const isoWithTZ = date.toISOString().replace('Z', '+07:00');
        console.log(`Formatted departure (local VN): ${isoWithTZ}`);
        return isoWithTZ;
    } catch (error) {
        console.error("Lỗi format ngày:", error);
        return null;
    }
}

/**
 * Format thời gian hiển thị (luôn theo VN timezone)
 */
function formatTime(isoString) {
    try {
        const date = new Date(isoString);
        // Fix: Buộc timezone VN (+07:00) để hiển thị đúng ngày/giờ
        const vnDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
        return vnDate.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            timeZone: 'Asia/Ho_Chi_Minh' // Buộc VN timezone
        });
    } catch (error) {
        console.error("Lỗi format time:", error);
        return isoString;
    }
}
function formatPrice(price) {
    try {
        return new Intl.NumberFormat('vi-VN').format(price);
    } catch {
        return price + ' VNĐ';
    }
}



/**
 * Main Handler – CHỈ DÙNG INTENT.DISPLAYNAME
 */
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

        console.log("Intent Name:", intentName); // Debug

        let responseText = "Xin lỗi, tôi chưa hiểu ý bạn.";

        // CHỈ KIỂM TRA INTENT NAME
        if (intentName === 'TimVeXe') {
            console.log('Entered TimVeXe block'); // Debug

            const params = body.queryResult.parameters;

            let diemDi = params.diemDi?.original || params.diemDi || '';
            if (Array.isArray(diemDi)) diemDi = diemDi[0] || '';

            let diemDen = params.diemDen?.original || params.diemDen || '';
            if (Array.isArray(diemDen)) diemDen = diemDen[0] || '';

            let thoiGian = params.thoiGian?.original || params.thoiGian || '';

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
            const requestBody = { startLocation: startId, endLocation: endId, status: 'on_sell' };
            if (departureDate) requestBody.departureDate = departureDate;

            const apiResponse = await axios.post(`${BACKEND_BASE_URL}/api/trips/search`, requestBody, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            });

            const trips = apiResponse.data.result || apiResponse.data.data || apiResponse.data || [];
            console.log(`Found ${trips.length} trips`);

            if (trips.length > 0) {
                const topTrips = trips.slice(0, 5);
                responseText = `Tìm thấy ${trips.length} chuyến từ ${diemDi} đến ${diemDen}${thoiGian ? ` vào ${formatTime(departureDate)}` : ''}:\n\n`;
                topTrips.forEach((trip, i) => {
                    const link = `${BACKEND_BASE_URL.replace('/api', '')}/booking?tripId=${trip.tripId}`;
                    responseText += `${i + 1}. ${trip.operatorName || 'Nhà xe'}\n`;
                    responseText += `   ${formatTime(trip.departureTime)} → ${formatTime(trip.arrivalEstimateTime)}\n`;
                    responseText += `   ${formatPrice(trip.pricePerSeat)} VNĐ\n`;
                    responseText += `   ${trip.availableSeats || 0} chỗ\n`;
                    if (trip.averageRating > 0) responseText += `   ${trip.averageRating.toFixed(1)}/5\n`;
                    responseText += `   Đặt vé: ${link}\n\n`;
                });
                if (trips.length > 5) responseText += `... và ${trips.length - 5} chuyến khác.`;
            } else {
                responseText = `Không tìm thấy chuyến nào từ ${diemDi} đến ${diemDen}${thoiGian ? ` vào ${formatTime(departureDate)}` : ''}.`;
            }
        }

        res.status(200).json({ fulfillmentText: responseText });

    } catch (error) {
        console.error("Webhook error:", error.stack);
        res.status(200).json({ fulfillmentText: "Đã có lỗi. Vui lòng thử lại." });
    }
}

// Pre-load locations
loadLocationsFromAPI().catch(console.error);