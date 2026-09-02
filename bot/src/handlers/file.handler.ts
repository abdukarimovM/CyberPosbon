import { Markup, Telegraf } from 'telegraf';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { api } from '../api/api.client';
import { getUserLanguage } from '../services/user.service';

// =========================================================
// 📦 HOLATLAR VA MA'LUMOTLAR STRUKTURASI
// =========================================================

const waitingForFile = new Set<string>();
const pendingFileAnalyses = new Map<string, string>();

type SupportedLang = 'uz' | 'uz_cyr' | 'ru';

// 20 MB Telegram Bot API yuklab olish cheklovi
const MAX_TELEGRAM_FILE_SIZE = 20 * 1024 * 1024;

const MESSAGES = {
  sendPrompt: {
    uz: '📱 Tekshirmoqchi bo‘lgan fayl yoki ilovani yuboring:',
    uz_cyr: '📱 Текширмоқчи бўлган файл ёки иловани юборинг:',
    ru: '📱 Отправьте файл или приложение, которое хотите проверить:',
  },
  mainMenuBtn: {
    uz: '⬅️ Asosiy menyu',
    uz_cyr: '⬅️ Асосий меню',
    ru: '⬅️ Главное меню',
  },
  checkResultBtn: {
    uz: '🔄 Natijani tekshirish',
    uz_cyr: '🔄 Натижани текшириш',
    ru: '🔄 Проверить результат',
  },
  fileReceived: (name: string, lang: SupportedLang) => {
    const text = {
      uz: `📦 Fayl qabul qilindi.\n\n📄 Nomi: ${name}\n⏳ Tekshiruvga tayyorlanmoqda...`,
      uz_cyr: `📦 Файл қабул қилинди.\n\n📄 Номи: ${name}\n⏳ Текширувга тайёрланмоқда...`,
      ru: `📦 Файл принят.\n\n📄 Имя: ${name}\n⏳ Подготовка к проверке...`,
    };
    return text[lang];
  },
  vtPending: {
    uz: '⏳ Fayl VirusTotal tahliliga yuborildi.\n\nTekshiruv davom etmoqda.\n\n🕐 20–30 soniya kutib, «Natijani tekshirish» tugmasini bosing.',
    uz_cyr: '⏳ Файл VirusTotal таҳлилига юборилди.\n\nТекширув давом этмоқда.\n\n🕐 20–30 сония кутиб, «Натижани текшириш» тугмасини босинг.',
    ru: '⏳ Файл отправлен на анализ VirusTotal.\n\nПроверка ещё выполняется.\n\n🕐 Подождите 20–30 секунд и нажмите «Проверить результат».',
  },
  vtChecking: {
    uz: '⏳ VirusTotal faylni tahlil qilmoqda...\n\n🕐 Iltimos, kuting.',
    uz_cyr: '⏳ VirusTotal файлни таҳлил қилмоқда...\n\n🕐 Илтимос, кутинг.',
    ru: '⏳ VirusTotal анализирует файл...\n\n🕐 Пожалуйста, подождите.',
  },
  vtStillPending: {
    uz: '⏳ Tahlil hali davom etmoqda.\n\n🕐 Yana bir necha soniya kuting va qayta tekshiring.',
    uz_cyr: '⏳ Таҳлил ҳали давом этмоқда.\n\n🕐 Яна бир неча сония кутинг ва қайта текширинг.',
    ru: '⏳ Анализ всё ещё выполняется.\n\n🕐 Подождите ещё немного и проверьте снова.',
  },
  notFound: {
    uz: '❌ Fayl tahlili topilmadi. Iltimos, faylni qayta yuboring.',
    uz_cyr: '❌ Файл таҳлили топилмади. Илтимос, файлни қайта юборинг.',
    ru: '❌ Анализ файла не найден. Пожалуйста, отправьте файл заново.',
  },
  tooLargeTelegram: {
    uz: '❌ Fayl hajmi 20 MB dan katta.\n\n📦 Telegram Bot API cheklovi tufayli faqat 20 MB gacha bo‘lgan fayllarni qabul qila olamiz.',
    uz_cyr: '❌ Файл ҳажми 20 МБ дан катта.\n\n📦 Telegram Bot API чекловлари туфайли фақат 20 МБ гача бўлган файлларни текшириш мумкин.',
    ru: '❌ Размер файла превышает 20 МБ.\n\n📦 Из-за ограничений Telegram Bot API поддерживаются файлы только до 20 МБ.',
  },
  tooLargeBackend: {
    uz: '❌ Fayl hajmi juda katta.\n\n📦 Maksimal ruxsat etilgan hajm: 100 MB.',
    uz_cyr: '❌ Файл ҳажми жуда катта.\n\n📦 Максимал рухсат этилган ҳажм: 100 МБ.',
    ru: '❌ Файл слишком большой.\n\n📦 Максимальный размер файла: 100 МБ.',
  },
  error: {
    uz: '❌ Faylni tekshirishda xatolik yuz berdi.',
    uz_cyr: '❌ Файлни текширишда хатолик юз берди.',
    ru: '❌ Произошла ошибка при проверке файла.',
  },
};

// =========================================================
// 🔧 YORDAMCHI FUNKSIYALAR
// =========================================================

function resolveLanguage(rawLang: string | undefined): SupportedLang {
  if (rawLang === 'ru') return 'ru';
  if (rawLang === 'uz_cyr') return 'uz_cyr';
  return 'uz';
}

function formatResultText(lang: SupportedLang, result: any, fileName?: string): string {
  const status = result?.status || 'unknown';
  const score = result?.score ?? result?.risk?.score ?? result?.raw?.score ?? 0;
  const detections = result?.detections ? `\n📊 Aniqlangan xavflar: ${result.detections}` : '';

  const labels = {
    uz: {
      title: '🔍 Tekshiruv natijasi',
      file: fileName ? `📄 Fayl: ${fileName}\n` : '',
      level: '🛡️ Xavf darajasi:',
      score: '🎯 Xavf bali:',
      statuses: {
        dangerous: '🔴 XAVFLI',
        suspicious: '🟡 SHUBHALI',
        safe: '🟢 XAVFSIZ',
        unknown: '⚪ NOANIQ',
      },
    },
    uz_cyr: {
      title: '🔎 Текширув натижаси',
      file: fileName ? `📄 Файл: ${fileName}\n` : '',
      level: '🛡 Хавф даражаси:',
      score: '🎯 Хавф бали:',
      statuses: {
        dangerous: '🔴 ХАВФЛИ',
        suspicious: '🟡 ШУБҲАЛИ',
        safe: '🟢 ХАВФСИЗ',
        unknown: '⚪ НОМАЪЛУМ',
      },
    },
    ru: {
      title: '🔎 Результат проверки',
      file: fileName ? `📄 Файл: ${fileName}\n` : '',
      level: '🛡 Уровень риска:',
      score: '🎯 Балл риска:',
      statuses: {
        dangerous: '🔴 ОПАСНЫЙ',
        suspicious: '🟡 ПОДОЗРИТЕЛЬНЫЙ',
        safe: '🟢 БЕЗОПАСНЫЙ',
        unknown: '⚪ НЕИЗВЕСТНО',
      },
    },
  };

  const l = labels[lang];
  const statusText = l.statuses[status as keyof typeof l.statuses] || l.statuses.unknown;

  return `${l.title}\n\n${l.file}${l.level} ${statusText}\n${l.score} ${score}${detections}`;
}

// =========================================================
// 📱 FILE HANDLER
// =========================================================

export function registerFileHandler(bot: Telegraf) {

  // 1. Fayl tekshirish tugmasi
  bot.action('check_file', async (ctx) => {
    try {
      try {
        await ctx.answerCbQuery();
      } catch (error) {
        console.log('ℹ️ Callback query eskirgan:', error instanceof Error ? error.message : error);
      }

      const telegramId = ctx.from.id.toString();
      waitingForFile.add(telegramId);

      const rawLang = await getUserLanguage(telegramId);
      const lang = resolveLanguage(rawLang);

      await ctx.reply(
        MESSAGES.sendPrompt[lang],
        Markup.inlineKeyboard([
          [Markup.button.callback(MESSAGES.mainMenuBtn[lang], 'main_menu')],
        ])
      );
    } catch (error) {
      console.error('❌ File request error:', error);
    }
  });

  // 2. Telegramdan fayl qabul qilish
  bot.on('document', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const rawLang = await getUserLanguage(telegramId);
    const lang = resolveLanguage(rawLang);

    if (!waitingForFile.has(telegramId)) {
      return;
    }

    const document = ctx.message.document;
    const fileName = document.file_name || 'unknown';
    const fileSize = document.file_size || 0;

    // Telegram Bot API 20 MB cheklovi tekshiruvi
    if (fileSize > MAX_TELEGRAM_FILE_SIZE) {
      waitingForFile.delete(telegramId);
      await ctx.reply(
        MESSAGES.tooLargeTelegram[lang],
        Markup.inlineKeyboard([
          [Markup.button.callback(MESSAGES.mainMenuBtn[lang], 'main_menu')],
        ])
      );
      return;
    }

    waitingForFile.delete(telegramId);

    // Qabul qilinganlik xabari
    await ctx.reply(MESSAGES.fileReceived(fileName, lang));

    const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${fileName}`);

    try {
      // Telegramdan fayl ma'lumotini olish
      const telegramFile = await ctx.telegram.getFile(document.file_id);
      if (!telegramFile.file_path) {
        throw new Error('Telegram fayl yo‘li topilmadi.');
      }

      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${telegramFile.file_path}`;
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

      fs.writeFileSync(tempFilePath, response.data);

      // Backendga yuborish
      const form = new FormData();
      form.append('file', fs.createReadStream(tempFilePath), {
        filename: fileName,
        contentType: document.mime_type || 'application/octet-stream',
      });

      const backendResponse = await api.post('/scanner/file/check', form, {
        headers: { ...form.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const result = backendResponse.data;

      // Agar tahlil jarayonda bo'lsa (pending)
      if (result.pending === true && result.analysisId) {
        pendingFileAnalyses.set(telegramId, result.analysisId);

        await ctx.reply(
          MESSAGES.vtPending[lang],
          Markup.inlineKeyboard([
            [Markup.button.callback(MESSAGES.checkResultBtn[lang], 'check_file_status')],
            [Markup.button.callback(MESSAGES.mainMenuBtn[lang], 'main_menu')],
          ])
        );
        return;
      }

      // Agar natija darhol tayyor bo'lsa
      const finalMsg = formatResultText(lang, result, fileName);
      await ctx.reply(finalMsg);

    } catch (error: any) {
      console.error('❌ File receive error:', error);

      const errorMessage = error?.response?.data?.message;
      const isFileTooLarge = Array.isArray(errorMessage)
        ? errorMessage.some((msg: string) => msg.includes('File too large'))
        : typeof errorMessage === 'string' && errorMessage.includes('File too large');

      if (isFileTooLarge) {
        await ctx.reply(
          MESSAGES.tooLargeBackend[lang],
          Markup.inlineKeyboard([
            [Markup.button.callback(MESSAGES.mainMenuBtn[lang], 'main_menu')],
          ])
        );
        return;
      }

      await ctx.reply(MESSAGES.error[lang]);
    } finally {
      // Temp faylni tozalash
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupErr) {
          console.error('⚠️ Temp faylni o‘chirishda xatolik:', cleanupErr);
        }
      }
    }
  });

  // 3. VirusTotal natijasini tekshirish (Polling)
  bot.action('check_file_status', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id.toString();
      const rawLang = await getUserLanguage(telegramId);
      const lang = resolveLanguage(rawLang);

      const analysisId = pendingFileAnalyses.get(telegramId);
      if (!analysisId) {
        await ctx.reply(MESSAGES.notFound[lang]);
        return;
      }

      const chatId = ctx.chat?.id;
      const messageId =
        'message' in ctx.callbackQuery && ctx.callbackQuery.message
          ? ctx.callbackQuery.message.message_id
          : undefined;

      if (!chatId || !messageId) {
        throw new Error('Telegram message ID topilmadi.');
      }

      await ctx.telegram.editMessageText(chatId, messageId, undefined, MESSAGES.vtChecking[lang]);

      const maxAttempts = 6;
      const delayMs = 5000;
      let finalResult: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await api.post('/scanner/file/check-status', { analysisId });
          const result = response.data?.result;

          if (result && result.status !== 'unknown') {
            finalResult = result;
            break;
          }
        } catch (pollErr) {
          console.error(`⚠️ Polling xatosi (${attempt}):`, pollErr);
        }

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      // Agar hali ham tayyor bo'lmasa
      if (!finalResult) {
        await ctx.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          MESSAGES.vtStillPending[lang],
          Markup.inlineKeyboard([
            [Markup.button.callback(MESSAGES.checkResultBtn[lang], 'check_file_status')],
            [Markup.button.callback(MESSAGES.mainMenuBtn[lang], 'main_menu')],
          ])
        );
        return;
      }

      // Muvaffaqiyatli tugadi
      pendingFileAnalyses.delete(telegramId);
      const resultMessage = formatResultText(lang, finalResult);

      // ✅ TUZATILDI: Natija ostiga "Asosiy menyu" tugmasi qo'shildi
      await ctx.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        resultMessage,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(MESSAGES.mainMenuBtn[lang], 'main_menu')],
          ]),
        },
      );

    } catch (error) {
      console.error('❌ File status error:', error);
      const telegramId = ctx.from?.id.toString();
      const lang = resolveLanguage(telegramId ? await getUserLanguage(telegramId) : undefined);
      await ctx.reply(MESSAGES.error[lang]);
    }
  });
}