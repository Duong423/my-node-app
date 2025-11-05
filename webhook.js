// File: /api/webhook.js
// Vercel tự động xử lý JSON body cho các route /api

const axios = require('axios'); // Thư viện để gọi API Spring của bạn

// Đây là hàm handler (trình xử lý) chính mà Vercel sẽ chạy
export default async function handler(req, res) {
    
    // 1. Chỉ cho phép phương thức POST (vì Dialogflow dùng POST)
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    // 2. Nhận thông tin Dialogflow (Vercel đã tự động parse req.body)
    const body = req.body;

    try {
        const intentName = body.queryResult.intent.displayName;
        const parameters = body.queryResult.parameters;

        console.log("Intent:", intentName);
        console.log("Parameters:", parameters);

        let responseText = "Xin lỗi, tôi chưa hiểu ý bạn."; // Câu trả lời mặc định

        // 3. Kiểm tra đúng Intent "tim_ve_xe"
        if (intentName === 'tim_ve_xe') {
            const diemDi = parameters.diemDi;
            const diemDen = parameters.diemDen;
            // Bạn có thể cần xử lý 'parameters.thoiGian' ở đây
            // ví dụ: const ngayDi = new Date(parameters.thoiGian).toISOString().split('T')[0];

            try {
                // 4. Gọi API Spring (Backend) của bạn
                // !!! THAY BẰNG URL API SPRING THẬT CỦA BẠN !!!
                const springApiUrl = `https://api-dat-ve-cua-ban.com/api/chuyenxe?diemDi=${diemDi}&diemDen=${diemDen}`;
                
                const apiResponse = await axios.get(springApiUrl);
                const danhSachChuyenXe = apiResponse.data;

                // 5. Tạo link và định dạng câu trả lời
                if (danhSachChuyenXe && danhSachChuyenXe.length > 0) {
                    responseText = `Tôi tìm thấy ${danhSachChuyenXe.length} chuyến xe phù hợp:\n`;
                    
                    danhSachChuyenXe.forEach((chuyen, index) => {
                        // !!! THAY BẰNG URL WEB THẬT CỦA BẠN !!!
                        const linkDatVe = `https://web-dat-ve-cua-ban.com/dat-ve?chuyenId=${chuyen.id}`;
                        responseText += `${index + 1}. Nhà xe ${chuyen.tenNhaXe} (Giá: ${chuyen.giaVe}đ)\nLink đặt vé: ${linkDatVe}\n\n`;
                    });
                } else {
                    responseText = `Rất tiếc, tôi không tìm thấy chuyến xe nào từ ${diemDi} đi ${diemDen}.`;
                }

            } catch (error) {
                console.error("Lỗi khi gọi API Spring:", error.message);
                responseText = "Hệ thống dữ liệu đang bận, vui lòng thử lại sau ít phút.";
            }
        }

        // 6. Trả lời lại cho Dialogflow
        res.status(200).json({
            fulfillmentText: responseText
        });

    } catch (error) {
        console.error("Lỗi chung trong webhook handler:", error.message);
        res.status(500).json({
            fulfillmentText: "Đã có lỗi xảy ra phía máy chủ webhook. Vui lòng thử lại."
        });
    }
}