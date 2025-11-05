module.exports = async function handler(req, res) {
    res.status(200).json({
        status: 'OK',
        message: 'Webhook server đang hoạt động',
        endpoints: {
            webhook: '/webhook hoặc /api/webhook',
            method: 'POST',
            description: 'Endpoint cho Dialogflow webhook'
        },
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || 'development'
    });
}
