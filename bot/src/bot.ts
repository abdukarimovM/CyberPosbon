import { registerStartHandler } from './handlers/start.handler';
import { registerLanguageHandler } from './handlers/language.handler';
import { sendMainMenu } from './handlers/main-menu.handler';

import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.API_URL || 'http://localhost:3000';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN .env faylida topilmadi');
}

const bot = new Telegraf(BOT_TOKEN);

registerStartHandler(bot);
registerLanguageHandler(bot);

async function getUserLanguage(
  telegramId: string,
): Promise<string> {
  try {
    const response = await axios.get(
      `${API_URL}/users/${telegramId}`,
    );

    return response.data?.user?.language || 'uz_lat';
  } catch (error) {
    console.error(
      'Get user language error:',
      error,
    );

    return 'uz_lat';
  }
}



// ====================
// SOZLAMALAR
// ====================
bot.action('settings', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const telegramId = ctx.from.id.toString();

    const language =
      await getUserLanguage(telegramId);

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
    console.error(
      'Settings error:',
      error,
    );
  }
});

// ====================
// TILNI O‘ZGARTIRISH
// ====================

bot.action('change_language', async (ctx) => {
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
});

// ====================
// ADMIN PANEL
// ====================

bot.action('admin_panel', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();

    if (
      !ADMIN_TELEGRAM_ID ||
      telegramId !== ADMIN_TELEGRAM_ID
    ) {
      await ctx.answerCbQuery(
        '❌ Sizda admin huquqi yo‘q.',
        { show_alert: true },
      );

      return;
    }

    if (!ADMIN_API_KEY) {
      await ctx.answerCbQuery(
        '❌ ADMIN_API_KEY topilmadi.',
        { show_alert: true },
      );

      return;
    }

    const response = await axios.get(
      `${API_URL}/users/admin/stats`,
      {
        headers: {
          'x-admin-key': ADMIN_API_KEY,
        },
      },
    );

    const stats = response.data;

    const languages = stats.languages || {};

    await ctx.answerCbQuery();

    await ctx.reply(
      `🔐 ADMIN PANEL\n\n` +
        `👥 Jami foydalanuvchilar: ${stats.totalUsers}\n` +
        `📅 Bugun kirganlar: ${stats.todayUsers}\n\n` +
        `🌐 Tillar:\n` +
        `🇺🇿 O‘zbek: ${languages.uz_lat || 0}\n` +
        `🇺🇿 Кирилл: ${languages.uz_cyr || 0}\n` +
        `🇷🇺 Русский: ${languages.ru || 0}`,
    );
  } catch (error) {
    console.error('Admin panel error:', error);

    await ctx.answerCbQuery(
      '❌ Statistikani olishda xatolik.',
      { show_alert: true },
    );
  }
});

// ====================
// ASOSIY MENYU TUGMASI
// ====================

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

// ====================
// HOZIRCHA BO‘SH FUNKSIYALAR
// ====================
bot.action(
  [
    'check_source',
    'check_phone',
    'check_url',
    'database',
  ],
  async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      '🚧 Ushbu funksiya ishlab chiqilmoqda.\n\n' +
        'Tez orada ishga tushiriladi.',
    );
  },
);

bot.action('profile', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const telegramId = ctx.from.id.toString();

    const response = await axios.get(
      `${API_URL}/users/${telegramId}`,
    );

    const user = response.data?.user;

    if (!user) {
      await ctx.reply(
        '❌ Foydalanuvchi ma’lumotlari topilmadi.',
      );

      return;
    }

    const language = user.language || 'uz_lat';

    const username = user.username || '—';
    const displayName = user.displayName || '—';
    const phoneNumber = user.phoneNumber || null;

    if (language === 'ru') {
      await ctx.reply(
        `👤 Мой профиль\n\n` +
          `🆔 Telegram ID: ${user.telegramId}\n` +
          `👤 Имя: ${displayName}\n` +
          `🔹 Username: ${username}\n` +
          `📱 Телефон: ${
            phoneNumber || 'Не указан'
          }\n` +
          `🌐 Язык: Русский`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '📱 Добавить номер телефона',
              'add_phone',
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
        `👤 Профилим\n\n` +
          `🆔 Telegram ID: ${user.telegramId}\n` +
          `👤 Исм: ${displayName}\n` +
          `🔹 Username: ${username}\n` +
          `📱 Телефон: ${
            phoneNumber || 'Кўрсатилмаган'
          }\n` +
          `🌐 Тил: Ўзбек (кирилл)`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '📱 Телефон рақамимни қўшиш',
              'add_phone',
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
      `👤 Mening profilim\n\n` +
        `🆔 Telegram ID: ${user.telegramId}\n` +
        `👤 Display name: ${displayName}\n` +
        `🔹 Username: ${username}\n` +
        `📱 Telefon: ${
          phoneNumber || 'Ko‘rsatilmagan'
        }\n` +
        `🌐 Til: O‘zbek (lotin)`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📱 Telefon raqamimni qo‘shish',
            'add_phone',
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
    console.error(
      'Profile error:',
      error,
    );

    await ctx.reply(
      '❌ Profil ma’lumotlarini olishda xatolik yuz berdi.',
    );
  }
});

bot.action('add_phone', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const language =
      await getUserLanguage(ctx.from.id.toString());

    if (language === 'ru') {
      await ctx.reply(
        '📱 Отправьте свой номер телефона, нажав кнопку ниже:',
        Markup.keyboard([
          [
            Markup.button.contactRequest(
              '📱 Отправить мой номер',
            ),
          ],
        ])
          .resize()
          .oneTime(),
      );

      return;
    }

    if (language === 'uz_cyr') {
      await ctx.reply(
        '📱 Қуйидаги тугмани босиб, телефон рақамингизни юборинг:',
        Markup.keyboard([
          [
            Markup.button.contactRequest(
              '📱 Рақамимни юбориш',
            ),
          ],
        ])
          .resize()
          .oneTime(),
      );

      return;
    }

    await ctx.reply(
      '📱 Quyidagi tugmani bosib, telefon raqamingizni yuboring:',
      Markup.keyboard([
        [
          Markup.button.contactRequest(
            '📱 Raqamimni yuborish',
          ),
        ],
      ])
        .resize()
        .oneTime(),
    );
  } catch (error) {
    console.error(
      'Add phone error:',
      error,
    );
  }
});


bot.on('contact', async (ctx) => {
  try {
    const contact = ctx.message.contact;

    // Faqat foydalanuvchining o'z raqamini qabul qilamiz
    if (
      contact.user_id &&
      contact.user_id !== ctx.from.id
    ) {
      await ctx.reply(
        '❌ Iltimos, faqat o‘zingizning telefon raqamingizni yuboring.',
      );

      return;
    }

    const telegramId =
      ctx.from.id.toString();

    await axios.patch(
      `${API_URL}/users/${telegramId}/phone`,
      {
        phoneNumber: contact.phone_number,
      },
    );

    const language =
      await getUserLanguage(telegramId);

    if (language === 'ru') {
      await ctx.reply(
        '✅ Номер телефона успешно добавлен.',
        Markup.removeKeyboard(),
      );
    } else if (language === 'uz_cyr') {
      await ctx.reply(
        '✅ Телефон рақамингиз муваффақиятли қўшилди.',
        Markup.removeKeyboard(),
      );
    } else {
      await ctx.reply(
        '✅ Telefon raqamingiz muvaffaqiyatli qo‘shildi.',
        Markup.removeKeyboard(),
      );
    }

    await sendMainMenu(ctx, language);
  } catch (error) {
    console.error(
      'Contact save error:',
      error,
    );

    await ctx.reply(
      '❌ Telefon raqamini saqlashda xatolik yuz berdi.',
      Markup.removeKeyboard(),
    );
  }
});


// ====================
// BOTNI ISHGA TUSHIRISH
// ====================

bot.launch();

console.log(
  '🤖 CyberPosbon bot ishga tushdi...',
);

process.once('SIGINT', () =>
  bot.stop('SIGINT'),
);

process.once('SIGTERM', () =>
  bot.stop('SIGTERM'),
);