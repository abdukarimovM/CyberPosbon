import { registerStartHandler } from './handlers/start.handler';
import { registerLanguageHandler } from './handlers/language.handler';
import { sendMainMenu } from './handlers/main-menu.handler';
import { registerSettingsHandler } from './handlers/settings.handler';
import { registerProfileHandler } from './handlers/profile.handler';
import { registerAdminHandler } from './handlers/admin.handler';
import { registerSourceHandler } from './handlers/source.handler';

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
registerAdminHandler(bot);
registerSourceHandler(bot);

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