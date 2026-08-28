import { Markup, Telegraf } from "telegraf";

import { api } from "../api/api.client";
import { getUserLanguage } from "../services/user.service";

// URL yuborishini kutayotgan foydalanuvchilar
const waitingForSource = new Set<string>();
const deepScanUrls = new Map<string, string>();
const deepScanResults = new Map<string, any[]>();

export function registerSourceHandler(bot: Telegraf) {
  // =========================================================
  // 🔎 MANBANI TEKSHIRISH
  // =========================================================

  bot.action("check_source", async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id.toString();

      // Foydalanuvchi URL yuborishini kutamiz
      waitingForSource.add(telegramId);

      const language = await getUserLanguage(telegramId);

      // 🇷🇺 Русский
      if (language === "ru") {
        await ctx.reply(
          "🔎 Отправьте ссылку на источник, который хотите проверить:",
          Markup.inlineKeyboard([
            [Markup.button.callback("⬅️ Главное меню", "main_menu")],
          ]),
        );

        return;
      }

      // 🇺🇿 Ўзбек (кирилл)
      if (language === "uz_cyr") {
        await ctx.reply(
          "🔎 Текширмоқчи бўлган манба ҳаволасини юборинг:",
          Markup.inlineKeyboard([
            [Markup.button.callback("⬅️ Асосий меню", "main_menu")],
          ]),
        );

        return;
      }

      // 🇺🇿 O‘zbek (lotin)
      await ctx.reply(
        "🔎 Tekshirmoqchi bo‘lgan manba havolasini yuboring:",
        Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ Asosiy menyu", "main_menu")],
        ]),
      );
    } catch (error) {
      console.error("Source request error:", error);
    }
  });

  // =========================================================
  // 🌐 FOYDALANUVCHI URL YUBORGANDAGI QISM
  // =========================================================

  bot.on("text", async (ctx) => {
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
      text === "⬅️ Asosiy menyu" ||
      text === "⬅️ Асосий меню" ||
      text === "⬅️ Главное меню"
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
      if (!urlText.startsWith("http://") && !urlText.startsWith("https://")) {
        urlText = `https://${urlText}`;
      }

      // URL formatini tekshirish
      const parsedUrl = new URL(urlText);

      // =====================================================
      // 🌐 DOMENNI AJRATISH
      // =====================================================

      const domain = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

      // Domen noto‘g‘ri bo‘lsa
      if (!domain || !domain.includes(".")) {
        await ctx.reply(
          "❌ Yaroqli manba havolasini yuboring.\n\n" +
            "Masalan:\n" +
            "https://example.com",
        );

        return;
      }

      // URL qabul qilindi, endi kutish holatini o‘chiramiz
      waitingForSource.delete(telegramId);

      const language = await getUserLanguage(telegramId);

      // =====================================================
      // 🔎 TEKSHIRILMOQDA
      // =====================================================

      if (language === "ru") {
        await ctx.reply(
          `🔎 Источник проверяется...\n\n` + `🌐 Домен: ${domain}`,
        );
      } else if (language === "uz_cyr") {
        await ctx.reply(
          `🔎 Манба текширилмоқда...\n\n` + `🌐 Домен: ${domain}`,
        );
      } else {
        await ctx.reply(
          `🔎 Manba tekshirilmoqda...\n\n` + `🌐 Domen: ${domain}`,
        );
      }

      // =====================================================
      // 🔌 BACKEND API
      // =====================================================

      const response = await api.post("/scanner/check", {
        url: urlText,
      });

      const result = response.data;

      const riskLevel = result?.risk?.level || result?.status || "unknown";

      const riskScore = result?.risk?.score ?? 0;

      const scannerResults = Array.isArray(result?.results)
        ? result.results
        : [];

      // Chuqur tahlil uchun URL va dastlabki natijalarni saqlaymiz
      deepScanUrls.set(telegramId, urlText);

      deepScanResults.set(telegramId, scannerResults);

      // =====================================================
      // 🔎 TEZKOR TEKSHIRUV NATIJASI
      // =====================================================

      let message = "";

      if (language === "ru") {
        message =
          `🔎 Результат проверки\n\n` +
          `🌐 Домен: ${domain}\n` +
          `📊 Риск: ${riskLevel}\n` +
          `🎯 Балл риска: ${riskScore}\n\n` +
          `ℹ️ Дополнительный глубокий анализ доступен при необходимости.`;
      } else if (language === "uz_cyr") {
        message =
          `🔎 Текширув натижаси\n\n` +
          `🌐 Домен: ${domain}\n` +
          `📊 Хавф даражаси: ${riskLevel}\n` +
          `🎯 Хавф бали: ${riskScore}\n\n` +
          `ℹ️ Зарур бўлса, чуқур таҳлилни давом эттириш мумкин.`;
      } else {
        message =
          `🔎 Tekshiruv natijasi\n\n` +
          `🌐 Domen: ${domain}\n` +
          `📊 Xavf darajasi: ${riskLevel}\n` +
          `🎯 Xavf bali: ${riskScore}\n\n` +
          `ℹ️ Zarur bo‘lsa, chuqur tahlilni davom ettirish mumkin.`;
      }

      // =====================================================
      // 🔘 TUGMALAR
      // =====================================================

      const buttons = [];

      if (riskLevel === "suspicious" || riskLevel === "unknown") {
        buttons.push([
          Markup.button.callback(
            language === "ru"
              ? "🔬 Глубокий анализ"
              : language === "uz_cyr"
                ? "🔬 Чуқур таҳлил"
                : "🔬 Chuqur tahlil",
            "deep_scan",
          ),
        ]);
      }

      buttons.push([
        Markup.button.callback(
          language === "ru"
            ? "⬅️ Главное меню"
            : language === "uz_cyr"
              ? "⬅️ Асосий меню"
              : "⬅️ Asosiy menyu",
          "main_menu",
        ),
      ]);

      await ctx.reply(message, Markup.inlineKeyboard(buttons));
    } catch (error) {
      console.error("Source URL check error:", error);

      // Xatolik bo‘lsa kutish holatini tozalaymiz
      waitingForSource.delete(telegramId);

      const language = await getUserLanguage(telegramId);

      if (language === "ru") {
        await ctx.reply(
          "❌ При проверке источника произошла ошибка.\n\n" +
            "Попробуйте ещё раз.",
        );
      } else if (language === "uz_cyr") {
        await ctx.reply(
          "❌ Манбани текшириш вақтида хатолик юз берди.\n\n" +
            "Қайта уриниб кўринг.",
        );
      } else {
        await ctx.reply(
          "❌ Manbani tekshirish vaqtida xatolik yuz berdi.\n\n" +
            "Qayta urinib ko‘ring.",
        );
      }
    }
  });

  // =========================================================
  // 🔬 CHUQUR TAHLIL
  // =========================================================

  bot.action("deep_scan", async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id.toString();

      // Oldingi tekshirilgan URLni olamiz
      const url = deepScanUrls.get(telegramId);

      if (!url) {
        await ctx.reply(
          "❌ Chuqur tahlil uchun URL topilmadi.\n\n" +
            "Iltimos, manbani qaytadan tekshiring.",
        );
        return;
      }

      const language = await getUserLanguage(telegramId);

      // =====================================================
      // ⏳ CHUQUR TAHLIL BOSHLANMOQDA
      // =====================================================

      if (language === "ru") {
        await ctx.reply(
          `🔬 Глубокий анализ запущен.\n\n` +
            `🌐 URL: ${url}\n\n` +
            `⏳ Анализ выполняется. Результат будет получен позже.`,
        );
      } else if (language === "uz_cyr") {
        await ctx.reply(
          `🔬 Чуқур таҳлил бошланди.\n\n` +
            `🌐 URL: ${url}\n\n` +
            `⏳ Таҳлил амалга оширилмоқда. Натижа кейинроқ олинади.`,
        );
      } else {
        await ctx.reply(
          `🔬 Chuqur tahlil boshlandi.\n\n` +
            `🌐 URL: ${url}\n\n` +
            `⏳ Tahlil amalga oshirilmoqda. Natija keyinroq olinadi.`,
        );
      }

      // =====================================================
      // 🔌 BACKEND DEEP SCAN
      // =====================================================

      const response = await api.post("/scanner/deep-scan", {
        url,
      });

      const result = response.data;

      console.log("🔬 DEEP SCAN RESULT:", result);

      // =====================================================
      // 🔎 DEEP SCAN MA'LUMOTLARI
      // =====================================================

      const deepScan = result?.deepScan || result?.result?.raw || {};

      const pending = deepScan?.pending === true;

      const resultUrl =
        deepScan?.resultUrl || result?.result?.raw?.resultUrl || null;

      // URLScan result URLni saqlaymiz
      if (resultUrl) {
        deepScanUrls.set(telegramId, resultUrl);
      }

      // =====================================================
      // ✅ URLSCAN TAYYOR NATIJA QAYTARDI
      // =====================================================

      const readyStatus = result?.status || result?.result?.status || "unknown";

      if (
        readyStatus === "safe" ||
        readyStatus === "suspicious" ||
        readyStatus === "dangerous"
      ) {
        const emoji =
          readyStatus === "safe"
            ? "🟢"
            : readyStatus === "suspicious"
              ? "🟡"
              : "🔴";

        const readyMessage =
          language === "ru"
            ? `🔬 Результат глубокого анализа\n\n` +
              `${emoji} Статус: ${readyStatus}\n\n` +
              `${result?.message || result?.result?.message || ""}`
            : language === "uz_cyr"
              ? `🔬 Чуқур таҳлил натижаси\n\n` +
                `${emoji} Ҳолати: ${readyStatus}\n\n` +
                `${result?.message || result?.result?.message || ""}`
              : `🔬 Chuqur tahlil natijasi\n\n` +
                `${emoji} Holati: ${readyStatus}\n\n` +
                `${result?.message || result?.result?.message || ""}`;

        await ctx.reply(
          readyMessage,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                language === "ru"
                  ? "⬅️ Главное меню"
                  : language === "uz_cyr"
                    ? "⬅️ Асосий меню"
                    : "⬅️ Asosiy menyu",
                "main_menu",
              ),
            ],
          ]),
        );

        return;
      }

      // =====================================================
      // ⏳ URLSCAN HALI TAYYOR EMAS
      // =====================================================

      if (pending) {
        let message = "";

        if (language === "ru") {
          message =
            `⏳ Глубокий анализ выполняется.\n\n` +
            `🔬 URLScan ещё не завершил анализ.\n\n` +
            `Результат можно проверить позже.`;
        } else if (language === "uz_cyr") {
          message =
            `⏳ Чуқур таҳлил давом этмоқда.\n\n` +
            `🔬 URLScan ҳали таҳлилни якунламаган.\n\n` +
            `Натижани кейинроқ текширишингиз мумкин.`;
        } else {
          message =
            `⏳ Chuqur tahlil davom etmoqda.\n\n` +
            `🔬 URLScan hali tahlilni yakunlamagan.\n\n` +
            `Natijani keyinroq tekshirishingiz mumkin.`;
        }

        await ctx.reply(
          message,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                language === "ru"
                  ? "🔄 Проверить результат"
                  : language === "uz_cyr"
                    ? "🔄 Натижани текшириш"
                    : "🔄 Natijani tekshirish",
                "check_deep_scan",
              ),
            ],
            [
              Markup.button.callback(
                language === "ru"
                  ? "⬅️ Главное меню"
                  : language === "uz_cyr"
                    ? "⬅️ Асосий меню"
                    : "⬅️ Asosiy menyu",
                "main_menu",
              ),
            ],
          ]),
        );

        return;
      }

      // =====================================================
      // ✅ TAYYOR NATIJA
      // =====================================================

      const finalRisk = result?.finalRisk || result?.result?.raw?.finalRisk;

      if (finalRisk) {
        const finalStatus = finalRisk.status || "unknown";

        const finalScore = finalRisk.risk?.score ?? 0;

        const finalLevel = finalRisk.risk?.level || finalStatus;

        if (language === "ru") {
          await ctx.reply(
            `🔬 Результат глубокого анализа\n\n` +
              `🌐 URL: ${url}\n` +
              `📊 Статус: ${finalStatus}\n` +
              `⚠️ Уровень риска: ${finalLevel}\n` +
              `🎯 Балл риска: ${finalScore}`,
          );
        } else if (language === "uz_cyr") {
          await ctx.reply(
            `🔬 Чуқур таҳлил натижаси\n\n` +
              `🌐 URL: ${url}\n` +
              `📊 Ҳолати: ${finalStatus}\n` +
              `⚠️ Хавф даражаси: ${finalLevel}\n` +
              `🎯 Хавф бали: ${finalScore}`,
          );
        } else {
          await ctx.reply(
            `🔬 Chuqur tahlil natijasi\n\n` +
              `🌐 URL: ${url}\n` +
              `📊 Holati: ${finalStatus}\n` +
              `⚠️ Xavf darajasi: ${finalLevel}\n` +
              `🎯 Xavf bali: ${finalScore}`,
          );
        }

        return;
      }

      // =====================================================
      // ⚪ KUTILMAGAN HOLAT
      // =====================================================

      if (language === "ru") {
        await ctx.reply(
          "⚠️ Глубокий анализ запущен, но результат пока не готов.",
        );
      } else if (language === "uz_cyr") {
        await ctx.reply(
          "⚠️ Чуқур таҳлил бошланди, лекин натижа ҳали тайёр эмас.",
        );
      } else {
        await ctx.reply(
          "⚠️ Chuqur tahlil boshlandi, lekin natija hali tayyor emas.",
        );
      }
    } catch (error) {
      console.error("Deep scan handler error:", error);

      const language = await getUserLanguage(ctx.from.id.toString());

      if (language === "ru") {
        await ctx.reply(
          "❌ При выполнении глубокого анализа произошла ошибка.",
        );
      } else if (language === "uz_cyr") {
        await ctx.reply("❌ Чуқур таҳлил вақтида хатолик юз берди.");
      } else {
        await ctx.reply("❌ Chuqur tahlil vaqtida xatolik yuz berdi.");
      }
    }
  });

  // =========================================================
  // 🔄 CHUQUR TAHLIL NATIJASINI TEKSHIRISH
  // =========================================================

  bot.action("check_deep_scan", async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id.toString();

      // =====================================================
      // 🔗 OLDINGI DEEP SCAN URL
      // =====================================================

      const resultUrl = deepScanUrls.get(telegramId);

      if (!resultUrl) {
        await ctx.reply(
          "❌ Chuqur tahlil natijasi topilmadi.\n\n" +
            "Iltimos, manbani qaytadan tekshiring.",
        );
        return;
      }

      const language = await getUserLanguage(telegramId);

      // =====================================================
      // 📦 OLDINGI TEZKOR SCANNER NATIJALARI
      // =====================================================

      const scannerResults = deepScanResults.get(telegramId) || [];

      // =====================================================
      // 🔄 BACKENDDAN DEEP SCAN NATIJASINI OLAMIZ
      // =====================================================

      const response = await api.post("/scanner/deep-scan/status", {
        resultUrl,
        results: scannerResults,
      });

      const data = response.data;

      console.log("🔬 DEEP SCAN STATUS:", data);

      const result = data?.result;

      // =====================================================
      // ⏳ URLSCAN HALI TUGAMAGAN
      // =====================================================

      const raw =
        result?.raw && typeof result.raw === "object" ? result.raw : {};

      const pending = raw?.pending === true;

      if (pending) {
        const message =
          language === "ru"
            ? "⏳ Глубокий анализ ещё выполняется.\n\n🔬 URLScan ещё не завершил анализ.\n\nПопробуйте проверить результат позже."
            : language === "uz_cyr"
              ? "⏳ Чуқур таҳлил ҳали давом этмоқда.\n\n🔬 URLScan ҳали таҳлилни якунламаган.\n\nНатижани кейинроқ текширинг."
              : "⏳ Chuqur tahlil hali davom etmoqda.\n\n🔬 URLScan hali tahlilni yakunlamagan.\n\nNatijani keyinroq tekshiring.";

        await ctx.reply(
          message,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                language === "ru"
                  ? "🔄 Проверить результат"
                  : language === "uz_cyr"
                    ? "🔄 Натижани текшириш"
                    : "🔄 Natijani tekshirish",
                "check_deep_scan",
              ),
            ],
            [
              Markup.button.callback(
                language === "ru"
                  ? "⬅️ Главное меню"
                  : language === "uz_cyr"
                    ? "⬅️ Асосий меню"
                    : "⬅️ Asosiy menyu",
                "main_menu",
              ),
            ],
          ]),
        );

        return;
      }

      // =====================================================
      // ✅ NATIJA TAYYOR
      // =====================================================

      const finalRisk = data?.finalRisk || result?.finalRisk;

      const finalStatus = finalRisk?.status || result?.status || "unknown";

      const finalScore = finalRisk?.risk?.score ?? result?.risk?.score ?? 0;

      const finalLevel =
        finalRisk?.risk?.level || result?.risk?.level || finalStatus;

      // =====================================================
      // 🎨 STATUS EMOJI
      // =====================================================

      let emoji = "⚪";

      if (finalLevel === "safe") {
        emoji = "🟢";
      } else if (finalLevel === "suspicious") {
        emoji = "🟡";
      } else if (finalLevel === "dangerous") {
        emoji = "🔴";
      }

      // =====================================================
      // 📝 NATIJA XABARI
      // =====================================================

      let message = "";

      if (language === "ru") {
        message =
          `🔬 Результат глубокого анализа\n\n` +
          `🌐 URL: ${resultUrl}\n\n` +
          `${emoji} Статус: ${finalStatus}\n` +
          `⚠️ Уровень риска: ${finalLevel}\n` +
          `🎯 Балл риска: ${finalScore}\n\n` +
          `${result?.message || ""}`;
      } else if (language === "uz_cyr") {
        message =
          `🔬 Чуқур таҳлил натижаси\n\n` +
          `🌐 URL: ${resultUrl}\n\n` +
          `${emoji} Ҳолати: ${finalStatus}\n` +
          `⚠️ Хавф даражаси: ${finalLevel}\n` +
          `🎯 Хавф бали: ${finalScore}\n\n` +
          `${result?.message || ""}`;
      } else {
        message =
          `🔬 Chuqur tahlil natijasi\n\n` +
          `🌐 URL: ${resultUrl}\n\n` +
          `${emoji} Holati: ${finalStatus}\n` +
          `⚠️ Xavf darajasi: ${finalLevel}\n` +
          `🎯 Xavf bali: ${finalScore}\n\n` +
          `${result?.message || ""}`;
      }

      // =====================================================
      // 📤 FOYDALANUVCHIGA YAKUNIY NATIJA
      // =====================================================

      await ctx.reply(
        message,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              language === "ru"
                ? "⬅️ Главное меню"
                : language === "uz_cyr"
                  ? "⬅️ Асосий меню"
                  : "⬅️ Asosiy menyu",
              "main_menu",
            ),
          ],
        ]),
      );

      // =====================================================
      // 🧹 NATIJA TAYYOR BO'LGACH TOZALAYMIZ
      // =====================================================

      deepScanUrls.delete(telegramId);
      deepScanResults.delete(telegramId);
    } catch (error) {
      console.error("❌ Check deep scan error:", error);

      const language = await getUserLanguage(ctx.from.id.toString());

      if (language === "ru") {
        await ctx.reply(
          "❌ При получении результата глубокого анализа произошла ошибка.",
        );
      } else if (language === "uz_cyr") {
        await ctx.reply("❌ Чуқур таҳлил натижасини олишда хатолик юз берди.");
      } else {
        await ctx.reply(
          "❌ Chuqur tahlil natijasini olishda xatolik yuz berdi.",
        );
      }
    }
  });
}
