// Test với data THỰC từ Dialogflow

function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;

    let dateStr = null;

    if (Array.isArray(thoiGian)) {
        console.log('🔍 Array từ Dialogflow:', thoiGian);
        
        // Lọc các string có dạng ISO datetime (loại bỏ object)
        const candidates = thoiGian.filter(item => 
            typeof item === 'string' && item.includes('T') && item.includes(':')
        );
        
        if (candidates.length > 0) {
            // ƯU TIÊN 1: Lấy thời gian có giờ CỤ THỂ (không phải 00:00:00)
            const withSpecificTime = candidates.filter(item => {
                const timePart = item.split('T')[1];
                return timePart && !timePart.startsWith('00:00:00');
            });
            
            if (withSpecificTime.length > 0) {
                // Nếu có nhiều thời gian cụ thể, lấy cái cuối (thường là chính xác nhất)
                dateStr = withSpecificTime[withSpecificTime.length - 1];
                console.log('✅ Chọn thời gian CỤ THỂ:', dateStr);
            } else {
                // Không có giờ cụ thể, lấy midnight cuối cùng
                dateStr = candidates[candidates.length - 1];
                console.log('⚠️ Chỉ có 00:00, lấy:', dateStr);
            }
        }
    } else if (typeof thoiGian === 'string') {
        const trimmed = thoiGian.trim().replace(/\.000000$/, '');
        const parts = trimmed.split(' ');
        
        if (parts.length === 2) {
            // Format: "2025-11-24 07:00:00" -> "2025-11-24T07:00:00+07:00"
            const [date, time] = parts;
            const timePart = time.includes(':') ? time.split(':').slice(0, 3).join(':') : time + ':00:00';
            dateStr = `${date}T${timePart}+07:00`;
        } else {
            // Chỉ có ngày -> thêm 00:00:00
            dateStr = trimmed.includes('T') ? trimmed : trimmed + 'T00:00:00+07:00';
        }
    }

    if (!dateStr) return null;

    try {
        // Validate
        const date = new Date(dateStr);
        if (isNaN(date)) {
            console.error('❌ Invalid date string:', dateStr);
            return null;
        }
        
        // Đảm bảo có timezone +07:00
        if (!dateStr.includes('+') && !dateStr.includes('Z')) {
            dateStr = dateStr.replace(/T/, 'T') + '+07:00';
        }
        
        console.log(`✅ Thời gian cuối cùng: ${dateStr}`);
        return dateStr;
    } catch (error) {
        console.error('❌ Parse error:', error.message);
        return null;
    }
}

console.log('═══════════════════════════════════════════════════════');
console.log('📋 TEST 1: DATA THỰC TỪ DIALOGFLOW (24/11 lúc 7h)');
console.log('═══════════════════════════════════════════════════════');

const dialogflowRealData = [
    {"startDate":"2025-01-01T00:00:00+07:00","endDate":"2025-12-31T23:59:59+07:00"},
    "2025-11-07T23:00:00+07:00",
    "2025-11-08T00:00:00+07:00",
    "2025-11-08T07:00:00+07:00"  // ← PHẢI LẤY CÁI NÀY (7h sáng)
];

const result1 = formatDepartureDate(dialogflowRealData);
console.log('\n🎯 Kết quả:', result1);
console.log('🎯 Mong muốn: 2025-11-08T07:00:00+07:00 (7 giờ sáng)');
console.log(result1 === '2025-11-08T07:00:00+07:00' ? '✅ PASS - Đúng rồi!' : '❌ FAIL - Sai!');

console.log('\n═══════════════════════════════════════════════════════');
console.log('📋 TEST 2: CHỈ CÓ NGÀY, KHÔNG CÓ GIỜ (24/11)');
console.log('═══════════════════════════════════════════════════════');

const onlyDateArray = [
    {"startDate":"2025-01-01T00:00:00+07:00","endDate":"2025-12-31T23:59:59+07:00"},
    "2025-11-24T00:00:00+07:00"  // Chỉ có ngày, không có giờ cụ thể
];

const result2 = formatDepartureDate(onlyDateArray);
console.log('\n🎯 Kết quả:', result2);
console.log('🎯 Mong muốn: 2025-11-24T00:00:00+07:00 (0h - vì user không nói giờ)');
console.log(result2 === '2025-11-24T00:00:00+07:00' ? '✅ PASS' : '❌ FAIL');

console.log('\n═══════════════════════════════════════════════════════');
console.log('📋 TEST 3: CÓ NHIỀU GIỜ CỤ THỂ (14h, 7h, 9h)');
console.log('═══════════════════════════════════════════════════════');

const multipleTimesArray = [
    "2025-11-24T14:00:00+07:00",  // 2h chiều
    "2025-11-24T07:00:00+07:00",  // 7h sáng
    "2025-11-24T09:30:00+07:00"   // 9h30 sáng ← LẤY CÁI CUỐI
];

const result3 = formatDepartureDate(multipleTimesArray);
console.log('\n🎯 Kết quả:', result3);
console.log('🎯 Mong muốn: 2025-11-24T09:30:00+07:00 (lấy giờ cuối cùng)');
console.log(result3 === '2025-11-24T09:30:00+07:00' ? '✅ PASS' : '❌ FAIL');

console.log('\n═══════════════════════════════════════════════════════');
console.log('📋 TEST 4: STRING ĐƠN GIẢN (không phải array)');
console.log('═══════════════════════════════════════════════════════');

const simpleString = '2025-11-24 07:00:00.000000';
const result4 = formatDepartureDate(simpleString);
console.log('\n🎯 Kết quả:', result4);
console.log('🎯 Mong muốn: 2025-11-24T07:00:00+07:00');
console.log(result4 === '2025-11-24T07:00:00+07:00' ? '✅ PASS' : '❌ FAIL');

console.log('\n═══════════════════════════════════════════════════════');
console.log('📊 TỔNG KẾT');
console.log('═══════════════════════════════════════════════════════');
console.log('Logic mới:');
console.log('1. ✅ Lọc các thời gian có giờ CỤ THỂ (khác 00:00)');
console.log('2. ✅ Lấy giờ cuối cùng trong danh sách (chính xác nhất)');
console.log('3. ✅ Nếu không có giờ cụ thể → lấy 00:00');
console.log('4. ✅ Hỗ trợ cả string đơn và array');
console.log('═══════════════════════════════════════════════════════');
