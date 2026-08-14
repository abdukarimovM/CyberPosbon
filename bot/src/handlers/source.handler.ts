import { Markup, Telegraf } from 'telegraf';
import { getUserLanguage } from '../services/user.service';

export function registerSourceHandler(bot: Telegraf) {
  bot.action('check_source', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const language = await getUserLanguage(
        ctx.from.id.toString(),
      );

      if (language === 'ru') {
        await ctx.reply(
          '🔎 Отправьте ссылку или адрес источника, который хотите проверить:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '⬅️ Главное меню',
                'main_menu',
              ),
            ],
          ]),
        );

        return;
      }

      if (language === 'uz_cyr') {
        await ctx.reply(
          '🔎 Текширмоқчи бўлган манба ҳаволасини юборинг:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '⬅️ Асосий меню',
                'main_menu',
              ),
            ],
          ]),
        );

        return;
      }

      await ctx.reply(
        '🔎 Tekshirmoqchi bo‘lgan manba havolasini yuboring:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '⬅️ Asosiy menyu',
              'main_menu',
            ),
          ],
        ]),
      );
    } catch (error) {
      console.error(
        'Source handler error:',
        error,
      );
    }
  });
}