export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  meta: {
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN,
    verifyToken: process.env.META_VERIFY_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    graphApiUrl: 'https://graph.facebook.com/v19.0',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    maxTokens: 1024,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  panel: {
    url: process.env.PANEL_URL,
    username: process.env.PANEL_USERNAME,
    password: process.env.PANEL_PASSWORD,
    loginKey: process.env.PANEL_LOGIN_KEY,
  },

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/web-app-connect',
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    adminEmail: process.env.ADMIN_EMAIL,
    fromEmail: process.env.FROM_EMAIL || 'soporte@connect-world.it.com',
  },

  // Si está definido, el bot solo responde a este Facebook User ID (modo prueba)
  testUserId: process.env.TEST_USER_ID || undefined,
});
