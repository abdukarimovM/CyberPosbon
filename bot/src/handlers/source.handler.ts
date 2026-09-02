import { Markup, Telegraf } from "telegraf";
import dns from "dns/promises";
import { api } from "../api/api.client";
import { getUserLanguage } from "../services/user.service";

type SupportedLang = "uz_lat" | "uz_cyr" | "ru";

function resolveLang(rawLang?: string): SupportedLang {
  if (rawLang === "ru") return "ru";
  if (rawLang === "uz_cyr") return "uz_cyr";
  return "uz_lat";
}

// Holatlar xotirasi
const waitingForSource = new Set<string>();

interface DeepScanSession {
  targetUrl: string;
  resultUrl?: string;
  scannerResults?: any[];
  initialScore?: number;
  initialStatus?: string;
}

const deepScanSessions = new Map<string, DeepScanSession>();

// =========================================================
// 🌐 LOKALIZATSIYA VA MATNLAR
// =========================================================

const I18N = {
  prompt: {
    uz_lat: "🔎 Tekshirmoqchi bo‘lgan manba (veb-sayt) havolasini yuboring:",
    uz_cyr: "🔎 Текширмоқчи бўлган манба (веб-сайт) ҳаволасини юборинг:",
    ru: "🔎 Отправьте ссылку на источник (веб-сайт), который хотите проверить:",
  },
  invalidUrl: {
    uz_lat: "❌ Yaroqsiz havola!\n\nIltimos, to‘g‘ri manzil yuboring.\nMasalan: `kun.uz` yoki `https://example.com`",
    uz_cyr: "❌ Яроқсиз ҳавола!\n\nИлтимос, тўғри манзил юборинг.\nМасалан: `kun.uz` ёки `https://example.com`",
    ru: "❌ Некорректная ссылка!\n\nПожалуйста, укажите правильный адрес.\nНапример: `kun.uz` или `https://example.com`",
  },
  domainNotFound: (domain: string) => ({
    uz_lat: `❌ *Bunday domen mavjud emas!*\n\n🌐 \`${domain}\` nomli veb-sayt DNS tizimida topilmadi.\nIltimos, manzilni to‘g‘ri yozganingizga ishonch hosil qilib qaytadan yuboring.`,
    uz_cyr: `❌ *Бундай домен мавжуд эмас!*\n\n🌐 \`${domain}\` номли веб-сайт DNS тизимида топилмади.\nИлтимос, манзилни тўғри ёзганингизга ишонч ҳосил қилиб қайтадан юборинг.`,
    ru: `❌ *Такой домен не существует!*\n\n🌐 Веб-сайт \`${domain}\` не найден в системе DNS.\nПожалуйста, проверьте правильность адреса и отправьте снова.`,
  }),
  checking: (domain: string) => ({
    uz_lat: `🔎 Manba tekshirilmoqda...\n\n🌐 Domen: \`${domain}\``,
    uz_cyr: `🔎 Манба текширилмоқда...\n\n🌐 Домен: \`${domain}\``,
    ru: `🔎 Источник проверяется...\n\n🌐 Домен: \`${domain}\``,
  }),
  buttons: {
    deepScan: {
      uz_lat: "🔬 Chuqur tahlil",
      uz_cyr: "🔬 Чуқур таҳлил",
      ru: "🔬 Глубокий анализ",
    },
    checkResult: {
      uz_lat: "🔄 Natijani tekshirish",
      uz_cyr: "🔄 Натижани текшириш",
      ru: "🔄 Проверить результат",
    },
    mainMenu: {
      uz_lat: "⬅️ Asosiy menyu",
      uz_cyr: "⬅️ Асосий меню",
      ru: "⬅️ Главное меню",
    },
  },
  deepScanStarted: (url: string) => ({
    uz_lat: `🔬 Chuqur tahlil boshlandi.\n\n🌐 Manzil: ${url}\n\n⏳ Tahlil davom etmoqda. Natijani bir necha soniyadan so‘ng tekshiring.`,
    uz_cyr: `🔬 Чуқур таҳлил бошланди.\n\n🌐 Манзил: ${url}\n\n⏳ Таҳлил давом этмоқда. Натижани бир неча сониядан сўнг текширинг.`,
    ru: `🔬 Глубокий анализ запущен.\n\n🌐 Адрес: ${url}\n\n⏳ Анализ выполняется. Проверьте результат через несколько секунд.`,
  }),
  deepScanPending: {
    uz_lat: "⏳ Chuqur tahlil hali yakunlanmadi.\n\n🕐 URLScan tekshiruvni davom ettirmoqda. Iltimos, yana 10–15 soniya kuting.",
    uz_cyr: "⏳ Чуқур таҳлил ҳали якунланмади.\n\n🕐 URLScan текширувни давом эттирмоқда. Илтимос, яна 10–15 сония кутинг.",
    ru: "⏳ Глубокий анализ ещё не завершён.\n\n🕐 Сканирование продолжается. Подождите ещё 10–15 секунд.",
  },
  deepScanFailed: {
    uz_lat: "⚠️ *Chuqur tahlilni amalga oshirib bo‘lmadi.*\n\nDomen serveri topilmadi yoki xizmatga ulanish imkoni bo‘lmadi.",
    uz_cyr: "⚠️ *Чуқур таҳлилни амалга ошириб бўлмади.*\n\nДомен сервери топилмади ёки хизматга уланиш имкони бўлмади.",
    ru: "⚠️ *Не удалось выполнить глубокий анализ.*\n\nСервер домена не найден или недоступен.",
  },
  notFound: {
    uz_lat: "❌ Chuqur tahlil ma’lumoti topilmadi. Manbani qaytadan tekshiring.",
    uz_cyr: "❌ Чуқур таҳлил маълумоти топилмади. Манбани қайтадан текширинг.",
    ru: "❌ Данные глубокого анализа не найдены. Отправьте ссылку заново.",
  },
  errors: {
    general: {
      uz_lat: "❌ Manbani tekshirish vaqtida xatolik yuz berdi. Qayta urinib ko‘ring.",
      uz_cyr: "❌ Манбани текшириш вақтида хатолик юз берди. Қайта уриниб кўринг.",
      ru: "❌ Произошла ошибка при проверке источника. Попробуйте снова.",
    },
  },
};

// =========================================================
// 🔧 URL FORMATINI TO‘G‘RILASH VA DOMEN TEKSHIRUVI
// =========================================================

function normalizeAndParseUrl(rawInput: string): { validUrl: string; domain: string } | null {
  try {
    let input = rawInput.trim();
    if (!input.startsWith("http://") && !input.startsWith("https://")) {
      input = `https://${input}`;
    }

    const parsed = new URL(input);
    const domain = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (!domain || !domain.includes(".") || domain.length < 4) {
      return null;
    }

    return { validUrl: parsed.href, domain };
  } catch {
    return null;
  }
}

/**
 * Domen mavjudligini DNS A/AAAA yozuvlari orqali tekshirish
 */
async function isDomainResolvable(domain: string): Promise<boolean> {
  try {
    await dns.lookup(domain);
    return true;
  } catch (err: any) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
      return false;
    }
    return true;
  }
}

function getStatusBadge(level: string): string {
  if (level === "safe") return "🟢 XAVFSIZ / БЕЗОПАСНЫЙ";
  if (level === "suspicious") return "🟡 SHUBHALI / ПОДОЗРИТЕЛЬНЫЙ";
  if (level === "dangerous") return "🔴 XAVFLI / ОПАСНЫЙ";
  return "⚪ NOANIQ / НЕИЗВЕСТНО";
}

// =========================================================
// 📱 SOURCE HANDLER
// =========================================================

export function registerSourceHandler(bot: Telegraf) {

  // 1. Havola tekshirish tugmasi bosilganda
  bot.action("check_source", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id.toString();
      waitingForSource.add(telegramId);

      const lang = resolveLang(await getUserLanguage(telegramId));

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
      ]);

      if (ctx.callbackQuery && "message" in ctx.callbackQuery) {
        await ctx.editMessageText(I18N.prompt[lang], keyboard);
        return;
      }

      await ctx.reply(I18N.prompt[lang], keyboard);
    } catch (error) {
      console.error("❌ Source action error:", error);
    }
  });

  // 2. Foydalanuvchi havola yuborganda (Tezkor tahlil)
  bot.on("text", async (ctx, next) => {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId || !waitingForSource.has(telegramId)) {
      return next();
    }

    const text = ctx.message.text.trim();

    if (text.startsWith("/") || text.includes("menyu") || text.includes("меню")) {
      waitingForSource.delete(telegramId);
      return next();
    }

    const lang = resolveLang(await getUserLanguage(telegramId));
    const parsedData = normalizeAndParseUrl(text);

    if (!parsedData) {
      await ctx.reply(I18N.invalidUrl[lang], {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
        ]),
      });
      return;
    }

    const { validUrl, domain } = parsedData;

    // DNS tekshiruvi: mavjud bo'lmagan soxta domenlarni to'xtatish
    const domainExists = await isDomainResolvable(domain);
    if (!domainExists) {
      waitingForSource.delete(telegramId);
      await ctx.reply(I18N.domainNotFound(domain)[lang], {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
        ]),
      });
      return;
    }

    waitingForSource.delete(telegramId);

    try {
      const waitMsg = await ctx.reply(I18N.checking(domain)[lang], { parse_mode: "Markdown" });

      const response = await api.post("/scanner/check", { url: validUrl });
      const result = response.data;

      const riskLevel = result?.risk?.level || result?.status || "unknown";
      const riskScore = result?.risk?.score ?? 0;
      const scannerResults = Array.isArray(result?.results) ? result.results : [];

      deepScanSessions.set(telegramId, {
        targetUrl: validUrl,
        scannerResults,
        initialScore: riskScore,
        initialStatus: riskLevel,
      });

      const badge = getStatusBadge(riskLevel);

      let message =
        `🔍 *Manba tekshiruvi natijasi:*\n\n` +
        `🌐 *Domen:* \`${domain}\`\n` +
        `🛡️ *Xavf darajasi:* ${badge}\n` +
        `🎯 *Xavf bali:* ${riskScore}/100\n`;

      const buttons: any[][] = [];

      // Havola xavfli deb topilsa chuqur tahlil chiqarilmaydi
      if (riskLevel === "dangerous") {
        message += `\n⚠️ *Diqqat:* Ushbu manba xavfli deb topildi. Saytga kirish qatʼiyan tavsiya etilmaydi!`;
      } else {
        message += `\n_Batafsil tahlil kerak bo‘lsa, quyidagi tugmani bosing._`;
        buttons.push([
          Markup.button.callback(I18N.buttons.deepScan[lang], "deep_scan"),
        ]);
      }

      buttons.push([
        Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu"),
      ]);

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        waitMsg.message_id,
        undefined,
        message,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );

    } catch (error) {
      console.error("❌ Source URL check error:", error);
      await ctx.reply(I18N.errors.general[lang], Markup.inlineKeyboard([
        [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
      ]));
    }
  });

  // 3. Chuqur tahlilni ishga tushirish
  bot.action("deep_scan", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id.toString();
      const session = deepScanSessions.get(telegramId);
      const lang = resolveLang(await getUserLanguage(telegramId));

      if (!session || !session.targetUrl) {
        await ctx.reply(I18N.notFound[lang], Markup.inlineKeyboard([
          [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
        ]));
        return;
      }

      const statusMsg = await ctx.reply(I18N.deepScanStarted(session.targetUrl)[lang]);

      const response = await api.post("/scanner/deep-scan", {
        url: session.targetUrl,
      });

      const result = response.data;
      const deepScan = result?.deepScan || result?.result?.raw || {};
      const resultUrl = deepScan?.resultUrl || result?.result?.raw?.resultUrl;

      // Agar URLScan xatolik bilan qaytsa (masalan, HTTP 400)
      if (!resultUrl && (result?.message?.includes("xatosi") || result?.result?.message?.includes("xatosi"))) {
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          statusMsg.message_id,
          undefined,
          I18N.deepScanFailed[lang],
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
            ]),
          }
        );
        deepScanSessions.delete(telegramId);
        return;
      }

      if (resultUrl) {
        session.resultUrl = resultUrl;
      }

      const readyStatus = result?.status || result?.result?.status;

      // Agar natija darhol tayyor bo'lsa
      if (readyStatus && readyStatus !== "unknown" && !deepScan?.pending) {
        const finalStatus = (session.initialStatus === "dangerous" || readyStatus === "dangerous")
          ? "dangerous"
          : (session.initialStatus === "suspicious" || readyStatus === "suspicious")
            ? "suspicious"
            : readyStatus;

        const badge = getStatusBadge(finalStatus);
        const readyMessage =
          `🔬 *Chuqur tahlil natijasi:*\n\n` +
          `🌐 *Manzil:* ${session.targetUrl}\n` +
          `🛡️ *Yakuniy holati:* ${badge}\n\n` +
          `${result?.message || result?.result?.message || ""}`;

        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          statusMsg.message_id,
          undefined,
          readyMessage,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
            ]),
          }
        );
        deepScanSessions.delete(telegramId);
        return;
      }

      // Agar tahlil navbatda davom etayotgan bo'lsa
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        statusMsg.message_id,
        undefined,
        I18N.deepScanPending[lang],
        Markup.inlineKeyboard([
          [Markup.button.callback(I18N.buttons.checkResult[lang], "check_deep_scan")],
          [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
        ])
      );

    } catch (error) {
      console.error("❌ Deep scan handler error:", error);
      const lang = resolveLang(await getUserLanguage(ctx.from.id.toString()));
      await ctx.reply(I18N.errors.general[lang], Markup.inlineKeyboard([
        [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
      ]));
    }
  });

  // 4. Chuqur tahlil natijasini tekshirish (Polling)
  bot.action("check_deep_scan", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id.toString();
      const session = deepScanSessions.get(telegramId);
      const lang = resolveLang(await getUserLanguage(telegramId));

      if (!session || !session.resultUrl) {
        await ctx.reply(I18N.notFound[lang], Markup.inlineKeyboard([
          [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
        ]));
        return;
      }

      const chatId = ctx.chat?.id;
      const messageId =
        "message" in ctx.callbackQuery && ctx.callbackQuery.message
          ? ctx.callbackQuery.message.message_id
          : undefined;

      const response = await api.post("/scanner/deep-scan/status", {
        resultUrl: session.resultUrl,
        results: session.scannerResults || [],
      });

      const data = response.data;
      const result = data?.result;
      const raw = result?.raw && typeof result.raw === "object" ? result.raw : {};

      // Hali tahlil yakunlanmagan bo'lsa
      if (raw?.pending === true) {
        if (chatId && messageId) {
          await ctx.telegram.editMessageText(
            chatId,
            messageId,
            undefined,
            I18N.deepScanPending[lang],
            Markup.inlineKeyboard([
              [Markup.button.callback(I18N.buttons.checkResult[lang], "check_deep_scan")],
              [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
            ])
          );
        }
        return;
      }

      // Tahlillarni birlashtirish
      const deepStatus = result?.status || "unknown";

      let finalStatus = deepStatus;
      if (session.initialStatus === "dangerous" || deepStatus === "dangerous") {
        finalStatus = "dangerous";
      } else if (session.initialStatus === "suspicious" || deepStatus === "suspicious") {
        finalStatus = "suspicious";
      }

      const finalScore = Math.max(session.initialScore || 0, data?.finalRisk?.risk?.score ?? 0);
      const badge = getStatusBadge(finalStatus);

      const message =
        `🔬 *Chuqur tahlil natijasi:*\n\n` +
        `🌐 *Manzil:* ${session.targetUrl}\n` +
        `🛡️ *Yakuniy xavf darajasi:* ${badge}\n` +
        `🎯 *Xavf bali:* ${finalScore}/100\n\n` +
        `${result?.message || ""}`;

      if (chatId && messageId) {
        await ctx.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          message,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
            ]),
          }
        );
      } else {
        await ctx.reply(message, {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
          ]),
        });
      }

      deepScanSessions.delete(telegramId);

    } catch (error) {
      console.error("❌ Check deep scan error:", error);
      const lang = resolveLang(await getUserLanguage(ctx.from.id.toString()));
      await ctx.reply(I18N.errors.general[lang], Markup.inlineKeyboard([
        [Markup.button.callback(I18N.buttons.mainMenu[lang], "main_menu")],
      ]));
    }
  });
}