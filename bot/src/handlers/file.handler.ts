import { Markup, Telegraf } from 'telegraf';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { api } from '../api/api.client';
import { getUserLanguage } from '../services/user.service';

// =========================================================
// 📦 FAYL YUBORISH HOLATI
// =========================================================

const waitingForFile = new Set<string>();

// Telegram ID → VirusTotal analysis ID
const pendingFileAnalyses = new Map<string, string>();

// =========================================================
// 🔧 YORDAMCHI FUNKSIYA
// =========================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  );
}

// =========================================================
// 📱 FILE HANDLER
// =========================================================

export function registerFileHandler(
  bot: Telegraf,
) {

  // =========================================================
  // 📱 FAYL / ILOVANI TEKSHIRISH TUGMASI
  // =========================================================

  bot.action('check_file', async (ctx) => {
    try {
      try {
        await ctx.answerCbQuery();
      } catch (error) {
        console.log(
          'ℹ️ Telegram callback query eskirgan:',
          error instanceof Error ? error.message : error,
        );
      }

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
        '❌ File request error:',
        error,
      );
    }
  });

  // =========================================================
  // 📦 TELEGRAMDAN FAYL QABUL QILISH
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

      // =====================================================
      // 📩 QABUL QILINGANINI FOYDALANUVCHIGA AYTISh
      // =====================================================

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
      // 📥 TELEGRAM FILE
      // =====================================================

      const telegramFile =
        await ctx.telegram.getFile(
          document.file_id,
        );

      if (!telegramFile.file_path) {
        throw new Error(
          'Telegram fayl yo‘li topilmadi.',
        );
      }

      // =====================================================
      // 📁 VAQTINCHA FAYL
      // =====================================================

      const tempFilePath =
        path.join(
          os.tmpdir(),
          `${Date.now()}-${fileName}`,
        );

      try {

        // ===================================================
        // 📥 TELEGRAMDAN YUKLAB OLISH
        // ===================================================

        const fileUrl =
          `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${telegramFile.file_path}`;

        const response =
          await axios.get(
            fileUrl,
            {
              responseType:
                'arraybuffer',
            },
          );

        fs.writeFileSync(
          tempFilePath,
          response.data,
        );

        console.log(
          '📥 Fayl vaqtincha saqlandi:',
          tempFilePath,
        );

        // ===================================================
        // 📤 BACKENDGA YUBORISH
        // ===================================================

        const form =
          new FormData();

        form.append(
          'file',
          fs.createReadStream(
            tempFilePath,
          ),
          {
            filename:
              fileName,

            contentType:
              document.mime_type ||
              'application/octet-stream',
          },
        );

        console.log(
          '📤 Fayl backendga yuborilmoqda...',
        );

        const backendResponse =
          await api.post(
            '/scanner/file/check',
            form,
            {
              headers: {
                ...form.getHeaders(),
              },

              maxContentLength:
                Infinity,

              maxBodyLength:
                Infinity,
            },
          );

        const result =
          backendResponse.data;

        console.log(
          '✅ Backend file result:',
          result,
        );

        // ===================================================
        // ⏳ VIRUSTOTAL PENDING
        // ===================================================

        if (
          result.pending === true &&
          result.analysisId
        ) {

          // Analysis ID ni saqlaymiz
          pendingFileAnalyses.set(
            telegramId,
            result.analysisId,
          );

          console.log(
            '⏳ VirusTotal pending:',
            result.analysisId,
          );

          const message =
            language === 'ru'
              ? '⏳ Файл отправлен на анализ VirusTotal.\n\nПроверка ещё выполняется.\n\n🕐 Пожалуйста, подождите 20–30 секунд, затем нажмите «Проверить результат».'
              : language === 'uz_cyr'
                ? '⏳ Файл VirusTotal таҳлилига юборилди.\n\nТекширув ҳали давом этмоқда.\n\n🕐 Илтимос, 20–30 сония кутиб, сўнг «Натижани текшириш» тугмасини босинг.'
                : '⏳ Fayl VirusTotal tahliliga yuborildi.\n\nTekshiruv hali davom etmoqda.\n\n🕐 Iltimos, 20–30 soniya kutib, so‘ng «Natijani tekshirish» tugmasini bosing.';

          await ctx.reply(
            message,
            Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  language === 'ru'
                    ? '🔄 Проверить результат'
                    : language === 'uz_cyr'
                      ? '🔄 Натижани текшириш'
                      : '🔄 Natijani tekshirish',

                  'check_file_status',
                ),
              ],

              [
                Markup.button.callback(
                  language === 'ru'
                    ? '⬅️ Главное меню'
                    : language === 'uz_cyr'
                      ? '⬅️ Асосий меню'
                      : '⬅️ Asosiy menyu',

                  'main_menu',
                ),
              ],
            ]),
          );

          return;
        }

        // ===================================================
        // 🎯 AGAR NATIJA DARHOL TAYYOR BO‘LSA
        // ===================================================

        await sendFinalFileResult(
          ctx,
          language,
          fileName,
          result,
        );

      } finally {

        // ===================================================
        // 🧹 TEMP FILE O‘CHIRISH
        // ===================================================

        if (
          fs.existsSync(
            tempFilePath,
          )
        ) {
          fs.unlinkSync(
            tempFilePath,
          );

          console.log(
            '🧹 Temp fayl o‘chirildi:',
            tempFilePath,
          );
        }
      }

    } catch (error) {

      console.error(
        '❌ File receive error:',
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

  // =========================================================
  // 🔄 VIRUSTOTAL NATIJASINI TEKSHIRISH
  // =========================================================

  // =========================================================
  // 🔄 VIRUSTOTAL NATIJASINI TEKSHIRISH
  // =========================================================

  bot.action(
    'check_file_status',
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        const telegramId =
          ctx.from.id.toString();

        const language =
          await getUserLanguage(
            telegramId,
          );

        // ===================================================
        // 📌 ANALYSIS ID
        // ===================================================

        const analysisId =
          pendingFileAnalyses.get(
            telegramId,
          );

        if (!analysisId) {
          const message =
            language === 'ru'
              ? '❌ Анализ файла не найден. Пожалуйста, отправьте файл заново.'
              : language === 'uz_cyr'
                ? '❌ Файл таҳлили топилмади. Илтимос, файлни қайта юборинг.'
                : '❌ Fayl tahlili topilmadi. Iltimos, faylni qayta yuboring.';

          await ctx.reply(message);

          return;
        }

        // ===================================================
        // 📌 BOSILGAN XABAR ID
        // ===================================================

        const chatId =
          ctx.chat?.id;

        const messageId =
          'message' in ctx.callbackQuery &&
            ctx.callbackQuery.message
            ? ctx.callbackQuery.message.message_id
            : undefined;

        if (!chatId || !messageId) {
          throw new Error(
            'Telegram message ID topilmadi.',
          );
        }

        console.log(
          '🔄 File analysis tekshirilmoqda:',
          analysisId,
        );

        // ===================================================
        // ⏳ KUTISH XABARI
        // ===================================================

        const waitingMessage =
          language === 'ru'
            ? '⏳ VirusTotal анализирует файл...\n\n🕐 Пожалуйста, подождите.\nПроверка обычно занимает 20–30 секунд.'
            : language === 'uz_cyr'
              ? '⏳ VirusTotal файлни таҳлил қилмоқда...\n\n🕐 Илтимос, кутинг.\nТекширув одатда 20–30 сония давом этади.'
              : '⏳ VirusTotal faylni tahlil qilmoqda...\n\n🕐 Iltimos, kuting.\nTekshiruv odatda 20–30 soniya davom etadi.';

        await ctx.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          waitingMessage,
        );

        // ===================================================
        // 🔄 POLLING
        // ===================================================

        const maxAttempts = 6;
        const delayMs = 5000;

        let finalResult: any = null;

        for (
          let attempt = 1;
          attempt <= maxAttempts;
          attempt++
        ) {
          console.log(
            `🔄 VirusTotal polling: ${attempt}/${maxAttempts}`,
          );

          try {
            const response =
              await api.post(
                '/scanner/file/check-status',
                {
                  analysisId,
                },
              );

            const data =
              response.data;

            const result =
              data?.result;

            console.log(
              '📊 VirusTotal status:',
              result?.status,
            );

            // =================================================
            // ✅ TAYYOR
            // =================================================

            if (
              result &&
              result.status !== 'unknown'
            ) {
              finalResult =
                result;

              console.log(
                '✅ VirusTotal analysis tayyor:',
                result.status,
              );

              break;
            }
          } catch (error) {
            console.error(
              '⚠️ Polling vaqtida xatolik:',
              error,
            );
          }

          // =================================================
          // ⏳ 5 SONIYA KUTISH
          // =================================================

          if (
            attempt <
            maxAttempts
          ) {
            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  delayMs,
                ),
            );
          }
        }

        // ===================================================
        // ⏰ 30 SONIYADA HAM TAYYOR EMAS
        // ===================================================

        if (!finalResult) {
          const stillRunning =
            language === 'ru'
              ? '⏳ Анализ всё ещё выполняется.\n\n🕐 Подождите ещё 20–30 секунд и нажмите «Проверить результат».'
              : language === 'uz_cyr'
                ? '⏳ Таҳлил ҳали давом этмоқда.\n\n🕐 Яна 20–30 сония кутинг ва «Натижани текшириш» тугмасини босинг.'
                : '⏳ Tahlil hali davom etmoqda.\n\n🕐 Yana 20–30 soniya kuting va «Natijani tekshirish» tugmasini bosing.';

          await ctx.telegram.editMessageText(
            chatId,
            messageId,
            undefined,
            stillRunning,
            Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  language === 'ru'
                    ? '🔄 Проверить результат'
                    : language === 'uz_cyr'
                      ? '🔄 Натижани текшириш'
                      : '🔄 Natijani tekshirish',
                  'check_file_status',
                ),
              ],
              [
                Markup.button.callback(
                  language === 'ru'
                    ? '⬅️ Главное меню'
                    : language === 'uz_cyr'
                      ? '⬅️ Асосий меню'
                      : '⬅️ Asosiy menyu',
                  'main_menu',
                ),
              ],
            ]),
          );

          return;
        }

        // ===================================================
        // 🧹 ANALYSIS ID O‘CHIRISH
        // ===================================================

        pendingFileAnalyses.delete(
          telegramId,
        );

        // ===================================================
        // 🎯 YAKUNIY NATIJA
        // ===================================================

        await editFinalFileResult(
          ctx,
          language,
          messageId,
          finalResult,
        );

      } catch (error) {
        console.error(
          '❌ File status error:',
          error,
        );

        await ctx.reply(
          '❌ Fayl tekshiruvi natijasini olishda xatolik yuz berdi.',
        );
      }
    },
  );
}

// =========================================================
// 🎯 FINAL NATIJA — YANGI XABAR
// =========================================================

async function sendFinalFileResult(
  ctx: any,
  language: string,
  fileName: string,
  result: any,
) {

  const status =
    result?.status ||
    'unknown';

  const score =
    result?.score ??
    result?.risk?.score ??
    result?.raw?.score ??
    0;

  let statusText =
    '';

  // =======================================================
  // 🇷🇺 RUS
  // =======================================================

  if (
    language === 'ru'
  ) {

    statusText =
      status === 'dangerous'
        ? '🔴 ОПАСНЫЙ'
        : status === 'suspicious'
          ? '🟡 ПОДОЗРИТЕЛЬНЫЙ'
          : status === 'safe'
            ? '🟢 БЕЗОПАСНЫЙ'
            : '⚪ НЕИЗВЕСТНО';

    await ctx.reply(
      `🔎 Результат проверки\n\n` +
      `📄 Файл: ${fileName}\n` +
      `🛡 Уровень риска: ${statusText}\n` +
      `🎯 Балл риска: ${score}`,
    );

    return;
  }

  // =======================================================
  // 🇺🇿 KIRILL
  // =======================================================

  if (
    language === 'uz_cyr'
  ) {

    statusText =
      status === 'dangerous'
        ? '🔴 ХАВФЛИ'
        : status === 'suspicious'
          ? '🟡 ШУБҲАЛИ'
          : status === 'safe'
            ? '🟢 ХАВФСИЗ'
            : '⚪ НОМАЪЛУМ';

    await ctx.reply(
      `🔎 Текширув натижаси\n\n` +
      `📄 Файл: ${fileName}\n` +
      `🛡 Хавф даражаси: ${statusText}\n` +
      `🎯 Хавф бали: ${score}`,
    );

    return;
  }

  // =======================================================
  // 🇺🇿 LOTIN
  // =======================================================

  statusText =
    status === 'dangerous'
      ? '🔴 XAVFLI'
      : status === 'suspicious'
        ? '🟡 SHUBHALI'
        : status === 'safe'
          ? '🟢 XAVFSIZ'
          : '⚪ NOANIQ';

  await ctx.reply(
    `🔍 Tekshiruv natijasi\n\n` +
    `📄 Fayl: ${fileName}\n` +
    `🛡️ Xavf darajasi: ${statusText}\n` +
    `🎯 Xavf bali: ${score}`,
  );
}

// =========================================================
// ✏️ FINAL NATIJA — KUTISH XABARINI ALMASHTIRISH
// =========================================================

async function editFinalFileResult(
  ctx: any,
  language: string,
  messageId: number,
  result: any,
) {

  const status =
    result?.status ||
    'unknown';

  const score =
    result?.score ??
    result?.risk?.score ??
    result?.raw?.score ??
    0;

  let statusText =
    '';

  // =======================================================
  // 🇷🇺 RUS
  // =======================================================

  if (
    language === 'ru'
  ) {

    statusText =
      status === 'dangerous'
        ? '🔴 ОПАСНЫЙ'
        : status === 'suspicious'
          ? '🟡 ПОДОЗРИТЕЛЬНЫЙ'
          : status === 'safe'
            ? '🟢 БЕЗОПАСНЫЙ'
            : '⚪ НЕИЗВЕСТНО';

    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      messageId,
      undefined,
      `🔎 Результат проверки\n\n` +
      `🛡 Уровень риска: ${statusText}\n` +
      `🎯 Балл риска: ${score}`,
    );

    return;
  }

  // =======================================================
  // 🇺🇿 KIRILL
  // =======================================================

  if (
    language === 'uz_cyr'
  ) {

    statusText =
      status === 'dangerous'
        ? '🔴 ХАВФЛИ'
        : status === 'suspicious'
          ? '🟡 ШУБҲАЛИ'
          : status === 'safe'
            ? '🟢 ХАВФСИЗ'
            : '⚪ НОМАЪЛУМ';

    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      messageId,
      undefined,
      `🔎 Текширув натижаси\n\n` +
      `🛡 Хавф даражаси: ${statusText}\n` +
      `🎯 Хавф бали: ${score}`,
    );

    return;
  }

  // =======================================================
  // 🇺🇿 LOTIN
  // =======================================================

  statusText =
    status === 'dangerous'
      ? '🔴 XAVFLI'
      : status === 'suspicious'
        ? '🟡 SHUBHALI'
        : status === 'safe'
          ? '🟢 XAVFSIZ'
          : '⚪ NOANIQ';

  await ctx.telegram.editMessageText(
    ctx.chat!.id,
    messageId,
    undefined,
    `🔍 Tekshiruv natijasi\n\n` +
    `🛡️ Xavf darajasi: ${statusText}\n` +
    `🎯 Xavf bali: ${score}`,
  );
}