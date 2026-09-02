import { Markup } from "telegraf";
import { ADMIN_TELEGRAM_ID } from "../config/config";

type SupportedLang = "uz_lat" | "uz_cyr" | "ru";

// =========================================================
// 🔧 ADMIN HUQUQI TEKSHIRUVI
// =========================================================

function checkIsAdmin(telegramId?: string | number): boolean {
  if (!ADMIN_TELEGRAM_ID || !telegramId) return false;
  const adminIds = ADMIN_TELEGRAM_ID.split(",").map((id) => id.trim());
  return adminIds.includes(telegramId.toString());
}

// =========================================================
// 🌐 MENYU MATNLARI VA TUGMALARI
// =========================================================

const MENU_DATA: Record<
  SupportedLang,
  {
    greeting: (name: string) => string;
    buttons: {
      checkFile: string;
      checkSource: string;
      checkPhone: string;
      aiChat: string;
      database: string;
      profile: string;
      settings: string;
      about: string;
      admin: string;
    };
  }
> = {
  uz_lat: {
    greeting: (name) =>
      `🛡 *CyberPosbon*\n\nAssalomu alaykum, ${name}!\n\nKerakli xizmatni tanlang:`,
    buttons: {
      checkFile: "📱 Fayl / ilovani tekshirish",
      checkSource: "🌐 Havolani tekshirish",
      checkPhone: "📱 Raqamni tekshirish",
      aiChat: "🤖 AI Yordamchi",
      database: "📚 Ma’lumotlar bazasi",
      profile: "👤 Mening profilim",
      settings: "⚙️ Sozlamalar",
      about: "ℹ️ Bot haqida",
      admin: "🔐 Admin panel",
    },
  },
  uz_cyr: {
    greeting: (name) =>
      `🛡 *CyberPosbon*\n\nАссалому алайкум, ${name}!\n\nКеракли хизматни танланг:`,
    buttons: {
      checkFile: "📱 Файл / иловани текшириш",
      checkSource: "🌐 Ҳаволани текшириш",
      checkPhone: "📱 Рақамни текшириш",
      aiChat: "🤖 AI Ёрдамчи",
      database: "📚 Маълумотлар базаси",
      profile: "👤 Профилим",
      settings: "⚙️ Созламалар",
      about: "ℹ️ Бот ҳақида",
      admin: "🔐 Админ панели",
    },
  },
  ru: {
    greeting: (name) =>
      `🛡 *CyberPosbon*\n\nЗдравствуйте, ${name}!\n\nВыберите необходимую функцию:`,
    buttons: {
      checkFile: "📱 Проверить файл / приложение",
      checkSource: "🌐 Проверить ссылку",
      checkPhone: "📱 Проверить номер",
      aiChat: "🤖 AI Помощник",
      database: "📚 База данных",
      profile: "👤 Мой профиль",
      settings: "⚙️ Настройки",
      about: "ℹ️ О боте",
      admin: "🔐 Админ-панель",
    },
  },
};

// =========================================================
// 📱 ASOSIY MENYUNI YUBORISH / YANGILASH
// =========================================================

export async function sendMainMenu(
  ctx: any,
  language: string = "uz_lat",
  editExisting: boolean = false
) {
  const telegramUser = ctx.from;
  const langKey: SupportedLang =
    language === "ru" || language === "uz_cyr" ? language : "uz_lat";

  const config = MENU_DATA[langKey];
  const displayName = telegramUser
    ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ")
    : "Foydalanuvchi";

  const isAdmin = checkIsAdmin(telegramUser?.id);

  // Tugmalar matritsasi
  const keyboardButtons: any[][] = [
    [Markup.button.callback(config.buttons.checkFile, "check_file")],
    [Markup.button.callback(config.buttons.checkSource, "check_source")],
    [Markup.button.callback(config.buttons.checkPhone, "check_phone")],
    [Markup.button.callback(config.buttons.aiChat, "ai_chat_start")],
    [Markup.button.callback(config.buttons.database, "database")],
    [
      Markup.button.callback(config.buttons.profile, "profile"),
      Markup.button.callback(config.buttons.settings, "settings"),
    ],
    [Markup.button.callback(config.buttons.about, "about")],
  ];

  if (isAdmin) {
    keyboardButtons.push([
      Markup.button.callback(config.buttons.admin, "admin_panel"),
    ]);
  }

  const messageText = config.greeting(displayName);
  const keyboard = Markup.inlineKeyboard(keyboardButtons);

  // Agar mavjud xabarni yangilash kerak bo'lsa (inline tugma bosilganda)
  if (editExisting && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(messageText, {
        parse_mode: "Markdown",
        ...keyboard,
      });
      return;
    } catch (error) {
      console.log("ℹ️ Edit message amalga oshmadi, yangisi yuboriladi:", error);
    }
  }

  // Standart yangi xabar yuborish
  await ctx.reply(messageText, {
    parse_mode: "Markdown",
    ...keyboard,
  });
}

// =========================================================
// 🔘 "main_menu" CALLBACK ACTION HANDLER
// =========================================================

export function registerMainMenuHandler(
  bot: any,
  getUserLanguage: (id: string) => Promise<string>
) {
  bot.action("main_menu", async (ctx: any) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id.toString();
      const language = await getUserLanguage(telegramId);

      // Eski xabarni silliq almashtiramiz
      await sendMainMenu(ctx, language, true);
    } catch (error) {
      console.error("❌ Main menu callback error:", error);
    }
  });

  bot.command("menu", async (ctx: any) => {
    try {
      const telegramId = ctx.from.id.toString();
      const language = await getUserLanguage(telegramId);
      await sendMainMenu(ctx, language, false);
    } catch (error) {
      console.error("❌ /menu command error:", error);
    }
  });
}