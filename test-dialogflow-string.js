// Test formatDepartureDate với STRING DUY NHẤT từ Dialogflow

function formatDepartureDate(thoiGian) {
    if (!thoiGian) return null;

    console.log('📅 Input từ Dialogflow:', thoiGian);

    let dateStr = null;

    if (typeof thoiGian === 'string') {
        const trimmed = thoiGian.trim().replace(/\.000000$/, '');
        
        // Case 1: Đã có format ISO với timezone (2025-11-24T07:00:00+07:00)
        if (trimmed.includes('T') && trimmed.includes(':')) {
            dateStr = trimmed;
            // Thêm timezone nếu chưa có
            if (!dateStr.includes('+') && !dateStr.includes('Z')) {
                dateStr = dateStr + '+07:00';
            }
        }
        // Case 2: Format "YYYY-MM-DD HH:mm:ss" (2025-11-24 07:00:00)
        else if (trimmed.includes(' ') && trimmed.includes(':')) {
            const [date, time] = trimmed.split(' ');
            const timePart = time.split(':').slice(0, 3).join(':');
            dateStr = `${date}T${timePart}+07:00`;
        }
        // Case 3: Chỉ có ngày "YYYY-MM-DD" (2025-11-24)
        else {
            dateStr = trimmed + 'T00:00:00+07:00';
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

console.log('\n=== TEST DIALOGFLOW STRING FORMATS ===\n');

console.log('🧪 Test 1: ISO format có timezone (từ Dialogflow)');
const test1 = formatDepartureDate('2025-11-24T07:00:00+07:00');
console.log('Expected: 2025-11-24T07:00:00+07:00');
console.log('✅ PASS:', test1 === '2025-11-24T07:00:00+07:00' ? 'YES ✓' : 'NO ✗');

console.log('\n🧪 Test 2: ISO format KHÔNG có timezone');
const test2 = formatDepartureDate('2025-11-24T07:00:00');
console.log('Expected: 2025-11-24T07:00:00+07:00');
console.log('✅ PASS:', test2 === '2025-11-24T07:00:00+07:00' ? 'YES ✓' : 'NO ✗');

console.log('\n🧪 Test 3: Format có space (2025-11-24 07:00:00)');
const test3 = formatDepartureDate('2025-11-24 07:00:00');
console.log('Expected: 2025-11-24T07:00:00+07:00');
console.log('✅ PASS:', test3 === '2025-11-24T07:00:00+07:00' ? 'YES ✓' : 'NO ✗');

console.log('\n🧪 Test 4: Format có space + microseconds');
const test4 = formatDepartureDate('2025-11-24 07:00:00.000000');
console.log('Expected: 2025-11-24T07:00:00+07:00');
console.log('✅ PASS:', test4 === '2025-11-24T07:00:00+07:00' ? 'YES ✓' : 'NO ✗');

console.log('\n🧪 Test 5: Chỉ có ngày');
const test5 = formatDepartureDate('2025-11-24');
console.log('Expected: 2025-11-24T00:00:00+07:00');
console.log('✅ PASS:', test5 === '2025-11-24T00:00:00+07:00' ? 'YES ✓' : 'NO ✗');

console.log('\n🧪 Test 6: Giờ chiều (14:30)');
const test6 = formatDepartureDate('2025-11-24 14:30:00');
console.log('Expected: 2025-11-24T14:30:00+07:00');
console.log('✅ PASS:', test6 === '2025-11-24T14:30:00+07:00' ? 'YES ✓' : 'NO ✗');

console.log('\n🧪 Test 7: Giờ sáng sớm (05:15)');
const test7 = formatDepartureDate('2025-12-01 05:15:30');
console.log('Expected: 2025-12-01T05:15:30+07:00');
console.log('✅ PASS:', test7 === '2025-12-01T05:15:30+07:00' ? 'YES ✓' : 'NO ✗');

console.log('\n==========================================');
const allPassed = [test1, test2, test3, test4, test5, test6, test7].every((t, i) => {
    const expected = [
        '2025-11-24T07:00:00+07:00',
        '2025-11-24T07:00:00+07:00',
        '2025-11-24T07:00:00+07:00',
        '2025-11-24T07:00:00+07:00',
        '2025-11-24T00:00:00+07:00',
        '2025-11-24T14:30:00+07:00',
        '2025-12-01T05:15:30+07:00'
    ];
    return t === expected[i];
});

console.log(allPassed ? '\n✅ TẤT CẢ TEST PASS! 🎉' : '\n❌ CÓ TEST FAILED!');
