import { Telegraf } from 'telegraf';
import { registerUser } from '../services/user.service';
import { sendMainMenu } from './main-menu.handler';

// Callback data -> Til kodi mappingi
const LANGUAGE_MAP: Record<string, string> = {
  lang_uz_lat: 'uz_lat',
  lang_uz_cyr: 'uz_cyr',
  lang_ru: 'ru',
};

// Muvaffaqiyatli tanlov xabarlari (Toast ko'rinishida)
const SUCCESS_FEEDBACK: Record<string, string> = {
  uz_lat: "✅ Til tanlandi: O'zbekcha",
  uz_cyr: '✅ Тил танланди: Ўзбекча',
  ru: '✅ Язык выбран: Русский',
};

export function registerLanguageHandler(bot: Telegraf) {
  bot.action(['lang_uz_lat', 'lang_uz_cyr', 'lang_ru'], async (ctx) => {
    try {
      const telegramUser = ctx.from;
      if (!telegramUser) {
        return;
      }

      const telegramId = telegramUser.id.toString();
      const callbackData = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
      const language = LANGUAGE_MAP[callbackData] || 'uz_lat';

      // 1. Telegram spinnerni darhol yopish va tanlangan tilni bildirish
      try {
        await ctx.answerCbQuery(SUCCESS_FEEDBACK[language]);
      } catch (e) {
        console.log('ℹ️ Callback eskirgan:', e instanceof Error ? e.message : e);
      }

      const username = telegramUser.username ? `@${telegramUser.username}` : undefined;
      const displayName =
        [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || undefined;

      // 2. Foydalanuvchini bazada saqlash / yangilash
      await registerUser({
        telegramId,
        username,
        displayName,
        language,
      });

      // 3. Til tanlash tugmalari tepadagi xabarda qolib ketmasligi uchun uni tozalash
      try {
        await ctx.deleteMessage();
      } catch (deleteError) {
        // Agar xabarni o'chirish imkoni bo'lmasa (masalan, 48 soatdan oshgan bo'lsa), e'tiborsiz qoldiramiz
        console.log('ℹ️ Eski xabarni o‘chirish imkoni bo‘lmadi:', deleteError);
      }

      // 4. Asosiy menyuni yuborish
      await sendMainMenu(ctx, language);

    } catch (error) {
      console.error('❌ Language selection error:', error);

      try {
        await ctx.answerCbQuery('❌ Xatolik yuz berdi. Qayta urinib ko‘ring.', {
          show_alert: true,
        });
      } catch (cbError) {
        console.error('Callback alert error:', cbError);
      }
    }
  });
}