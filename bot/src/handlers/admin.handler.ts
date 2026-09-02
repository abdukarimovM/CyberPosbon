import { Markup, Telegraf } from 'telegraf';
import {
  ADMIN_API_KEY,
  ADMIN_TELEGRAM_ID,
} from '../config/config';
import { api } from '../api/api.client';

// =========================================================
// 🔧 ADMIN HUQUQINI TEKSHIRISH
// =========================================================

function isAdmin(telegramId: string): boolean {
  if (!ADMIN_TELEGRAM_ID) return false;

  // Agar vergul bilan bir nechta ID berilgan bo'lsa ham tekshiradi: "1234,5678"
  const adminIds = ADMIN_TELEGRAM_ID.split(',').map((id) => id.trim());
  return adminIds.includes(telegramId);
}

// =========================================================
// 📊 STATISTIKANI FORMATLASH
// =========================================================

function formatStatsMessage(stats: any): string {
  const languages = stats.languages || {};

  return (
    `🔐 *ADMIN BOSHQARUV PANELI*\n\n` +
    `👥 *Jami foydalanuvchilar:* ${stats.totalUsers ?? 0}\n` +
    `📅 *Bugun faol bo‘lganlar:* ${stats.todayUsers ?? 0}\n\n` +
    `🌐 *Foydalanuvchilar tillari bo‘yicha:*\n` +
    `🇺🇿 O‘zbek (Lotin): ${languages.uz_lat ?? languages.uz ?? 0}\n` +
    `🇺🇿 Ўзбек (Кирилл): ${languages.uz_cyr ?? 0}\n` +
    `🇷🇺 Русский: ${languages.ru ?? 0}`
  );
}

// =========================================================
// 📱 ADMIN HANDLER
// =========================================================

export function registerAdminHandler(bot: Telegraf) {

  // Callback action orqali ochish
  bot.action(['admin_panel', 'refresh_admin_stats'], async (ctx) => {
    const telegramId = ctx.from?.id.toString();

    // 1. Admin tekshiruvi
    if (!telegramId || !isAdmin(telegramId)) {
      try {
        await ctx.answerCbQuery('❌ Sizda admin huquqi yo‘q.', { show_alert: true });
      } catch (e) {
        console.error('Callback error:', e);
      }
      return;
    }

    if (!ADMIN_API_KEY) {
      try {
        await ctx.answerCbQuery('❌ ADMIN_API_KEY topilmadi.', { show_alert: true });
      } catch (e) {
        console.error('Callback error:', e);
      }
      return;
    }

    // 2. Telegram spinner loadingni darhol o'chirish (timeout oldini oladi)
    try {
      await ctx.answerCbQuery('Yuklanmoqda...');
    } catch (e) {
      console.log('ℹ️ Callback eskirdi:', e instanceof Error ? e.message : e);
    }

    try {
      // 3. Backenddan statistika olish
      const response = await api.get('/users/admin/stats', {
        headers: {
          'x-admin-key': ADMIN_API_KEY,
        },
      });

      const messageText = formatStatsMessage(response.data);

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Yangilash', 'refresh_admin_stats')],
        [Markup.button.callback('⬅️ Asosiy menyu', 'main_menu')],
      ]);

      // Agar yangilash tugmasi bosilgan bo'lsa, xabarni tahrirlaymiz
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery && ctx.callbackQuery.data === 'refresh_admin_stats') {
        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
        return;
      }

      await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });

    } catch (error) {
      console.error('❌ Admin panel error:', error);
      await ctx.reply('❌ Statistikani olishda server bilan bog‘liq xatolik yuz berdi.');
    }
  });

  // /admin buyrug'i orqali ham to'g'ridan-to'g'ri ochish imkoniyati
  bot.command('admin', async (ctx) => {
    const telegramId = ctx.from?.id.toString();

    if (!telegramId || !isAdmin(telegramId)) {
      return;
    }

    try {
      const response = await api.get('/users/admin/stats', {
        headers: {
          'x-admin-key': ADMIN_API_KEY,
        },
      });

      const messageText = formatStatsMessage(response.data);

      await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Yangilash', 'refresh_admin_stats')],
          [Markup.button.callback('⬅️ Asosiy menyu', 'main_menu')],
        ]),
      });
    } catch (error) {
      console.error('❌ Admin command error:', error);
      await ctx.reply('❌ Statistikani olishda xatolik yuz berdi.');
    }
  });
}