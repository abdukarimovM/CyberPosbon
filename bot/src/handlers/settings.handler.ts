import { Markup, Telegraf } from 'telegraf';
import { getUserLanguage } from '../services/user.service';

type SupportedLang = 'uz_lat' | 'uz_cyr' | 'ru';

function resolveLang(rawLang?: string): SupportedLang {
  if (rawLang === 'ru') return 'ru';
  if (rawLang === 'uz_cyr') return 'uz_cyr';
  return 'uz_lat';
}

const SETTINGS_I18N = {
  title: {
    uz_lat: '⚙️ *Sozlamalar*\n\nKerakli bo‘limni tanlang:',
    uz_cyr: '⚙️ *Созламалар*\n\nКеракли бўлимни танланг:',
    ru: '⚙️ *Настройки*\n\nВыберите нужный раздел:',
  },
  buttons: {
    changeLang: {
      uz_lat: '🌐 Tilni o‘zgartirish',
      uz_cyr: '🌐 Тилни ўзгартириш',
      ru: '🌐 Изменить язык',
    },
    mainMenu: {
      uz_lat: '⬅️ Asosiy menyu',
      uz_cyr: '⬅️ Асосий меню',
      ru: '⬅️ Главное меню',
    },
    back: {
      uz_lat: '⬅️ Orqaga',
      uz_cyr: '⬅️ Орқага',
      ru: '⬅️ Назад',
    },
  },
  selectLangTitle: {
    uz_lat: '🌐 Yangi tilni tanlang:',
    uz_cyr: '🌐 Янги тилни танланг:',
    ru: '🌐 Выберите язык:',
  },
};

export function registerSettingsHandler(bot: Telegraf) {

  // 1. Sozlamalar menyusi
  bot.action('settings', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from?.id.toString();
      const rawLang = telegramId ? await getUserLanguage(telegramId) : undefined;
      const lang = resolveLang(rawLang);

      const text = SETTINGS_I18N.title[lang];
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(SETTINGS_I18N.buttons.changeLang[lang], 'change_language')],
        [Markup.button.callback(SETTINGS_I18N.buttons.mainMenu[lang], 'main_menu')],
      ]);

      if (ctx.callbackQuery && 'message' in ctx.callbackQuery) {
        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
        return;
      }

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      console.error('❌ Settings action error:', error);
    }
  });

  // 2. Tilni o'zgartirish oynasi
  bot.action('change_language', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from?.id.toString();
      const rawLang = telegramId ? await getUserLanguage(telegramId) : undefined;
      const lang = resolveLang(rawLang);

      const text = SETTINGS_I18N.selectLangTitle[lang];
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🇺🇿 O‘zbek (lotin)', 'lang_uz_lat')],
        [Markup.button.callback('🇺🇿 Ўзбек (кирилл)', 'lang_uz_cyr')],
        [Markup.button.callback('🇷🇺 Русский', 'lang_ru')],
        [Markup.button.callback(SETTINGS_I18N.buttons.back[lang], 'settings')],
      ]);

      if (ctx.callbackQuery && 'message' in ctx.callbackQuery) {
        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
        return;
      }

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      console.error('❌ Change language action error:', error);
    }
  });
}