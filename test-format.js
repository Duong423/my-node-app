// Test formatDepartureDate function

function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;

    let dateStr = null;

    if (Array.isArray(thoiGian)) {
        const candidates = thoiGian.filter(item => typeof item === 'string' && item.includes('T') && item.includes(':'));
        dateStr = candidates.length > 0 ? candidates.pop() : null;
    } else if (typeof thoiGian === 'string') {
        const trimmed = thoiGian.trim().replace(/\.000000$/, '');
        const parts = trimmed.split(' ');
        if (parts.length === 2) {
            // Format: "2025-11-24 07:00:00" -> "2025-11-24T07:00:00+07:00"
            const [date, time] = parts;
            const timePart = time.includes(':') ? time.split(':').slice(0, 3).join(':') : time + ':00:00';
            dateStr = `${date}T${timePart}+07:00`;
        } else {
            dateStr = trimmed.includes('T') ? trimmed + '+07:00' : trimmed + 'T00:00:00+07:00';
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
        // Trả về dateStr gốc để giữ nguyên giờ Việt Nam
        console.log(`Formatted departure: ${dateStr}`);
        return dateStr;
    } catch (error) {
        console.error('Parse ngày lỗi:', error.message);
        return null;
    }
}

// Test cases
console.log('\n🧪 Test 1: Dialogflow format with time');
const test1 = formatDepartureDate('2025-11-24 07:00:00.000000');
console.log('Input: "2025-11-24 07:00:00.000000"');
console.log('Output:', test1);
console.log('Expected: 2025-11-24T07:00:00+07:00');
console.log('✅ PASS:', test1 === '2025-11-24T07:00:00+07:00' ? 'YES' : 'NO');

console.log('\n🧪 Test 2: Simple date only');
const test2 = formatDepartureDate('2025-11-24');
console.log('Input: "2025-11-24"');
console.log('Output:', test2);
console.log('Expected: 2025-11-24T00:00:00+07:00');
console.log('✅ PASS:', test2 === '2025-11-24T00:00:00+07:00' ? 'YES' : 'NO');

console.log('\n🧪 Test 3: With seconds');
const test3 = formatDepartureDate('2025-11-24 14:30:45');
console.log('Input: "2025-11-24 14:30:45"');
console.log('Output:', test3);
console.log('Expected: 2025-11-24T14:30:45+07:00');
console.log('✅ PASS:', test3 === '2025-11-24T14:30:45+07:00' ? 'YES' : 'NO');

console.log('\n🧪 Test 4: Morning time');
const test4 = formatDepartureDate('2025-12-01 09:15:00');
console.log('Input: "2025-12-01 09:15:00"');
console.log('Output:', test4);
console.log('Expected: 2025-12-01T09:15:00+07:00');
console.log('✅ PASS:', test4 === '2025-12-01T09:15:00+07:00' ? 'YES' : 'NO');
