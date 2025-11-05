# My Node App - Dialogflow Webhook

Webhook server cho Dialogflow tích hợp với Spring Boot API.

## 🚀 Deploy trên Vercel

**URL:** https://my-node-app-rouge.vercel.app/

### Endpoints có sẵn:

- **Root**: `/` - Health check
- **Webhook**: `/webhook` hoặc `/api/webhook` - Dialogflow webhook (POST)

### Cấu hình Dialogflow:

1. Mở Dialogflow Console
2. Vào **Fulfillment**
3. Bật **Webhook**
4. Nhập URL: `https://my-node-app-rouge.vercel.app/webhook`
5. Save

## 🛠️ Cài đặt local

```bash
npm install
npm start
```

Server sẽ chạy tại `http://localhost:3000`

## 📝 Environment Variables (Vercel)

Cần thêm biến môi trường trong Vercel Dashboard:

- `BACKEND_BASE_URL` - URL của Spring Boot API (ví dụ: `https://api.example.com`)

### Cách thêm:
1. Vào Vercel Dashboard
2. Chọn project **my-node-app**
3. Settings → Environment Variables
4. Thêm `BACKEND_BASE_URL` = URL API của bạn
5. Redeploy

## 📦 Cấu trúc project

```
my-node-app/
├── api/
│   ├── index.js      # Root endpoint
│   └── webhook.js    # Dialogflow webhook handler
├── vercel.json       # Vercel configuration
└── package.json
```

## 🧪 Test webhook

```bash
curl -X POST https://my-node-app-rouge.vercel.app/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "queryResult": {
      "intent": { "displayName": "tim_ve_xe" },
      "parameters": {
        "diemDi": "Hà Nội",
        "diemDen": "Hồ Chí Minh"
      }
    }
  }'
```
