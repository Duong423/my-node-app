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
    'điện biên': 22, // Từ log trước
    'dien bien': 22,
    'an giang': 8,
    'đà lạt': 9, // Giả sử ID cho Đà Lạt, thay bằng thực tế
    'da lat': 9,
    'huế': 10, // Giả sử ID cho Huế, thay bằng thực tế
    'hue': 10,
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
            if (lowerName.includes('đà lạt') || lowerName.includes('da lat')) {
                LOCATION_MAP['đà lạt'] = id;
                LOCATION_MAP['da lat'] = id;
            }
            if (lowerName.includes('huế') || lowerName.includes('hue')) {
                LOCATION_MAP['huế'] = id;
                LOCATION_MAP['hue'] = id;
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
    
    // Handle nếu locationName là array (từ Dialogflow entity list)
    if (Array.isArray(locationName)) {
        locationName = locationName[0] || ''; // Lấy phần tử đầu tiên
    }
    
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
        let dateStr;
        if (Array.isArray(thoiGian)) {
            // Parse array: Tìm timestamp hợp lý (bỏ range object, lấy ISO string gần nhất)
            dateStr = thoiGian.find(item => typeof item === 'string' && item.includes('T')) || thoiGian[thoiGian.length - 1];
            if (typeof dateStr === 'object') {
                dateStr = dateStr.startDate || dateStr.endDate;
            }
        } else if (typeof thoiGian === 'string') {
            dateStr = thoiGian.replace(' ', 'T').split('.')[0] + '+07:00'; // Handle format "2025-11-09 05:00:00.000000"
        } else {
            dateStr = thoiGian;
        }
        
        if (dateStr) {
            const date = new Date(dateStr);
            if (isNaN(date)) throw new Error('Invalid date');
            console.log(`Formatted departure: ${date.toISOString()}`);
            return date.toISOString(); // Backend sẽ handle full ISO
        }
        return null;
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
        const intentName = body.queryResult.intent?.displayName || '';
        const action = body.queryResult.action || ''; // Lấy action nếu có

        console.log("Intent:", intentName);
        console.log("Action:", action);
        console.log("Parameters:", body.queryResult.parameters);

        let responseText = "Xin lỗi, tôi chưa hiểu ý bạn.";

        // Match hoặc intentName hoặc action (handle case-sensitive)
        if (intentName === 'TimVeXe' || action === 'timVeXe' || action === 'TimVeXe') {
            console.log('Entered intent block'); // Thêm log để debug nếu vào if

            const parameters = body.queryResult.parameters;
            // Handle array hoặc object cho parameters
            let diemDi = parameters.diemDi?.original || parameters.diemDi || '';
            if (Array.isArray(diemDi)) diemDi = diemDi[0] || '';
            
            let diemDen = parameters.diemDen?.original || parameters.diemDen || '';
            if (Array.isArray(diemDen)) diemDen = diemDen[0] || '';
            
            let thoiGian = parameters.thoiGian?.original || parameters.thoiGian || '';

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