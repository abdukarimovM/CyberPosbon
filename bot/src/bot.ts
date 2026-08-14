import { registerStartHandler } from './handlers/start.handler';
import { registerLanguageHandler } from './handlers/language.handler';
import { sendMainMenu } from './handlers/main-menu.handler';
import { registerSettingsHandler } from './handlers/settings.handler';
import { registerProfileHandler } from './handlers/profile.handler';

import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.API_URL || 'http://localhost:3000';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN .env faylida topilmadi');
}

const bot = new Telegraf(BOT_TOKEN);

registerStartHandler(bot);
registerLanguageHandler(bot);
registerSettingsHandler(bot);
registerProfileHandler(bot);

async function getUserLanguage(
  telegramId: string,
): Promise<string> {
  try {
    const response = await axios.get(
      `${API_URL}/users/${telegramId}`,
    );

    return response.data?.user?.language || 'uz_lat';
  } catch (error) {
    console.error(
      'Get user language error:',
      error,
    );

    return 'uz_lat';
  }
}

// ====================
// ADMIN PANEL
// ====================

bot.action('admin_panel', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();

    if (
      !ADMIN_TELEGRAM_ID ||
      telegramId !== ADMIN_TELEGRAM_ID
    ) {
      await ctx.answerCbQuery(
        '❌ Sizda admin huquqi yo‘q.',
        { show_alert: true },
      );

      return;
    }

    if (!ADMIN_API_KEY) {
      await ctx.answerCbQuery(
        '❌ ADMIN_API_KEY topilmadi.',
        { show_alert: true },
      );

      return;
    }

    const response = await axios.get(
      `${API_URL}/users/admin/stats`,
      {
        headers: {
          'x-admin-key': ADMIN_API_KEY,
        },
      },
    );

    const stats = response.data;

    const languages = stats.languages || {};

    await ctx.answerCbQuery();

    await ctx.reply(
      `🔐 ADMIN PANEL\n\n` +
        `👥 Jami foydalanuvchilar: ${stats.totalUsers}\n` +
        `📅 Bugun kirganlar: ${stats.todayUsers}\n\n` +
        `🌐 Tillar:\n` +
        `🇺🇿 O‘zbek: ${languages.uz_lat || 0}\n` +
        `🇺🇿 Кирилл: ${languages.uz_cyr || 0}\n` +
        `🇷🇺 Русский: ${languages.ru || 0}`,
    );
  } catch (error) {
    console.error('Admin panel error:', error);

    await ctx.answerCbQuery(
      '❌ Statistikani olishda xatolik.',
      { show_alert: true },
    );
  }
});

// ====================
// HOZIRCHA BO‘SH FUNKSIYALAR
// ====================
bot.action(
  [
    'check_source',
    'check_phone',
    'check_url',
    'database',
  ],
  async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      '🚧 Ushbu funksiya ishlab chiqilmoqda.\n\n' +
        'Tez orada ishga tushiriladi.',
    );
  },
);

// ====================
// BOTNI ISHGA TUSHIRISH
// ====================

bot.launch();

console.log(
  '🤖 CyberPosbon bot ishga tushdi...',
);

process.once('SIGINT', () =>
  bot.stop('SIGINT'),
);

process.once('SIGTERM', () =>
  bot.stop('SIGTERM'),
);