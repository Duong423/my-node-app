// Test formatDepartureDate function

function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;

    let dateStr = null;

    if (Array.isArray(thoiGian)) {
        // Lọc các string có dạng ISO datetime
        const candidates = thoiGian.filter(item => typeof item === 'string' && item.includes('T') && item.includes(':'));
        
        if (candidates.length > 0) {
            // Ưu tiên lấy thời gian có giờ != 00:00:00 (thời gian cụ thể)
            const withSpecificTime = candidates.find(item => {
                const timePart = item.split('T')[1];
                return timePart && !timePart.startsWith('00:00:00');
            });
            
            // Nếu có thời gian cụ thể thì dùng, không thì lấy cái cuối
            dateStr = withSpecificTime || candidates[candidates.length - 1];
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
            dateStr = trimmed.includes('T') ? trimmed : trimmed + 'T00:00:00+07:00';
        }
    }

    if (!dateStr) return null;

    try {
        // Chỉ validate, không convert timezone
        const date = new Date(dateStr);
        if (isNaN(date)) {
            console.error('Invalid date string:', dateStr);
            return null;
        }
        
        // Đảm bảo có timezone +07:00 nếu chưa có
        if (!dateStr.includes('+') && !dateStr.includes('Z')) {
            dateStr = dateStr + '+07:00';
        }
        
        // Trả về dateStr gốc để giữ nguyên giờ Việt Nam
        console.log(`Formatted departure: ${dateStr}`);
        return dateStr;
    } catch (error) {
        console.error('Parse ngày lỗi:', error.message);
        return null;
    }
}

// Test với data thực từ Dialogflow
console.log('\n🧪 Test 5: REAL Dialogflow Array - CRITICAL');
const realDialogflowData = [
    {
        startDate: '2025-01-01T00:00:00+07:00',
        endDate: '2025-12-31T23:59:59+07:00'
    },
    '2025-11-07T23:00:00+07:00',  // 23h đêm - KHÔNG nên lấy
    '2025-11-08T00:00:00+07:00',  // 00h nửa đêm - KHÔNG nên lấy
    '2025-11-08T07:00:00+07:00'   // 7h sáng - NÊN LẤY cái này!
];

function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;

    console.log('📅 Input từ Dialogflow:', thoiGian);

    let dateStr = null;

    if (typeof thoiGian === 'string') {
        const trimmed = thoiGian.trim().replace(/\.000000$/, '');
        
        if (trimmed.includes('T') && trimmed.includes(':')) {
            dateStr = trimmed;
            if (!dateStr.includes('+') && !dateStr.includes('Z')) {
                dateStr = dateStr + '+07:00';
            }
        }
        else if (trimmed.includes(' ') && trimmed.includes(':')) {
            const [date, time] = trimmed.split(' ');
            const timePart = time.split(':').slice(0, 3).join(':');
            dateStr = `${date}T${timePart}+07:00`;
        }
        else {
            dateStr = trimmed + 'T00:00:00+07:00';
        }
    }
    else if (Array.isArray(thoiGian)) {
        console.log('⚠️ Nhận array thay vì string:', thoiGian);
        const candidates = thoiGian.filter(item => 
            typeof item === 'string' && item.includes('T') && item.includes(':')
        );
        
        if (candidates.length > 0) {
            const withRealisticTime = candidates.filter(item => {
                const timePart = item.split('T')[1];
                if (!timePart) return false;
                const hour = parseInt(timePart.split(':')[0]);
                return hour >= 5 && hour <= 22;
            });
            
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
        const date = new Date(dateStr);
        if (isNaN(date)) {
            console.error('Invalid date string:', dateStr);
            return null;
        }
        
        console.log(`✅ Thời gian đã format: ${dateStr}`);
        return dateStr;
    } catch (error) {
        console.error('Parse ngày lỗi:', error.message);
        return null;
    }
}

const result = formatDepartureDate(realDialogflowData);
console.log('\n🎯 Kết quả cuối cùng:', result);
console.log('Expected: 2025-11-08T07:00:00+07:00');
console.log('✅ PASS:', result === '2025-11-08T07:00:00+07:00' ? 'YES ✓✓✓' : 'NO ✗✗✗');
