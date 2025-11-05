// File: /api/webhook.js
const axios = require('axios');

// !!! THAY ĐỔI URL API THỰC TẾ CỦA BẠN !!!
const BACKEND_BASE_URL = ' https://randa-unhappi-castiel.ngrok-free.dev'; // hoặc 'https://your-api.com'

// Cache locations để tránh gọi API nhiều lần
let LOCATION_MAP = {};
let LOCATION_CACHE_TIME = null;
const CACHE_DURATION = 3600000; // 1 giờ (ms)

/**
 * Load danh sách locations từ API Spring Boot
 */
async function loadLocationsFromAPI() {
    try {
        console.log('🔄 Loading locations from API...');
        
        const response = await axios.get(`${BACKEND_BASE_URL}/api/locations`, {
            timeout: 5000
        });
        
        // API trả về: { code: 200, message: "...", result: [...] }
        const locations = response.data.result || response.data.data || response.data;
        
        if (!Array.isArray(locations)) {
            console.error('Invalid locations response format');
            return false;
        }

        // Clear old map
        LOCATION_MAP = {};
        
        // Build mapping tự động
        locations.forEach(location => {
            const id = location.id || location.locationId;
            const name = location.name;
            const city = location.city;
            const address = location.address;
            
            // Map tên chính
            if (name) LOCATION_MAP[name] = id;
            if (city) LOCATION_MAP[city] = id;
            if (address) LOCATION_MAP[address] = id;
            
            // Map các biến thể phổ biến
            if (city) {
                // Loại bỏ "Thành phố", "Tỉnh"
                const cleanCity = city
                    .replace(/^(Thành phố|Tỉnh)\s+/i, '')
                    .trim();
                LOCATION_MAP[cleanCity] = id;
                
                // Thêm viết tắt phổ biến
                if (cleanCity.includes('Hồ Chí Minh')) {
                    LOCATION_MAP['TP.HCM'] = id;
                    LOCATION_MAP['TPHCM'] = id;
                    LOCATION_MAP['Sài Gòn'] = id;
                    LOCATION_MAP['Saigon'] = id;
                }
                if (cleanCity.includes('Hà Nội')) {
                    LOCATION_MAP['HN'] = id;
                    LOCATION_MAP['Ha Noi'] = id;
                    LOCATION_MAP['Hanoi'] = id;
                }
                if (cleanCity.includes('Đà Nẵng')) {
                    LOCATION_MAP['DN'] = id;
                    LOCATION_MAP['Da Nang'] = id;
                    LOCATION_MAP['Danang'] = id;
                }
            }
        });
        
        LOCATION_CACHE_TIME = Date.now();
        console.log(`✅ Loaded ${locations.length} locations`);
        console.log('📍 LOCATION_MAP:', Object.keys(LOCATION_MAP).slice(0, 10), '...');
        
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
    
    // Kiểm tra cache có hết hạn không
    const needReload = !LOCATION_CACHE_TIME || 
                       (Date.now() - LOCATION_CACHE_TIME > CACHE_DURATION);
    
    if (needReload || Object.keys(LOCATION_MAP).length === 0) {
        await loadLocationsFromAPI();
    }
    
    const normalized = locationName.trim();
    
    // Tìm exact match (không phân biệt hoa thường)
    for (const [key, value] of Object.entries(LOCATION_MAP)) {
        if (key.toLowerCase() === normalized.toLowerCase()) {
            return value;
        }
    }
    
    // Tìm partial match
    const lowerName = normalized.toLowerCase();
    for (const [key, value] of Object.entries(LOCATION_MAP)) {
        if (key.toLowerCase().includes(lowerName) || 
            lowerName.includes(key.toLowerCase())) {
            return value;
        }
    }
    
    return null;
}

/**
 * Format thời gian từ Dialogflow sang ISO 8601
 */
function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;
    
    try {
        const date = new Date(thoiGian);
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
    return new Intl.NumberFormat('vi-VN').format(price);
}

/**
 * Format thời gian hiển thị
 */
function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
    });
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

    try {
        const intentName = body.queryResult.intent.displayName;
        const parameters = body.queryResult.parameters;

        console.log("Intent:", intentName);
        console.log("Parameters:", parameters);

        let responseText = "Xin lỗi, tôi chưa hiểu ý bạn.";

        if (intentName === 'tim_ve_xe') {
            const diemDi = parameters.diemDi;
            const diemDen = parameters.diemDen;
            const thoiGian = parameters.thoiGian;

            console.log("Điểm đi:", diemDi);
            console.log("Điểm đến:", diemDen);
            console.log("Thời gian:", thoiGian);

            // Validate
            if (!diemDi || !diemDen) {
                return res.status(200).json({
                    fulfillmentText: "Vui lòng cho tôi biết điểm đi và điểm đến bạn muốn tìm."
                });
            }

            // Convert tên địa điểm → ID (load từ API nếu cần)
            const startLocationId = await getLocationId(diemDi);
            const endLocationId = await getLocationId(diemDen);

            if (!startLocationId) {
                return res.status(200).json({
                    fulfillmentText: `Xin lỗi, tôi không tìm thấy địa điểm "${diemDi}" trong hệ thống. Vui lòng thử lại với tên khác.`
                });
            }

            if (!endLocationId) {
                return res.status(200).json({
                    fulfillmentText: `Xin lỗi, tôi không tìm thấy địa điểm "${diemDen}" trong hệ thống. Vui lòng thử lại với tên khác.`
                });
            }

            console.log(`Mapped: ${diemDi} → ID ${startLocationId}, ${diemDen} → ID ${endLocationId}`);

            // Format thời gian
            const departureDate = formatDepartureDate(thoiGian);

            try {
                // Gọi API Spring Boot
                const searchApiUrl = `${BACKEND_BASE_URL}/api/trips/search`;
                
                const requestBody = {
                    startLocation: startLocationId,
                    endLocation: endLocationId,
                    status: 'ON_SELL'
                };

                if (departureDate) {
                    requestBody.departureDate = departureDate;
                }

                console.log("Request to Spring API:", requestBody);

                const apiResponse = await axios.post(searchApiUrl, requestBody, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                });

                const data = apiResponse.data;
                const trips = data.result || data.data || [];

                console.log(`Found ${trips.length} trips`);

                // Format response
                if (trips && trips.length > 0) {
                    const topTrips = trips.slice(0, 5);
                    
                    responseText = `🚌 Tìm thấy ${trips.length} chuyến từ ${diemDi} đến ${diemDen}`;
                    if (thoiGian) {
                        responseText += ` vào ${formatTime(departureDate)}`;
                    }
                    responseText += ':\n\n';
                    
                    topTrips.forEach((trip, index) => {
                        const linkDatVe = `${BACKEND_BASE_URL.replace('/api', '')}/booking?tripId=${trip.tripId}`;
                        
                        responseText += `${index + 1}. 🚍 ${trip.operatorName}\n`;
                        responseText += `   ⏰ ${formatTime(trip.departureTime)} → ${formatTime(trip.arrivalEstimateTime)}\n`;
                        responseText += `   💰 ${formatPrice(trip.pricePerSeat)} VNĐ\n`;
                        responseText += `   🪑 ${trip.availableSeats} chỗ trống\n`;
                        if (trip.averageRating > 0) {
                            responseText += `   ⭐ ${trip.averageRating.toFixed(1)}/5\n`;
                        }
                        responseText += `   🔗 Đặt vé: ${linkDatVe}\n\n`;
                    });

                    if (trips.length > 5) {
                        responseText += `\n... và ${trips.length - 5} chuyến khác.`;
                    }

                } else {
                    responseText = `😔 Rất tiếc, không tìm thấy chuyến xe nào từ ${diemDi} đến ${diemDen}`;
                    if (thoiGian) {
                        responseText += ` vào ${formatTime(departureDate)}`;
                    }
                    responseText += '. Bạn có thể thử ngày khác không?';
                }

            } catch (error) {
                console.error("Error calling Spring API:", error.message);
                
                if (error.response) {
                    console.error("API Error:", error.response.status, error.response.data);
                    responseText = `Lỗi hệ thống: ${error.response.data.message || 'Không thể kết nối server'}`;
                } else if (error.request) {
                    responseText = "Không thể kết nối đến hệ thống đặt vé. Vui lòng thử lại.";
                } else {
                    responseText = "Đã có lỗi xảy ra. Vui lòng thử lại.";
                }
            }
        }

        res.status(200).json({
            fulfillmentText: responseText
        });

    } catch (error) {
        console.error("Webhook error:", error.message);
        res.status(500).json({
            fulfillmentText: "Đã có lỗi xảy ra. Vui lòng thử lại sau."
        });
    }
}

// Pre-load locations khi deploy (optional)
// Vercel serverless sẽ chạy lại mỗi lần cold start
if (process.env.VERCEL_ENV) {
    loadLocationsFromAPI().catch(console.error);
}