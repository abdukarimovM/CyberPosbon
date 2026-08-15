import { Markup, Telegraf } from 'telegraf';
import { getUserLanguage } from '../services/user.service';

// URL yuborishini kutayotgan foydalanuvchilar
const waitingForSource = new Set<string>();

export function registerSourceHandler(bot: Telegraf) {
  // 🔎 MANBANI TEKSHIRISH TUGMASI
  bot.action('check_source', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id.toString();

      waitingForSource.add(telegramId);

      const language = await getUserLanguage(
        telegramId,
      );

      if (language === 'ru') {
        await ctx.reply(
          '🔎 Отправьте ссылку на источник, который хотите проверить:',
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
        'Source request error:',
        error,
      );
    }
  });

  // 🌐 FOYDALANUVCHI URL YUBORGANDAGI QISM
  bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id.toString();

    // Agar foydalanuvchi manba kiritayotgan bo‘lmasa,
    // bu handler hech narsa qilmaydi
    if (!waitingForSource.has(telegramId)) {
      return;
    }

    const text = ctx.message.text.trim();

    // Asosiy menyuga qaytish matni
    if (
      text === '⬅️ Asosiy menyu' ||
      text === '⬅️ Асосий меню' ||
      text === '⬅️ Главное меню'
    ) {
      waitingForSource.delete(telegramId);
      return;
    }

    try {
      let urlText = text;

      // https:// yoki http:// yozilmagan bo‘lsa
      // avtomatik qo‘shamiz
      if (
        !urlText.startsWith('http://') &&
        !urlText.startsWith('https://')
      ) {
        urlText = `https://${urlText}`;
      }

      const parsedUrl = new URL(urlText);

      const domain = parsedUrl.hostname
        .toLowerCase()
        .replace(/^www\./, '');

      // Oddiy URL tekshiruvi
      if (!domain || !domain.includes('.')) {
        await ctx.reply(
          '❌ Yaroqli manba havolasini yuboring.\n\n' +
            'Masalan:\n' +
            'https://example.com',
        );

        return;
      }

      // Kutish holatini o‘chiramiz
      waitingForSource.delete(telegramId);

      const language =
        await getUserLanguage(telegramId);

      if (language === 'ru') {
        await ctx.reply(
          `✅ Источник принят.\n\n` +
            `🌐 Домен: ${domain}\n\n` +
            `🔎 Выполняется проверка...`,
        );
      } else if (language === 'uz_cyr') {
        await ctx.reply(
          `✅ Манба қабул қилинди.\n\n` +
            `🌐 Домен: ${domain}\n\n` +
            `🔎 Текширилмоқда...`,
        );
      } else {
        await ctx.reply(
          `✅ Manba qabul qilindi.\n\n` +
            `🌐 Domen: ${domain}\n\n` +
            `🔎 Tekshirilmoqda...`,
        );
      }

      console.log(
        `Source check request: ${telegramId} -> ${urlText}`,
      );

      // Keyingi bosqichda shu yerda
      // backendga yuboramiz.
    } catch (error) {
      console.error(
        'Source URL parse error:',
        error,
      );

      await ctx.reply(
        '❌ Havola noto‘g‘ri.\n\n' +
          'Masalan:\n' +
          'https://example.com',
      );
    }
  });
}