import { Markup, Telegraf } from 'telegraf';
import {
  getUser,
  getUserLanguage,
  savePhone,
} from '../services/user.service';
import { sendMainMenu } from './main-menu.handler';

type SupportedLang = 'uz_lat' | 'uz_cyr' | 'ru';

function resolveLang(rawLang?: string): SupportedLang {
  if (rawLang === 'ru') return 'ru';
  if (rawLang === 'uz_cyr') return 'uz_cyr';
  return 'uz_lat';
}

// =========================================================
// 🌐 MATNLAR VA LOKALIZATSIYA
// =========================================================

const I18N = {
  profileTitle: {
    uz_lat: '👤 *Mening profilim*',
    uz_cyr: '👤 *Профилим*',
    ru: '👤 *Мой профиль*',
  },
  labels: {
    id: '🆔 Telegram ID:',
    name: { uz_lat: '👤 Ism:', uz_cyr: '👤 Исм:', ru: '👤 Имя:' },
    username: '🔹 Username:',
    phone: { uz_lat: '📱 Telefon:', uz_cyr: '📱 Телефон:', ru: '📱 Телефон:' },
    lang: { uz_lat: '🌐 Til:', uz_cyr: '🌐 Тил:', ru: '🌐 Язык:' },
    notSet: { uz_lat: 'Ko‘rsatilmagan', uz_cyr: 'Кўрсатилмаган', ru: 'Не указан' },
    langName: {
      uz_lat: 'O‘zbek (lotin)',
      uz_cyr: 'Ўзбек (кирилл)',
      ru: 'Русский',
    },
  },
  buttons: {
    addPhone: {
      uz_lat: '📱 Telefon raqam qo‘shish',
      uz_cyr: '📱 Телефон рақам қўшиш',
      ru: '📱 Добавить номер',
    },
    changePhone: {
      uz_lat: '🔄 Raqamni o‘zgartirish',
      uz_cyr: '🔄 Рақамни ўзгартириш',
      ru: '🔄 Изменить номер',
    },
    mainMenu: {
      uz_lat: '⬅️ Asosiy menyu',
      uz_cyr: '⬅️ Асосий меню',
      ru: '⬅️ Главное меню',
    },
    sendContact: {
      uz_lat: '📱 Raqamimni yuborish',
      uz_cyr: '📱 Рақамимни юбориш',
      ru: '📱 Отправить мой номер',
    },
    cancel: {
      uz_lat: '❌ Bekor qilish',
      uz_cyr: '❌ Бекор қилиш',
      ru: '❌ Отмена',
    },
  },
  messages: {
    promptPhone: {
      uz_lat: '📱 Quyidagi tugmani bosib, telefon raqamingizni yuboring:',
      uz_cyr: '📱 Қуйидаги тугмани босиб, телефон рақамингизни юборинг:',
      ru: '📱 Отправьте свой номер телефона, нажав кнопку ниже:',
    },
    phoneSaved: {
      uz_lat: '✅ Telefon raqamingiz muvaffaqiyatli saqlandi.',
      uz_cyr: '✅ Телефон рақамингиз муваффақиятли сақланди.',
      ru: '✅ Номер телефона успешно сохранен.',
    },
    notOwnContact: {
      uz_lat: '❌ Iltimos, faqat o‘zingizning telefon raqamingizni yuboring.',
      uz_cyr: '❌ Илтимос, фақат ўзингизнинг телефон рақамингизни юборинг.',
      ru: '❌ Пожалуйста, отправьте именно свой контакт.',
    },
    userNotFound: {
      uz_lat: '❌ Foydalanuvchi ma’lumotlari topilmadi.',
      uz_cyr: '❌ Фойдаланувчи маълумотлари топилмади.',
      ru: '❌ Данные пользователя не найдены.',
    },
    error: {
      uz_lat: '❌ Xatolik yuz berdi.',
      uz_cyr: '❌ Хатолик юз берди.',
      ru: '❌ Произошла ошибка.',
    },
    cancelled: {
      uz_lat: '❌ Bekor qilindi.',
      uz_cyr: '❌ Бекор қилинди.',
      ru: '❌ Отменено.',
    },
  },
};

// =========================================================
// 👤 PROFIL MATNINI YASASH
// =========================================================

function buildProfileMessage(user: any, lang: SupportedLang) {
  const displayName = user.displayName || '—';
  const username = user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : '—';
  const phone = user.phoneNumber || I18N.labels.notSet[lang];

  return (
    `${I18N.profileTitle[lang]}\n\n` +
    `${I18N.labels.id} \`${user.telegramId}\`\n` +
    `${I18N.labels.name[lang]} ${displayName}\n` +
    `${I18N.labels.username} ${username}\n` +
    `${I18N.labels.phone[lang]} ${phone}\n` +
    `${I18N.labels.lang[lang]} ${I18N.labels.langName[lang]}`
  );
}

// =========================================================
// 📱 PROFILE HANDLER
// =========================================================

export function registerProfileHandler(bot: Telegraf) {

  // 1. Profilni ko'rsatish
  bot.action('profile', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id.toString();
      const user = await getUser(telegramId);

      const rawLang = user?.language || (await getUserLanguage(telegramId));
      const lang = resolveLang(rawLang);

      if (!user) {
        await ctx.reply(I18N.messages.userNotFound[lang]);
        return;
      }

      const text = buildProfileMessage(user, lang);
      const phoneButtonText = user.phoneNumber
        ? I18N.buttons.changePhone[lang]
        : I18N.buttons.addPhone[lang];

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(phoneButtonText, 'add_phone')],
        [Markup.button.callback(I18N.buttons.mainMenu[lang], 'main_menu')],
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
      console.error('❌ Profile error:', error);
      await ctx.reply('❌ Profil ma’lumotlarini olishda xatolik yuz berdi.');
    }
  });

  // 2. Telefon qo'shish / o'zgartirish so'rovi
  bot.action('add_phone', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id.toString();
      const lang = resolveLang(await getUserLanguage(telegramId));

      await ctx.reply(
        I18N.messages.promptPhone[lang],
        Markup.keyboard([
          [Markup.button.contactRequest(I18N.buttons.sendContact[lang])],
          [Markup.button.text(I18N.buttons.cancel[lang])],
        ])
          .resize()
          .oneTime(),
      );
    } catch (error) {
      console.error('❌ Add phone error:', error);
    }
  });

  // 3. Bekor qilish tugmasi bosilganda (Reply keyboarddan chiqish)
  bot.hears(['❌ Bekor qilish', '❌ Бекор қилиш', '❌ Отмена'], async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const lang = resolveLang(await getUserLanguage(telegramId));

      await ctx.reply(I18N.messages.cancelled[lang], Markup.removeKeyboard());
      await sendMainMenu(ctx, lang);
    } catch (error) {
      console.error('❌ Cancel phone input error:', error);
    }
  });

  // 4. Telefon raqam (Contact) kelganda qabul qilish
  bot.on('contact', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const lang = resolveLang(await getUserLanguage(telegramId));

    try {
      const contact = ctx.message.contact;

      // Faqat foydalanuvchining o'z raqami ekanligini tasdiqlash
      if (contact.user_id && contact.user_id !== ctx.from.id) {
        await ctx.reply(
          I18N.messages.notOwnContact[lang],
          Markup.removeKeyboard(),
        );
        return;
      }

      await savePhone(telegramId, contact.phone_number);

      await ctx.reply(
        I18N.messages.phoneSaved[lang],
        Markup.removeKeyboard(),
      );

      // Yangilangan asosiy menyuni yuborish
      await sendMainMenu(ctx, lang);
    } catch (error) {
      console.error('❌ Contact save error:', error);
      await ctx.reply(
        I18N.messages.error[lang],
        Markup.removeKeyboard(),
      );
    }
  });
}