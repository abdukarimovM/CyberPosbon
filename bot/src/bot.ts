import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { BOT_TOKEN } from './config/config';

// Handlerlar importi
import { registerStartHandler } from './handlers/start.handler';
import { registerLanguageHandler } from './handlers/language.handler';
import { registerMainMenuHandler } from './handlers/main-menu.handler';
import { registerSettingsHandler } from './handlers/settings.handler';
import { registerProfileHandler } from './handlers/profile.handler';
import { registerAdminHandler } from './handlers/admin.handler';
import { registerSourceHandler } from './handlers/source.handler';
import { registerFileHandler } from './handlers/file.handler';
import { registerAiHandler } from './handlers/ai.handler';

// Servislar
import { getUserLanguage } from './services/user.service';

if (!BOT_TOKEN) {
  throw new Error('❌ BOT_TOKEN konfiguratsiyada yoki .env faylida topilmadi!');
}

const bot = new Telegraf(BOT_TOKEN);

// =========================================================
// 🛡 GLOBAL XATOLIKLARNI USHLASH (CRASH OLDINI OLISH)
// =========================================================
bot.catch((err: any, ctx) => {
  console.error(`❌ Bot xatoligi yuz berdi (${ctx.updateType}):`, err?.message || err);
});

// =========================================================
// 📱 HANDLERLARNI RO‘YXATDAN O‘TKAZISH
// =========================================================

registerStartHandler(bot);
registerLanguageHandler(bot);
registerMainMenuHandler(bot, getUserLanguage);
registerSettingsHandler(bot);
registerProfileHandler(bot);
registerAdminHandler(bot);
registerSourceHandler(bot);
registerFileHandler(bot);
registerAiHandler(bot);

// =========================================================
// ⏳ HALI ISHLAB CHIQILAYOTGAN BO'LIMLAR (PLACEHOLDER)
// =========================================================

bot.action(['check_phone', 'database', 'about'], async (ctx) => {
  try {
    const action = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
    const telegramId = ctx.from?.id.toString();
    const lang = telegramId ? await getUserLanguage(telegramId) : 'uz_lat';

    if (action === 'about') {
      const aboutText = {
        uz_lat: 'ℹ️ *CyberPosbon Bot*\n\nUshbu bot shubhali fayllar (APK, EXE) va xavfli havolalarni (fishing) tahlil qilish uchun xizmat qiladi.',
        uz_cyr: 'ℹ️ *CyberPosbon Bot*\n\nУшбу бот шубҳали файллар (APK, EXE) ва хавфли ҳаволаларни (фишинг) таҳлил қилиш учун хизмат қилади.',
        ru: 'ℹ️ *CyberPosbon Bot*\n\nЭтот бот предназначен для анализа подозрительных файлов (APK, EXE) и фишинговых ссылок.',
      };
      await ctx.answerCbQuery();
      await ctx.reply(aboutText[lang as keyof typeof aboutText] || aboutText.uz_lat, { parse_mode: 'Markdown' });
      return;
    }

    const comingSoonText = {
      uz_lat: '⏳ Ushbu xizmat tez kunda ishga tushiriladi.',
      uz_cyr: '⏳ Ушбу хизмат тез кунда ишга туширилади.',
      ru: '⏳ Этот сервис скоро будет доступен.',
    };

    await ctx.answerCbQuery(comingSoonText[lang as keyof typeof comingSoonText] || comingSoonText.uz_lat, {
      show_alert: true,
    });
  } catch (error) {
    console.error('Placeholder action error:', error);
  }
});

// =========================================================
// 🚀 BOTNI ISHGA TUSHIRISH
// =========================================================

bot
  .launch()
  .then(() => {
    console.log('🤖 CyberPosbon bot muvaffaqiyatli ishga tushdi...');
  })
  .catch((err) => {
    console.error('❌ Botni ishga tushirishda xatolik:', err);
  });

// To'xtatish signallari (Graceful Shutdown)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));