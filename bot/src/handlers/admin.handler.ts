import { Telegraf } from 'telegraf';
import {
  ADMIN_API_KEY,
  ADMIN_TELEGRAM_ID,
  API_URL,
} from '../config/config';
import { api } from '../api/api.client';

export function registerAdminHandler(
  bot: Telegraf,
) {
  bot.action('admin_panel', async (ctx) => {
    try {
      const telegramId =
        ctx.from.id.toString();

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

      const response = await api.get(
        '/users/admin/stats',
        {
          headers: {
            'x-admin-key': ADMIN_API_KEY,
          },
        },
      );

      const stats = response.data;
      const languages =
        stats.languages || {};

      await ctx.answerCbQuery();

      await ctx.reply(
        `🔐 ADMIN PANEL\n\n` +
          `👥 Jami foydalanuvchilar: ${
            stats.totalUsers
          }\n` +
          `📅 Bugun kirganlar: ${
            stats.todayUsers
          }\n\n` +
          `🌐 Tillar:\n` +
          `🇺🇿 O‘zbek: ${
            languages.uz_lat || 0
          }\n` +
          `🇺🇿 Кирилл: ${
            languages.uz_cyr || 0
          }\n` +
          `🇷🇺 Русский: ${
            languages.ru || 0
          }`,
      );
    } catch (error) {
      console.error(
        'Admin panel error:',
        error,
      );

      await ctx.answerCbQuery(
        '❌ Statistikani olishda xatolik.',
        { show_alert: true },
      );
    }
  });
}