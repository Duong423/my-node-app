// Test với object từ Dialogflow mới
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
    // Case 3: Array (backward compatibility)
    else if (Array.isArray(thoiGian)) {
        console.log('⚠️ Nhận array:', thoiGian);
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

console.log('\n🧪 Test 1: Object với date_time (Dialogflow mới)');
const test1 = formatDepartureDate({ date_time: '2025-11-24T07:00:00+07:00' });
console.log('Expected: 2025-11-24T07:00:00+07:00');
console.log('✅ PASS:', test1 === '2025-11-24T07:00:00+07:00' ? 'YES ✓✓✓' : 'NO ✗✗✗');

console.log('\n🧪 Test 2: String trực tiếp');
const test2 = formatDepartureDate('2025-11-24T07:00:00+07:00');
console.log('Expected: 2025-11-24T07:00:00+07:00');
console.log('✅ PASS:', test2 === '2025-11-24T07:00:00+07:00' ? 'YES ✓✓✓' : 'NO ✗✗✗');

console.log('\n🧪 Test 3: String với space');
const test3 = formatDepartureDate('2025-11-24 07:00:00');
console.log('Expected: 2025-11-24T07:00:00+07:00');
console.log('✅ PASS:', test3 === '2025-11-24T07:00:00+07:00' ? 'YES ✓✓✓' : 'NO ✗✗✗');

console.log('\n🧪 Test 4: Array (backward compatibility)');
const test4 = formatDepartureDate([
    '2025-11-07T23:00:00+07:00',
    '2025-11-08T00:00:00+07:00',
    '2025-11-08T07:00:00+07:00'
]);
console.log('Expected: 2025-11-08T07:00:00+07:00 (pick 07:00)');
console.log('✅ PASS:', test4 === '2025-11-08T07:00:00+07:00' ? 'YES ✓✓✓' : 'NO ✗✗✗');
