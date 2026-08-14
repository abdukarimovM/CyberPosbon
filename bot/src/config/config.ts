import 'dotenv/config';

export const BOT_TOKEN = process.env.BOT_TOKEN;
export const API_URL =
  process.env.API_URL || 'http://localhost:3000';

export const ADMIN_TELEGRAM_ID =
  process.env.ADMIN_TELEGRAM_ID;

export const ADMIN_API_KEY =
  process.env.ADMIN_API_KEY;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN .env faylida topilmadi');
}