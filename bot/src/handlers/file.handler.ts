import { Markup, Telegraf } from 'telegraf';

import { getUserLanguage } from '../services/user.service';

// Fayl yuborishini kutayotgan foydalanuvchilar
const waitingForFile = new Set<string>();

export function registerFileHandler(
  bot: Telegraf,
) {
  // =========================================================
  // 📱 FAYL / ILOVANI TEKSHIRISH
  // =========================================================

  bot.action('check_file', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId =
        ctx.from.id.toString();

      waitingForFile.add(telegramId);

      const language =
        await getUserLanguage(
          telegramId,
        );

      if (language === 'ru') {
        await ctx.reply(
          '📱 Отправьте файл или приложение, которое хотите проверить:',
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
          '📱 Текширмоқчи бўлган файл ёки иловани юборинг:',
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
        '📱 Tekshirmoqchi bo‘lgan fayl yoki ilovani yuboring:',
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
        'File request error:',
        error,
      );
    }
  });

  // =========================================================
  // 📦 FAYL QABUL QILISH
  // =========================================================

  bot.on('document', async (ctx) => {
    const telegramId =
      ctx.from.id.toString();

    if (!waitingForFile.has(telegramId)) {
      return;
    }

    try {
      waitingForFile.delete(
        telegramId,
      );

      const language =
        await getUserLanguage(
          telegramId,
        );

      const document =
        ctx.message.document;

      const fileName =
        document.file_name ||
        'unknown';

      const fileSize =
        document.file_size || 0;

      console.log(
        '📦 Fayl qabul qilindi:',
        fileName,
        fileSize,
      );

      if (language === 'ru') {
        await ctx.reply(
          `📦 Файл принят.\n\n` +
            `📄 Имя: ${fileName}\n\n` +
            `⏳ Подготовка к проверке...`,
        );
      } else if (
        language === 'uz_cyr'
      ) {
        await ctx.reply(
          `📦 Файл қабул қилинди.\n\n` +
            `📄 Номи: ${fileName}\n\n` +
            `⏳ Текширувга тайёрланмоқда...`,
        );
      } else {
        await ctx.reply(
          `📦 Fayl qabul qilindi.\n\n` +
            `📄 Nomi: ${fileName}\n\n` +
            `⏳ Tekshiruvga tayyorlanmoqda...`,
        );
      }

      // =====================================================
      // HOZIRCHA SHU YERDA TO‘XTAYMIZ
      // =====================================================
      // Keyingi bosqichda:
      //
      // Telegram → file_id
      // Telegram → faylni yuklab olish
      // fayl → Backend
      // Backend → VirusTotal
      //
      // qilamiz.

    } catch (error) {
      console.error(
        'File receive error:',
        error,
      );

      waitingForFile.delete(
        telegramId,
      );

      await ctx.reply(
        '❌ Faylni qabul qilishda xatolik yuz berdi.',
      );
    }
  });
}