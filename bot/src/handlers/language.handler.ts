import { Markup, Telegraf } from 'telegraf';
import { registerUser } from '../services/user.service';
import { sendMainMenu } from './main-menu.handler';

export function registerLanguageHandler(bot: Telegraf) {
  bot.action(
    ['lang_uz_lat', 'lang_uz_cyr', 'lang_ru'],
    async (ctx) => {
      try {
        const telegramUser = ctx.from;
        const telegramId = telegramUser.id.toString();

        const callbackData =
          'data' in ctx.callbackQuery
            ? ctx.callbackQuery.data
            : '';

        let language = 'uz_lat';

        if (callbackData === 'lang_uz_cyr') {
          language = 'uz_cyr';
        }

        if (callbackData === 'lang_ru') {
          language = 'ru';
        }

        const username = telegramUser.username
          ? `@${telegramUser.username}`
          : undefined;

        const displayName =
          [
            telegramUser.first_name,
            telegramUser.last_name,
          ]
            .filter(Boolean)
            .join(' ') || undefined;

        await registerUser({
          telegramId,
          username,
          displayName,
          language,
        });

        await ctx.answerCbQuery();

        await sendMainMenu(ctx, language);
      } catch (error) {
        console.error(
          'Language selection error:',
          error,
        );

        await ctx.answerCbQuery(
          '❌ Xatolik yuz berdi',
          { show_alert: true },
        );
      }
    },
  );
}