import { Markup, Telegraf } from 'telegraf';
import { getUserLanguage } from '../services/user.service';
import { sendMainMenu } from './main-menu.handler';

export function registerSettingsHandler(bot: Telegraf) {
  // ⚙️ SOZLAMALAR
  bot.action('settings', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id.toString();
      const language = await getUserLanguage(telegramId);

      if (language === 'ru') {
        await ctx.reply(
          '⚙️ Настройки\n\n' +
            'Выберите нужный раздел:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '🌐 Изменить язык',
                'change_language',
              ),
            ],
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
          '⚙️ Созламалар\n\n' +
            'Керакли бўлимни танланг:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '🌐 Тилни ўзгартириш',
                'change_language',
              ),
            ],
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
        '⚙️ Sozlamalar\n\n' +
          'Kerakli bo‘limni tanlang:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🌐 Tilni o‘zgartirish',
              'change_language',
            ),
          ],
          [
            Markup.button.callback(
              '⬅️ Asosiy menyu',
              'main_menu',
            ),
          ],
        ]),
      );
    } catch (error) {
      console.error('Settings error:', error);
    }
  });

  // 🌐 TILNI O‘ZGARTIRISH
  bot.action('change_language', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      await ctx.reply(
        '🌐 Tilni tanlang:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🇺🇿 O‘zbek (lotin)',
              'lang_uz_lat',
            ),
          ],
          [
            Markup.button.callback(
              '🇺🇿 Ўзбек (кирилл)',
              'lang_uz_cyr',
            ),
          ],
          [
            Markup.button.callback(
              '🇷🇺 Русский',
              'lang_ru',
            ),
          ],
        ]),
      );
    } catch (error) {
      console.error(
        'Change language error:',
        error,
      );
    }
  });

  // ⬅️ ASOSIY MENYU
  bot.action('main_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id.toString();
      const language =
        await getUserLanguage(telegramId);

      await sendMainMenu(ctx, language);
    } catch (error) {
      console.error(
        'Main menu error:',
        error,
      );
    }
  });
}