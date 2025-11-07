// // File: /api/webhook.js
// const axios = require('axios');
// const axiosRetry = require('axios-retry').default; // Cài thêm: npm i axios-retry

// // !!! THAY ĐỔI URL API THỰC TẾ CỦA BẠN !!!
// const BACKEND_BASE_URL = 'https://randa-unhappi-castiel.ngrok-free.dev'; // Xóa khoảng trắng

// // Cache locations
// let LOCATION_MAP = {};
// let LOCATION_CACHE_TIME = null;
// const CACHE_DURATION = 3600000; // 1 giờ

// // Config retry cho axios
// axiosRetry(axios, { retries: 3, retryDelay: (retryCount) => retryCount * 1000 });

// /**
//  * Load danh sách locations từ API Spring Boot
//  */
// async function loadLocationsFromAPI() {
//     try {
//         console.log('🔄 Loading locations from API...');
        
//         const response = await axios.get(`${BACKEND_BASE_URL}/api/locations`, {
//             timeout: 5000,
//             headers: {
//                 'ngrok-skip-browser-warning': 'true'
//             }
//         });
        
//         let locations = response.data.result || response.data.data || response.data;
        
//         if (!Array.isArray(locations)) {
//             console.error('❌ Locations not array');
//             return false;
//         }

//         console.log(`✅ Loaded ${locations.length} locations`);
        
//         LOCATION_MAP = {};
        
//         locations.forEach((location) => {
//             const id = location.locationId;
//             const name = location.locationName;
            
//             if (!id || !name) return;
            
//             LOCATION_MAP[name.toLowerCase()] = id;
            
//             const baseName = name.split('-')[0].trim().toLowerCase();
//             if (baseName !== name.toLowerCase()) {
//                 LOCATION_MAP[baseName] = id;
//             }
            
//             // Mapping thủ công (cải thiện: dùng object riêng nếu cần)
//             const lowerName = name.toLowerCase();
//             if (lowerName.includes('miền đông') || lowerName.includes('mien dong')) {
//                 ['tp.hcm', 'tphcm', 'hồ chí minh', 'sài gòn', 'saigon'].forEach(key => LOCATION_MAP[key] = id);
//             }
//             if (lowerName.includes('giáp bát') || lowerName.includes('giap bat')) {
//                 ['hà nội', 'ha noi', 'hanoi', 'hn'].forEach(key => LOCATION_MAP[key] = id);
//             }
//             // Tương tự cho các thành phố khác...
//         });
        
//         console.log(`✅ LOCATION_MAP built with ${Object.keys(LOCATION_MAP).length} keys`);
//         LOCATION_CACHE_TIME = Date.now();
//         return true;
        
//     } catch (error) {
//         console.error('❌ Error loading locations:', error.message);
//         return false;
//     }
// }

// /**
//  * Lấy Location ID từ tên (có cache)
//  */
// async function getLocationId(locationName) {
//     if (!locationName) return null;
    
//     const needReload = !LOCATION_CACHE_TIME || (Date.now() - LOCATION_CACHE_TIME > CACHE_DURATION);
    
//     if (needReload || Object.keys(LOCATION_MAP).length === 0) {
//         const success = await loadLocationsFromAPI();
//         if (!success) return null;
//     }
    
//     const normalized = locationName.trim().toLowerCase();
    
//     // Exact match
//     if (LOCATION_MAP[normalized]) return LOCATION_MAP[normalized];
    
//     // Partial match
//     for (const [key, value] of Object.entries(LOCATION_MAP)) {
//         if (key.includes(normalized) || normalized.includes(key)) {
//             return value;
//         }
//     }
    
//     return null;
// }

// /**
//  * Format thời gian từ Dialogflow sang ISO 8601
//  */
// function formatDepartureDate(thoiGian) {
//     if (!thoiGian) return null;
//     try {
//         const date = new Date(thoiGian);
//         if (isNaN(date)) throw new Error('Invalid date');
//         return date.toISOString();
//     } catch (error) {
//         console.error("Lỗi format ngày:", error);
//         return null;
//     }
// }

// // Các hàm format khác giữ nguyên...

// /**
//  * Main Handler
//  */
// module.exports = async function handler(req, res) {
//     if (req.method !== 'POST') {
//         res.setHeader('Allow', ['POST']);
//         return res.status(405).end('Method Not Allowed');
//     }

//     const body = req.body;
//     console.log('📥 Incoming payload:', JSON.stringify(body, null, 2)); // Debug full body

//     try {
//         const intentName = body.queryResult.intent.displayName;
//         const parameters = body.queryResult.parameters;

//         console.log("Intent:", intentName);
//         console.log("Parameters:", parameters);

//         let responseText = "Xin lỗi, tôi chưa hiểu ý bạn.";

//         if (intentName === 'TimVeXe') { // Thay đổi để khớp displayName từ ảnh (hoặc set action name)
//             // Trích xuất parameters đúng cách (hỗ trợ entity object)
//             const diemDi = parameters.diemDi?.original || parameters.diemDi;
//             const diemDen = parameters.diemDen?.original || parameters.diemDen;
//             const thoiGian = parameters.thoiGian?.original || parameters.thoiGian; // Hoặc parameters.thoiGian.date_time nếu là sys.date-time

//             console.log("Điểm đi:", diemDi);
//             console.log("Điểm đến:", diemDen);
//             console.log("Thời gian:", thoiGian);

//             if (!diemDi || !diemDen) {
//                 return res.status(200).json({ fulfillmentText: "Vui lòng cho tôi biết điểm đi và điểm đến." });
//             }

//             const startLocationId = await getLocationId(diemDi);
//             const endLocationId = await getLocationId(diemDen);

//             if (!startLocationId || !endLocationId) {
//                 return res.status(200).json({
//                     fulfillmentText: `Xin lỗi, không tìm thấy địa điểm "${!startLocationId ? diemDi : diemDen}". Thử tên khác?`
//                 });
//             }

//             console.log(`Mapped IDs: ${startLocationId} → ${endLocationId}`);

//             const departureDate = formatDepartureDate(thoiGian);

//             const searchApiUrl = `${BACKEND_BASE_URL}/api/trips/search`;
//             const requestBody = {
//                 startLocation: startLocationId,
//                 endLocation: endLocationId,
//                 status: 'on_sell'
//             };
//             if (departureDate) requestBody.departureDate = departureDate;

//             console.log("Request to Spring API:", requestBody);

//             const apiResponse = await axios.post(searchApiUrl, requestBody, {
//                 headers: { 'Content-Type': 'application/json' },
//                 timeout: 10000
//             });

//             const trips = apiResponse.data.result || apiResponse.data.data || apiResponse.data || [];

//             console.log(`Found ${trips.length} trips`);

//             if (trips.length > 0) {
//                 const topTrips = trips.slice(0, 5);
//                 responseText = `🚌 Tìm thấy ${trips.length} chuyến từ ${diemDi} đến ${diemDen}${thoiGian ? ` vào ${formatTime(departureDate)}` : ''}:\n\n`;
//                 topTrips.forEach((trip, index) => {
//                     const linkDatVe = `${BACKEND_BASE_URL.replace('/api', '')}/booking?tripId=${trip.tripId}`;
//                     responseText += `${index + 1}. 🚍 ${trip.operatorName}\n   ⏰ ${formatTime(trip.departureTime)} → ${formatTime(trip.arrivalEstimateTime)}\n   💰 ${formatPrice(trip.pricePerSeat)} VNĐ\n   🪑 ${trip.availableSeats} chỗ trống\n${trip.averageRating > 0 ? `   ⭐ ${trip.averageRating.toFixed(1)}/5\n` : ''}   🔗 Đặt vé: ${linkDatVe}\n\n`;
//                 });
//                 if (trips.length > 5) responseText += `... và ${trips.length - 5} chuyến khác.`;
//             } else {
//                 responseText = `😔 Không tìm thấy chuyến nào từ ${diemDi} đến ${diemDen}${thoiGian ? ` vào ${formatTime(departureDate)}` : ''}. Thử ngày khác?`;
//             }
//         }

//         res.status(200).json({ fulfillmentText: responseText });

//     } catch (error) {
//         console.error("Webhook error:", error.stack);
//         let errorMsg = "Đã có lỗi xảy ra. Vui lòng thử lại.";
//         if (error.response) errorMsg = `Lỗi server: ${error.response.data?.message || error.message}`;
//         res.status(200).json({ fulfillmentText: errorMsg }); // Luôn trả 200 cho Dialogflow, chỉ thay đổi text
//     }
// }

// // Pre-load locations
// loadLocationsFromAPI().catch(console.error);

// File: /api/webhook.js
const axios = require('axios');
const axiosRetry = require('axios-retry').default;

// !!! THAY ĐỔI URL API THỰC TẾ CỦA BẠN !!!
const BACKEND_BASE_URL = 'https://randa-unhappi-castiel.ngrok-free.dev';

// Cache locations
let LOCATION_MAP = {};
let LOCATION_CACHE_TIME = null;
const CACHE_DURATION = 3600000; // 1 giờ

// Fallback static map (update với ID thực nếu cần)
const FALLBACK_MAP = {
    'điện biên': 22, // Từ log, có vẻ khớp
    'dien bien': 22,
    'an giang': 8,
    // Thêm khác nếu cần
};

// Config retry cho axios
axiosRetry(axios, { retries: 3, retryDelay: (retryCount) => retryCount * 2000 });

/**
 * Load danh sách locations từ API Spring Boot
 */
async function loadLocationsFromAPI() {
    try {
        console.log('🔄 Loading locations from API...');
        
        const response = await axios.get(`${BACKEND_BASE_URL}/api/locations`, {
            timeout: 15000,
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        
        let locations = response.data.result || response.data.data || response.data;
        
        if (!Array.isArray(locations)) {
            console.error('❌ Locations not array');
            return false;
        }

        console.log(`✅ Loaded ${locations.length} locations`);
        
        LOCATION_MAP = {};
        
        locations.forEach((location) => {
            const id = location.locationId;
            const name = location.locationName;
            
            if (!id || !name) return;
            
            LOCATION_MAP[name.toLowerCase()] = id;
            
            const baseName = name.split('-')[0].trim().toLowerCase();
            if (baseName !== name.toLowerCase()) {
                LOCATION_MAP[baseName] = id;
            }
            
            const lowerName = name.toLowerCase();
            if (lowerName.includes('miền đông')) {
                ['tp.hcm', 'tphcm', 'hồ chí minh', 'sài gòn', 'saigon'].forEach(key => LOCATION_MAP[key] = id);
            }
            if (lowerName.includes('giáp bát')) {
                ['hà nội', 'ha noi', 'hanoi', 'hn'].forEach(key => LOCATION_MAP[key] = id);
            }
            if (lowerName.includes('điện biên') || lowerName.includes('dien bien')) {
                LOCATION_MAP['điện biên'] = id;
                LOCATION_MAP['dien bien'] = id;
            }
            if (lowerName.includes('an giang')) {
                LOCATION_MAP['an giang'] = id;
            }
            // Thêm mapping khác
        });
        
        console.log(`✅ LOCATION_MAP built with ${Object.keys(LOCATION_MAP).length} keys`);
        LOCATION_CACHE_TIME = Date.now();
        return true;
        
    } catch (error) {
        console.error('❌ Error loading locations:', error.message);
        return false;
    }
}

/**
 * Lấy Location ID từ tên (có cache)
 */
async function getLocationId(locationName) {
    if (!locationName) return null;
    
    const needReload = !LOCATION_CACHE_TIME || (Date.now() - LOCATION_CACHE_TIME > CACHE_DURATION);
    
    if (needReload || Object.keys(LOCATION_MAP).length === 0) {
        const success = await loadLocationsFromAPI();
        if (!success) {
            console.log('⚠️ Using fallback map');
            LOCATION_MAP = { ...FALLBACK_MAP };
        }
    }
    
    const normalized = locationName.trim().toLowerCase();
    
    if (LOCATION_MAP[normalized]) return LOCATION_MAP[normalized];
    
    for (const [key, value] of Object.entries(LOCATION_MAP)) {
        if (key.includes(normalized) || normalized.includes(key)) {
            return value;
        }
    }
    
    console.log(`Không tìm thấy ID cho "${locationName}"`);
    return null;
}

/**
 * Format thời gian từ Dialogflow sang ISO 8601
 */
function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;
    try {
        let iso = thoiGian.replace(' ', 'T').split('.')[0] + '+07:00';
        const date = new Date(iso);
        if (isNaN(date)) throw new Error('Invalid date');
        console.log(`Formatted departure: ${date.toISOString()}`);
        return date.toISOString();
    } catch (error) {
        console.error("Lỗi format ngày:", error);
        return null;
    }
}

/**
 * Format giá tiền VNĐ
 */
function formatPrice(price) {
    try {
        return new Intl.NumberFormat('vi-VN').format(price);
    } catch (error) {
        console.error("Lỗi format giá:", error);
        return price + ' VNĐ'; // Fallback
    }
}

/**
 * Format thời gian hiển thị
 */
function formatTime(isoString) {
    try {
        const date = new Date(isoString);
        return date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });
    } catch (error) {
        console.error("Lỗi format time:", error);
        return isoString; // Fallback
    }
}

/**
 * Main Handler
 */
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    const body = req.body;
    console.log('📥 Incoming payload:', JSON.stringify(body, null, 2));

    try {
        const intentName = body.queryResult.intent.displayName;
        const parameters = body.queryResult.parameters;

        console.log("Intent:", intentName);
        console.log("Parameters:", parameters);

        let responseText = "Xin lỗi, tôi chưa hiểu ý bạn.";

        if (intentName === 'TimVeXe') { // Fix để khớp log mới (TimVeXe)
            const diemDi = parameters.diemDi?.original || parameters.diemDi;
            const diemDen = parameters.diemDen?.original || parameters.diemDen;
            const thoiGian = parameters.thoiGian?.original || parameters.thoiGian;

            console.log("Điểm đi:", diemDi);
            console.log("Điểm đến:", diemDen);
            console.log("Thời gian:", thoiGian);

            if (!diemDi || !diemDen) {
                return res.status(200).json({ fulfillmentText: "Vui lòng cho tôi biết điểm đi và điểm đến." });
            }

            const startLocationId = await getLocationId(diemDi);
            const endLocationId = await getLocationId(diemDen);

            if (!startLocationId || !endLocationId) {
                return res.status(200).json({
                    fulfillmentText: `Xin lỗi, không tìm thấy địa điểm "${!startLocationId ? diemDi : diemDen}". Thử tên khác?`
                });
            }

            console.log(`Mapped IDs: ${startLocationId} → ${endLocationId}`);

            const departureDate = formatDepartureDate(thoiGian);

            const searchApiUrl = `${BACKEND_BASE_URL}/api/trips/search`;
            const requestBody = {
                startLocation: startLocationId,
                endLocation: endLocationId,
                status: 'on_sell'
            };
            if (departureDate) requestBody.departureDate = departureDate;

            console.log("Request to Spring API:", requestBody);

            const apiResponse = await axios.post(searchApiUrl, requestBody, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            });

            const trips = apiResponse.data.result || apiResponse.data.data || apiResponse.data || [];

            console.log(`Found ${trips.length} trips`);

            if (trips.length > 0) {
                const topTrips = trips.slice(0, 5);
                responseText = `🚌 Tìm thấy ${trips.length} chuyến từ ${diemDi} đến ${diemDen}${thoiGian ? ` vào ${formatTime(departureDate)}` : ''}:\n\n`;
                topTrips.forEach((trip, index) => {
                    try {
                        const linkDatVe = `${BACKEND_BASE_URL.replace('/api', '')}/booking?tripId=${trip.tripId}`;
                        responseText += `${index + 1}. 🚍 ${trip.operatorName || 'Nhà xe không xác định'}\n`;
                        responseText += `   ⏰ ${formatTime(trip.departureTime)} → ${formatTime(trip.arrivalEstimateTime)}\n`;
                        responseText += `   💰 ${formatPrice(trip.pricePerSeat)} VNĐ\n`;
                        responseText += `   🪑 ${trip.availableSeats || 0} chỗ trống\n`;
                        if (trip.averageRating > 0) {
                            responseText += `   ⭐ ${trip.averageRating.toFixed(1)}/5\n`;
                        }
                        responseText += `   🔗 Đặt vé: ${linkDatVe}\n\n`;
                    } catch (err) {
                        console.error('Lỗi format trip:', err);
                        responseText += `${index + 1}. Lỗi hiển thị chuyến này.\n\n`;
                    }
                });
                if (trips.length > 5) responseText += `... và ${trips.length - 5} chuyến khác.`;
            } else {
                responseText = `😔 Không tìm thấy chuyến nào từ ${diemDi} đến ${diemDen}${thoiGian ? ` vào ${formatTime(departureDate)}` : ''}. Thử ngày khác?`;
            }
        }

        res.status(200).json({ fulfillmentText: responseText });

    } catch (error) {
        console.error("Webhook error:", error.stack);
        let errorMsg = "Đã có lỗi xảy ra. Vui lòng thử lại.";
        if (error.response) errorMsg = `Lỗi server: ${error.response.data?.message || error.message}`;
        res.status(200).json({ fulfillmentText: errorMsg });
    }
}

// Pre-load locations
loadLocationsFromAPI().catch(console.error);