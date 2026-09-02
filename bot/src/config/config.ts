import 'dotenv/config';

// Majburiy o'zgaruvchilar tekshiruvi
const rawBotToken = process.env.BOT_TOKEN;
if (!rawBotToken) {
  throw new Error('❌ BOT_TOKEN .env faylida topilmadi!');
}

// URL oxiridagi slash (/) belgisi bo'lsa olib tashlanadi
const rawApiUrl = process.env.API_URL || 'http://localhost:3000';
export const API_URL = rawApiUrl.replace(/\/+$/, '');

export const BOT_TOKEN: string = rawBotToken;
export const ADMIN_TELEGRAM_ID: string = process.env.ADMIN_TELEGRAM_ID || '';
export const ADMIN_API_KEY: string = process.env.ADMIN_API_KEY || '';

// Admin sozlamalari yo'qligi haqida console'da ogohlantirish (crash bermaydi)
if (!ADMIN_TELEGRAM_ID || !ADMIN_API_KEY) {
  console.warn('⚠️ ADMIN_TELEGRAM_ID yoki ADMIN_API_KEY .env faylida to‘liq ko‘rsatilmagan. Admin panel cheklangan bo‘lishi mumkin.');
}