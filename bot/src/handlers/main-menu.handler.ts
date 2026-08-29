import { Markup } from "telegraf";
import { ADMIN_TELEGRAM_ID } from "../config/config";

export async function sendMainMenu(ctx: any, language: string) {
  const telegramUser = ctx.from;

  const displayName =
    [telegramUser.first_name, telegramUser.last_name]
      .filter(Boolean)
      .join(" ") || "Foydalanuvchi";

  // 🇷🇺 Русский
  if (language === "ru") {
    const buttons: any[][] = [
      [Markup.button.callback("📱 Проверить файл / приложение", "check_file")],
      [Markup.button.callback("🌐 Проверить ссылку", "check_source")],
      [Markup.button.callback("📱 Проверить номер", "check_phone")],
      [Markup.button.callback("📚 База данных", "database")],
      [
        Markup.button.callback("👤 Мой профиль", "profile"),
        Markup.button.callback("⚙️ Настройки", "settings"),
      ],
      [Markup.button.callback("ℹ️ О боте", "about")],
    ];

    if (ADMIN_TELEGRAM_ID === telegramUser.id.toString()) {
      buttons.push([Markup.button.callback("🔐 Админ-панель", "admin_panel")]);
    }

    await ctx.reply(
      `🛡 CyberPosbon\n\n` +
        `Здравствуйте, ${displayName}!\n\n` +
        `Выберите необходимую функцию:`,
      Markup.inlineKeyboard(buttons),
    );

    return;
  }

  // 🇺🇿 Ўзбек (кирилл)
  if (language === "uz_cyr") {
    const buttons: any[][] = [
      [Markup.button.callback("📱 Файл / иловани текшириш", "check_file")],
      [Markup.button.callback("🌐 Ҳаволани текшириш", "check_source")],
      [Markup.button.callback("📱 Рақамни текшириш", "check_phone")],
      [Markup.button.callback("📚 Маълумотлар базаси", "database")],
      [
        Markup.button.callback("👤 Профилим", "profile"),
        Markup.button.callback("⚙️ Созламалар", "settings"),
      ],
      [Markup.button.callback("ℹ️ Бот ҳақида", "about")],
    ];

    if (ADMIN_TELEGRAM_ID === telegramUser.id.toString()) {
      buttons.push([Markup.button.callback("🔐 Админ панели", "admin_panel")]);
    }

    await ctx.reply(
      `🛡 CyberPosbon\n\n` +
        `Ассалому алайкум, ${displayName}!\n\n` +
        `Керакли хизматни танланг:`,
      Markup.inlineKeyboard(buttons),
    );

    return;
  }

  // 🇺🇿 O‘zbek lotin
  const buttons: any[][] = [
    [Markup.button.callback("📱 Fayl / ilovani tekshirish", "check_file")],
    [Markup.button.callback("🌐 Havolani tekshirish", "check_source")],
    [Markup.button.callback("📱 Raqamni tekshirish", "check_phone")],
    [Markup.button.callback("📚 Ma’lumotlar bazasi", "database")],
    [
      Markup.button.callback("👤 Mening profilim", "profile"),
      Markup.button.callback("⚙️ Sozlamalar", "settings"),
    ],
    [Markup.button.callback("ℹ️ Bot haqida", "about")],
  ];

  if (ADMIN_TELEGRAM_ID === telegramUser.id.toString()) {
    buttons.push([Markup.button.callback("🔐 Admin panel", "admin_panel")]);
  }

  await ctx.reply(
    `🛡 CyberPosbon\n\n` +
      `Assalomu alaykum, ${displayName}!\n\n` +
      `Kerakli xizmatni tanlang:`,
    Markup.inlineKeyboard(buttons),
  );
}
