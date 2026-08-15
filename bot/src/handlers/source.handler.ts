import { Markup, Telegraf } from 'telegraf';

import { api } from '../api/api.client';
import { getUserLanguage } from '../services/user.service';

// URL yuborishini kutayotgan foydalanuvchilar
const waitingForSource = new Set<string>();

export function registerSourceHandler(bot: Telegraf) {
  // =========================================================
  // 🔎 MANBANI TEKSHIRISH
  // =========================================================

  bot.action('check_source', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id.toString();

      // Foydalanuvchi URL yuborishini kutamiz
      waitingForSource.add(telegramId);

      const language = await getUserLanguage(
        telegramId,
      );

      // 🇷🇺 Русский
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

      // 🇺🇿 Ўзбек (кирилл)
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

      // 🇺🇿 O‘zbek (lotin)
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

  // =========================================================
  // 🌐 FOYDALANUVCHI URL YUBORGANDAGI QISM
  // =========================================================

  bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id.toString();

    // Foydalanuvchi hozir manba tekshirayotgan bo‘lmasa,
    // bu handler ishlamaydi.
    if (!waitingForSource.has(telegramId)) {
      return;
    }

    const text = ctx.message.text.trim();

    // =======================================================
    // ⬅️ ASOSIY MENYUGA QAYTISH
    // =======================================================

    if (
      text === '⬅️ Asosiy menyu' ||
      text === '⬅️ Асосий меню' ||
      text === '⬅️ Главное меню'
    ) {
      waitingForSource.delete(telegramId);

      return;
    }

    try {
      // =====================================================
      // 🔗 URL TAYYORLASH
      // =====================================================

      let urlText = text;

      // Protocol yozilmagan bo‘lsa, avtomatik qo‘shamiz
      if (
        !urlText.startsWith('http://') &&
        !urlText.startsWith('https://')
      ) {
        urlText = `https://${urlText}`;
      }

      // URL formatini tekshirish
      const parsedUrl = new URL(urlText);

      // =====================================================
      // 🌐 DOMENNI AJRATISH
      // =====================================================

      const domain = parsedUrl.hostname
        .toLowerCase()
        .replace(/^www\./, '');

      // Domen noto‘g‘ri bo‘lsa
      if (!domain || !domain.includes('.')) {
        await ctx.reply(
          '❌ Yaroqli manba havolasini yuboring.\n\n' +
            'Masalan:\n' +
            'https://example.com',
        );

        return;
      }

      // URL qabul qilindi, endi kutish holatini o‘chiramiz
      waitingForSource.delete(telegramId);

      const language =
        await getUserLanguage(telegramId);

      // =====================================================
      // 🔎 TEKSHIRILMOQDA
      // =====================================================

      if (language === 'ru') {
        await ctx.reply(
          `🔎 Источник проверяется...\n\n` +
            `🌐 Домен: ${domain}`,
        );
      } else if (language === 'uz_cyr') {
        await ctx.reply(
          `🔎 Манба текширилмоқда...\n\n` +
            `🌐 Домен: ${domain}`,
        );
      } else {
        await ctx.reply(
          `🔎 Manba tekshirilmoqda...\n\n` +
            `🌐 Domen: ${domain}`,
        );
      }

      // =====================================================
      // 🔌 BACKEND API
      // =====================================================

      const response = await api.post(
        '/sources/check',
        {
          url: urlText,
        },
      );

      const result = response.data;
      const source = result?.source;

      // Backenddan source kelmasa
      if (!source) {
        throw new Error(
          'Backend source ma’lumotini qaytarmadi',
        );
      }

      // =====================================================
      // ✅ BAZADA OLDINDAN MAVJUD
      // =====================================================

      if (result.found) {
        if (language === 'ru') {
          await ctx.reply(
            `🔎 Источник проверен\n\n` +
              `🌐 Домен: ${source.domain}\n` +
              `📊 Статус: ${source.status}\n` +
              `ℹ️ Причина: ${
                source.reason || 'Не указана'
              }`,
          );
        } else if (language === 'uz_cyr') {
          await ctx.reply(
            `🔎 Манба текширилди\n\n` +
              `🌐 Домен: ${source.domain}\n` +
              `📊 Ҳолати: ${source.status}\n` +
              `ℹ️ Сабаб: ${
                source.reason || 'Кўрсатилмаган'
              }`,
          );
        } else {
          await ctx.reply(
            `🔎 Manba tekshirildi\n\n` +
              `🌐 Domen: ${source.domain}\n` +
              `📊 Holati: ${source.status}\n` +
              `ℹ️ Sabab: ${
                source.reason || 'Ko‘rsatilmagan'
              }`,
          );
        }

        return;
      }

      // =====================================================
      // 🆕 BAZADA YO‘Q EDI — YANGI MANBA
      // =====================================================

      if (language === 'ru') {
        await ctx.reply(
          `🆕 Новый источник добавлен\n\n` +
            `🌐 Домен: ${source.domain}\n` +
            `📊 Статус: ${source.status}\n` +
            `ℹ️ ${
              source.reason ||
              'Источник ещё не был оценён.'
            }`,
        );
      } else if (language === 'uz_cyr') {
        await ctx.reply(
          `🆕 Янги манба қўшилди\n\n` +
            `🌐 Домен: ${source.domain}\n` +
            `📊 Ҳолати: ${source.status}\n` +
            `ℹ️ ${
              source.reason ||
              'Манба ҳали баҳоланмаган.'
            }`,
        );
      } else {
        await ctx.reply(
          `🆕 Yangi manba qo‘shildi\n\n` +
            `🌐 Domen: ${source.domain}\n` +
            `📊 Holati: ${source.status}\n` +
            `ℹ️ ${
              source.reason ||
              'Manba hali baholanmagan.'
            }`,
        );
      }
    } catch (error) {
      console.error(
        'Source URL check error:',
        error,
      );

      // Xatolik bo‘lsa kutish holatini tozalaymiz
      waitingForSource.delete(telegramId);

      const language =
        await getUserLanguage(telegramId);

      if (language === 'ru') {
        await ctx.reply(
          '❌ При проверке источника произошла ошибка.\n\n' +
            'Попробуйте ещё раз.',
        );
      } else if (language === 'uz_cyr') {
        await ctx.reply(
          '❌ Манбани текшириш вақтида хатолик юз берди.\n\n' +
            'Қайта уриниб кўринг.',
        );
      } else {
        await ctx.reply(
          '❌ Manbani tekshirish vaqtida xatolik yuz berdi.\n\n' +
            'Qayta urinib ko‘ring.',
        );
      }
    }
  });
}