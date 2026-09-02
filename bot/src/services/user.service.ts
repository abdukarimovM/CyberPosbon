import { api } from '../api/api.client';

export interface BotUser {
  id?: string;
  telegramId: string;
  username?: string;
  displayName?: string;
  phoneNumber?: string;
  language: 'uz_lat' | 'uz_cyr' | 'ru';
  createdAt?: string;
}

// Qisqa muddatli xotira keshi (Backendni yuklamaslik uchun)
const languageCache = new Map<string, { lang: string; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 daqiqa

// =========================================================
// 🌐 FOYDALANUVCHI TILINI OLISH
// =========================================================

export async function getUserLanguage(telegramId: string): Promise<string> {
  const now = Date.now();
  const cached = languageCache.get(telegramId);

  if (cached && cached.expiresAt > now) {
    return cached.lang;
  }

  try {
    const response = await api.get(`/users/${telegramId}`);
    const lang = response.data?.user?.language || 'uz_lat';

    languageCache.set(telegramId, {
      lang,
      expiresAt: now + CACHE_TTL_MS,
    });

    return lang;
  } catch (error) {
    console.error(`⚠️ Get user language error (${telegramId}):`, error);
    return 'uz_lat';
  }
}

// =========================================================
// 📝 FOYDALANUVCHINI RO‘YXATDAN O‘TKAZISH / YANGILASH
// =========================================================

export async function registerUser(data: {
  telegramId: string;
  username?: string;
  displayName?: string;
  language: string;
}): Promise<BotUser | null> {
  try {
    const response = await api.post('/users/register', data);

    // Keshni yangilaymiz
    languageCache.set(data.telegramId, {
      lang: data.language,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return response.data?.user ?? null;
  } catch (error) {
    console.error('❌ Register user error:', error);
    throw error;
  }
}

// =========================================================
// 👤 FOYDALANUVCHI MA'LUMOTLARINI OLISH
// =========================================================

export async function getUser(telegramId: string): Promise<BotUser | null> {
  try {
    const response = await api.get(`/users/${telegramId}`);
    const user = response.data?.user ?? null;

    if (user?.language) {
      languageCache.set(telegramId, {
        lang: user.language,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }

    return user;
  } catch (error) {
    console.error(`❌ Get user error (${telegramId}):`, error);
    return null;
  }
}

// =========================================================
// 📱 TELEFON RAQAMNI SAQLASH
// =========================================================

export async function savePhone(
  telegramId: string,
  phoneNumber: string,
): Promise<boolean> {
  try {
    await api.patch(`/users/${telegramId}/phone`, {
      phoneNumber,
    });
    return true;
  } catch (error) {
    console.error(`❌ Save phone error (${telegramId}):`, error);
    throw error;
  }
}