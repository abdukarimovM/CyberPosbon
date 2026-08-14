import { Markup, Telegraf } from 'telegraf';
import { registerUser } from '../services/user.service';

export function registerStartHandler(bot: Telegraf) {
  bot.start(async (ctx) => {
    await ctx.reply(
      '🛡 CyberPosbon\n\n' +
        'Tilni tanlang / Выберите язык:',
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
  });
}