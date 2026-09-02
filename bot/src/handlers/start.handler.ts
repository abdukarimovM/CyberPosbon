import { Markup, Telegraf } from 'telegraf';
import { getUserLanguage } from '../services/user.service';
import { sendMainMenu } from './main-menu.handler';

export function registerStartHandler(bot: Telegraf) {
  bot.start(async (ctx) => {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId) return;

      // Foydalanuvchi avval tildan o'tganligini tekshiramiz
      const existingLanguage = await getUserLanguage(telegramId);

      // Agar til allaqachon tanlangan bo'lsa, to'g'ridan-to'g'ri asosiy menyuni ochamiz
      if (existingLanguage) {
        await sendMainMenu(ctx, existingLanguage);
        return;
      }

      // Yangi foydalanuvchiga til tanlash taklif etiladi
      await ctx.reply(
        '🛡 *CyberPosbon*\n\n' +
        'Iltimos, tilni tanlang:\n' +
        'Илтимос, тилни танланг:\n' +
        'Пожалуйста, выберите язык:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('🇺🇿 O‘zbek (lotin)', 'lang_uz_lat'),
            ],
            [
              Markup.button.callback('🇺🇿 Ўзбек (кирилл)', 'lang_uz_cyr'),
            ],
            [
              Markup.button.callback('🇷🇺 Русский', 'lang_ru'),
            ],
          ]),
        },
      );
    } catch (error) {
      console.error('❌ Start handler error:', error);
      await ctx.reply('Xatolik yuz berdi. Qayta urinib ko‘ring.');
    }
  });
}