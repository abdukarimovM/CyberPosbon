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

  // 1. Asosiy Admin menyusini ko'rsatish va statistikani yangilash
  bot.action(['admin_panel', 'refresh_admin_stats'], async (ctx) => {
    const telegramId = ctx.from?.id.toString();

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

    try {
      await ctx.answerCbQuery('Yuklanmoqda...');
    } catch (e) {
      console.log('ℹ️ Callback eskirdi:', e instanceof Error ? e.message : e);
    }

    try {
      const response = await api.get('/users/admin/stats', {
        headers: {
          'x-admin-key': ADMIN_API_KEY,
        },
      });

      const messageText = formatStatsMessage(response.data);

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚨 Yangi shikoyatlarni tekshirish', 'admin_view_reports')],
        [Markup.button.callback('🗄 Maʼlumotlar bazasi (Eksport)', 'admin_db_export')],
        [Markup.button.callback('🔄 Yangilash', 'refresh_admin_stats')],
        [Markup.button.callback('⬅️ Asosiy menyu', 'main_menu')],
      ]);

      if (ctx.callbackQuery && 'data' in ctx.callbackQuery && ctx.callbackQuery.data === 'refresh_admin_stats') {
        try {
          await ctx.editMessageText(messageText, {
            parse_mode: 'Markdown',
            ...keyboard,
          });
        } catch (err: any) {
          if (err?.description?.includes('message is not modified')) {
            await ctx.answerCbQuery('ℹ️ Yangi maʼlumot yo‘q, statistika dolzarb.');
            return;
          }
          throw err;
        }
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

  // 2. /admin buyrug'i
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
          [Markup.button.callback('🚨 Yangi shikoyatlarni tekshirish', 'admin_view_reports')],
          [Markup.button.callback('🗄 Maʼlumotlar bazasi (Eksport)', 'admin_db_export')],
          [Markup.button.callback('🔄 Yangilash', 'refresh_admin_stats')],
          [Markup.button.callback('⬅️ Asosiy menyu', 'main_menu')],
        ]),
      });
    } catch (error) {
      console.error('❌ Admin command error:', error);
      await ctx.reply('❌ Statistikani olishda xatolik yuz berdi.');
    }
  });

  // 3. Yangi shikoyatlarni ko'rish
  bot.action('admin_view_reports', async (ctx) => {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId || !isAdmin(telegramId)) {
      return ctx.answerCbQuery('❌ Ruxsat yo‘q.', { show_alert: true });
    }

    try {
      await ctx.answerCbQuery('Shikoyatlar yuklanmoqda...');
      const response = await api.get('/phone/admin/reports?limit=5');
      const reports = response.data;

      if (!reports || reports.length === 0) {
        return ctx.reply('✅ Hozircha yangi shikoyatlar mavjud emas.', {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Admin panelga qaytish', 'admin_panel')],
          ]),
        });
      }

      for (const item of reports) {
        const phone = item.fraudNumber?.phoneNumber || item.phoneNumber || 'Nomaʼlum';
        const reportsCount = item.fraudNumber?.reportsCount ?? 1;
        const isVerified = item.fraudNumber?.isVerified ? '🔴 Tasdiqlangan firibgar' : '🟡 Kutilmoqda';
        const comment = item.comment ? item.comment : 'Izoh qoldirilmagan';

        const reportCard =
          `📌 <b>Shikoyat hujjati</b>\n\n` +
          `📞 <b>Raqam:</b> <code>${phone}</code>\n` +
          `🏷 <b>Toifa:</b> ${item.category}\n` +
          `📝 <b>Foydalanuvchi izohi:</b> <i>${comment}</i>\n` +
          `📊 <b>Jami shikoyatlar:</b> ${reportsCount} ta\n` +
          `🛡 <b>Holati:</b> ${isVerified}`;

        const actionsKeyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('🚨 Tasdiqlash (Qora ro‘yxat)', `adm_v_${phone}`),
            Markup.button.callback('🗑 Rad etish', `adm_d_${item.id}`),
          ],
        ]);

        await ctx.reply(reportCard, {
          parse_mode: 'HTML',
          ...actionsKeyboard,
        });
      }

    } catch (error: any) {
      console.error('❌ Admin view reports error:', error);
      await ctx.reply('❌ Shikoyatlarni yuklashda xatolik yuz berdi.');
    }
  });

  // 4. Raqamni rasman tasdiqlash (100 ball bilan qora ro'yxatga olish)
  bot.action(/^adm_v_(.+)$/, async (ctx) => {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId || !isAdmin(telegramId)) {
      return ctx.answerCbQuery('❌ Ruxsat yo‘q.', { show_alert: true });
    }

    const phone = ctx.match[1];
    try {
      await ctx.answerCbQuery('Tasdiqlanmoqda...');
      await api.patch('/phone/admin/verify', { phoneNumber: phone });

      await ctx.editMessageText(
        `✅ <b>Raqam rasman firibgar deb topildi!</b>\n\n` +
        `📞 Raqam: <code>${phone}</code>\n` +
        `🎯 Xavf bali: <b>100/100 (Bloklangan)</b>`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('❌ Verify error:', error);
      await ctx.reply('❌ Raqamni tasdiqlashda xatolik yuz berdi.');
    }
  });

  // 5. Asossiz/soxta shikoyatni o'chirib tashlash
  bot.action(/^adm_d_(.+)$/, async (ctx) => {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId || !isAdmin(telegramId)) {
      return ctx.answerCbQuery('❌ Ruxsat yo‘q.', { show_alert: true });
    }

    const reportId = ctx.match[1];
    try {
      await ctx.answerCbQuery('O‘chirilmoqda...');
      await api.delete(`/phone/admin/report/${reportId}`);

      await ctx.editMessageText(
        `🗑 <b>Shikoyat bekor qilindi!</b>\n\nAsossiz deb topilgan shikoyat o‘chirildi va hisob qayta hisoblandi.`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('❌ Dismiss report error:', error);
      await ctx.reply('❌ Shikoyatni o‘chirishda xatolik yuz berdi.');
    }
  });

  // 6. Ma'lumotlar bazasi eksport menyusi
  bot.action('admin_db_export', async (ctx) => {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId || !isAdmin(telegramId)) {
      return ctx.answerCbQuery('❌ Ruxsat yo‘q.', { show_alert: true });
    }

    try {
      await ctx.answerCbQuery();
      const text =
        `🗄 <b>KIBERXAVFSIZLIK REESTRI VA HISOBOTLAR</b>\n\n` +
        `Ushbu bo‘lim orqali tasdiqlangan firibgar raqamlar va xavfli saytlar bazasini ` +
        `jadval yoki hujjat ko‘rinishida yuklab olishingiz mumkin.\n\n` +
        `Qaysi formatda saqlamoqchisiz?`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 Excel (.xlsx)', 'exp_excel'),
          Markup.button.callback('📄 Word (.docx)', 'exp_word'),
        ],
        [Markup.button.callback('⬅️ Admin panelga qaytish', 'admin_panel')],
      ]);

      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          ...keyboard,
        });
      } else {
        await ctx.reply(text, {
          parse_mode: 'HTML',
          ...keyboard,
        });
      }
    } catch (error) {
      console.error('❌ Admin db export menu error:', error);
      await ctx.reply('❌ Menyu ochishda xatolik yuz berdi.');
    }
  });

  // 7. Excel (.xlsx) formatida yuklab olish
  bot.action('exp_excel', async (ctx) => {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId || !isAdmin(telegramId)) {
      return ctx.answerCbQuery('❌ Ruxsat yo‘q.', { show_alert: true });
    }

    try {
      await ctx.answerCbQuery('Excel fayl shakllantirilmoqda...');

      const response = await api.get('/phone/admin/export/excel', {
        responseType: 'arraybuffer',
      });

      const today = new Date().toISOString().slice(0, 10);
      await ctx.replyWithDocument(
        {
          source: Buffer.from(response.data),
          filename: `CyberPosbon_Baza_${today}.xlsx`,
        },
        {
          caption: '📊 <b>CyberPosbon:</b> Tasdiqlangan tahdidlar va firibgar raqamlar reestri (Excel).',
          parse_mode: 'HTML',
        }
      );
    } catch (error) {
      console.error('❌ Excel export error:', error);
      await ctx.reply('❌ Excel hisobotni shakllantirishda xatolik yuz berdi.');
    }
  });

  // 8. Word (.docx) formatida yuklab olish
  bot.action('exp_word', async (ctx) => {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId || !isAdmin(telegramId)) {
      return ctx.answerCbQuery('❌ Ruxsat yo‘q.', { show_alert: true });
    }

    try {
      await ctx.answerCbQuery('Word hisobot tayyorlanmoqda...');

      const response = await api.get('/phone/admin/export/word', {
        responseType: 'arraybuffer',
      });

      const today = new Date().toISOString().slice(0, 10);
      await ctx.replyWithDocument(
        {
          source: Buffer.from(response.data),
          filename: `CyberPosbon_Hisobot_${today}.docx`,
        },
        {
          caption: '📄 <b>CyberPosbon:</b> Rasmiy kiberxavfsizlik tahdidlari hisoboti (Word).',
          parse_mode: 'HTML',
        }
      );
    } catch (error) {
      console.error('❌ Word export error:', error);
      await ctx.reply('❌ Word hujjatni shakllantirishda xatolik yuz berdi.');
    }
  });
}