import { Markup, Telegraf } from 'telegraf';
import { api } from '../api/api.client';
import { getUserLanguage } from '../services/user.service';

type SupportedLang = 'uz_lat' | 'uz_cyr' | 'ru';

function resolveLang(rawLang?: string): SupportedLang {
    if (rawLang === 'ru') return 'ru';
    if (rawLang === 'uz_cyr') return 'uz_cyr';
    return 'uz_lat';
}

// Holatlar xotirasi
const waitingForPhone = new Set<string>();

// Shikoyat qoldirish sessiyasi
interface ReportSession {
    phoneNumber: string;
    awaitingCustomComment?: boolean;
}
const reportingSessions = new Map<string, ReportSession>();

const I18N = {
    prompt: {
        uz_lat: '📱 Tekshirmoqchi bo‘lgan telefon raqamingizni kiriting:\n\nMasalan: `+998901234567` yoki `901234567`',
        uz_cyr: '📱 Текширмоқчи бўлган телефон рақамингизни киритинг:\n\nМасалан: `+998901234567` ёки `901234567`',
        ru: '📱 Введите номер телефона, который хотите проверить:\n\nНапример: `+998901234567` или `901234567`',
    },
    invalid: {
        uz_lat: '❌ Yaroqsiz telefon raqami formati!\nIltimos, qaytadan to‘g‘ri formatda kiriting.',
        uz_cyr: '❌ Яроқсиз телефон рақами формати!\nИлтимос, қайтадан тўғри форматда киритинг.',
        ru: '❌ Неверный формат номера телефона!\nПожалуйста, введите корректный номер.',
    },
    reportPrompt: {
        uz_lat: '🚨 Qaysi turdagi firibgarlik holati bo‘yicha shikoyat qoldirmoqchisiz?',
        uz_cyr: '🚨 Қайси турдаги фирибгарлик ҳолати бўйича шикоят қолдирмоқчисиз?',
        ru: '🚨 По какой категории мошенничества вы хотите пожаловаться?',
    },
    customCommentPrompt: {
        uz_lat: '✍️ Firibgarlik holati yoki turini qisqacha yozib qoldiring:\n\n_Masalan: Telegram orqali soxta yutuq vaʼda qilib pul talab qildi._',
        uz_cyr: '✍️ Фирибгарлик ҳолати ёки турини қисқача ёзиб қолдиринг:\n\n_Масалан: Telegram орқали сохта ютуқ ваъда қилиб пул талаб қилди._',
        ru: '✍️ Опишите кратко ситуацию или тип мошенничества:\n\n_Например: Обещали выигрыш в Telegram и требовали деньги._',
    },
    reportCanceled: {
        uz_lat: '❌ Shikoyat qoldirish bekor qilindi.',
        uz_cyr: '❌ Шикоят қолдириш бекор қилинди.',
        ru: '❌ Отправка жалобы отменена.',
    },
    lineType: {
        voip: {
            uz_lat: '🌐 Virtual (VoIP / Internet raqam)',
            uz_cyr: '🌐 Виртуал (VoIP / Интернет рақам)',
            ru: '🌐 Виртуальный (VoIP)',
        },
        regular: {
            uz_lat: '📱 Mobil / SIM-karta',
            uz_cyr: '📱 Мобил / SIM-карта',
            ru: '📱 Мобильный / SIM-карта',
        },
    },
    osintAlert: {
        uz_lat: '🌐 *Web OSINT:* Ochiq internet manbalarida shubhali izlar topildi ⚠️\n',
        uz_cyr: '🌐 *Web OSINT:* Очиқ интернет манбаларида шубҳали излар топилди ⚠️\n',
        ru: '🌐 *Web OSINT:* Найдены подозрительные следы в открытых источниках ⚠️\n',
    },
    buttons: {
        mainMenu: { uz_lat: '⬅️ Asosiy menyu', uz_cyr: '⬅️ Асосий меню', ru: '⬅️ Главное меню' },
        cancel: { uz_lat: '❌ Bekor qilish', uz_cyr: '❌ Бекор қилиш', ru: '❌ Отмена' },
        report: { uz_lat: '🚨 Shikoyat qoldirish', uz_cyr: '🚨 Шикоят қолдириш', ru: '🚨 Пожаловаться' },
        bankScam: { uz_lat: '💳 Soxta bank / SMS kod', uz_cyr: '💳 Сохта банк / SMS код', ru: '💳 Фальшивый банк / SMS' },
        fishingSms: { uz_lat: '🔗 Fishing havola / SMS', uz_cyr: '🔗 Фишинг ҳавола / SMS', ru: '🔗 Фишинг ссылка / SMS' },
        olxDelivery: { uz_lat: '📦 OLX / Yetkazib berish', uz_cyr: '📦 OLX / Доставка', ru: '📦 OLX / Доставка' },
        other: { uz_lat: '⚠️ Boshqa firibgarlik', uz_cyr: '⚠️ Бошқа фирибгарлик', ru: '⚠️ Другое мошенничество' },
    },
};

export function registerPhoneHandler(bot: Telegraf) {

    // 1. Asosiy menyudan "Raqamni tekshirish" bosilganda
    bot.action('check_phone', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const telegramId = ctx.from.id.toString();
            waitingForPhone.add(telegramId);
            reportingSessions.delete(telegramId);

            const lang = resolveLang(await getUserLanguage(telegramId));
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback(I18N.buttons.mainMenu[lang], 'main_menu')],
            ]);

            if (ctx.callbackQuery && 'message' in ctx.callbackQuery) {
                await ctx.editMessageText(I18N.prompt[lang], { parse_mode: 'Markdown', ...keyboard });
                return;
            }

            await ctx.reply(I18N.prompt[lang], { parse_mode: 'Markdown', ...keyboard });
        } catch (error) {
            console.error('❌ Phone action error:', error);
        }
    });

    // 2. Foydalanuvchi matn yozganda (Raqam yoki Boshqa turdagi izoh)
    bot.on('text', async (ctx, next) => {
        const telegramId = ctx.from?.id.toString();
        if (!telegramId) return next();

        const text = ctx.message.text.trim();
        const lang = resolveLang(await getUserLanguage(telegramId));

        // Menyu buyruqlari kelganda holatlarni tozalash
        if (text.startsWith('/') || text.includes('menyu') || text.includes('меню')) {
            waitingForPhone.delete(telegramId);
            reportingSessions.delete(telegramId);
            return next();
        }

        // A) Agar foydalanuvchi "Boshqa firibgarlik" uchun izoh kiritayotgan bo'lsa
        const session = reportingSessions.get(telegramId);
        if (session && session.awaitingCustomComment) {
            try {
                const response = await api.post('/phone/report', {
                    phoneNumber: session.phoneNumber,
                    reportedBy: telegramId,
                    category: 'OTHER',
                    comment: text,
                });

                reportingSessions.delete(telegramId);

                await ctx.reply(response.data.message, {
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback(I18N.buttons.mainMenu[lang], 'main_menu')],
                    ]),
                });
                return;
            } catch (err: any) {
                console.error('❌ Send custom report error:', err);
                await ctx.reply('Shikoyatni qabul qilishda xatolik yuz berdi.');
                return;
            }
        }

        // B) Raqam kiritilishi kutilayotgan bo'lsa
        if (waitingForPhone.has(telegramId)) {
            try {
                const response = await api.post('/phone/check', { phoneNumber: text });
                const data = response.data;
                waitingForPhone.delete(telegramId);

                reportingSessions.set(telegramId, { phoneNumber: data.phoneNumber });

                let badge = '🟢 XAVFSIZ / БЕЗОПАСНЫЙ';
                if (data.riskLevel === 'dangerous') badge = '🔴 XAVFLI (FIRIBGARLIK GUMONI)';
                else if (data.riskLevel === 'suspicious') badge = '🟡 SHUBHALI';

                const lineTypeLabel = data.isVoip
                    ? I18N.lineType.voip[lang]
                    : I18N.lineType.regular[lang];

                let message =
                    `📱 *Telefon raqami tekshiruvi:*\n\n` +
                    `📞 *Raqam:* \`${data.phoneNumber}\`\n` +
                    `🏢 *Operator:* ${data.operator || 'Nomaʼlum'}\n` +
                    `📶 *Raqam turi:* ${lineTypeLabel}\n` +
                    `🛡️ *Xavf darajasi:* ${badge}\n` +
                    `🎯 *Xavf bali:* ${data.riskScore ?? 0}/100\n` +
                    `📊 *Qayd etilgan shikoyatlar:* ${data.reportsCount} ta\n`;

                if (data.osintFound) {
                    message += I18N.osintAlert[lang];
                }

                message += `\nℹ️ _${data.message}_`;

                const buttons = [
                    [Markup.button.callback(I18N.buttons.report[lang], 'report_phone')],
                    [Markup.button.callback(I18N.buttons.mainMenu[lang], 'main_menu')],
                ];

                await ctx.reply(message, {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard(buttons),
                });
                return;
            } catch (error: any) {
                const errorMessage = error?.response?.data?.message || I18N.invalid[lang];
                await ctx.reply(errorMessage, {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback(I18N.buttons.mainMenu[lang], 'main_menu')],
                    ]),
                });
                return;
            }
        }

        return next();
    });

    // 3. Shikoyat qoldirish menyusi
    bot.action('report_phone', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const telegramId = ctx.from.id.toString();
            const session = reportingSessions.get(telegramId);
            const lang = resolveLang(await getUserLanguage(telegramId));

            if (!session) {
                await ctx.reply('Raqam maʼlumoti eskirgan. Qaytadan tekshiring.');
                return;
            }

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback(I18N.buttons.bankScam[lang], 'report_cat_BANK_SCAM')],
                [Markup.button.callback(I18N.buttons.fishingSms[lang], 'report_cat_FISHING_SMS')],
                [Markup.button.callback(I18N.buttons.olxDelivery[lang], 'report_cat_OLX_DELIVERY')],
                [Markup.button.callback(I18N.buttons.other[lang], 'report_cat_OTHER')],
                [Markup.button.callback(I18N.buttons.mainMenu[lang], 'main_menu')],
            ]);

            await ctx.reply(`${I18N.reportPrompt[lang]}\n\n📞 Raqam: \`${session.phoneNumber}\``, {
                parse_mode: 'Markdown',
                ...keyboard,
            });
        } catch (err) {
            console.error('❌ Report phone error:', err);
        }
    });

    // 4. Boshqa firibgarlik tanlanganda (Izoh so'rash)
    bot.action('report_cat_OTHER', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const telegramId = ctx.from.id.toString();
            const session = reportingSessions.get(telegramId);
            const lang = resolveLang(await getUserLanguage(telegramId));

            if (!session) {
                await ctx.reply('Sessiya yakunlangan. Iltimos qaytadan urining.');
                return;
            }

            session.awaitingCustomComment = true;
            reportingSessions.set(telegramId, session);

            await ctx.reply(I18N.customCommentPrompt[lang], {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(I18N.buttons.cancel[lang], 'cancel_report_comment')],
                ]),
            });
        } catch (err) {
            console.error('❌ Report OTHER action error:', err);
        }
    });

    // 5. Izoh kiritishni bekor qilish
    bot.action('cancel_report_comment', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const telegramId = ctx.from.id.toString();
            reportingSessions.delete(telegramId);
            const lang = resolveLang(await getUserLanguage(telegramId));

            await ctx.editMessageText(I18N.reportCanceled[lang], {
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(I18N.buttons.mainMenu[lang], 'main_menu')],
                ]),
            });
        } catch (err) {
            console.error('❌ Cancel comment error:', err);
        }
    });

    // 6. Qolgan standart toifalar uchun shikoyat yuborish
    bot.action(/^report_cat_(BANK_SCAM|FISHING_SMS|OLX_DELIVERY)$/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const telegramId = ctx.from.id.toString();
            const category = ctx.match[1];
            const session = reportingSessions.get(telegramId);
            const lang = resolveLang(await getUserLanguage(telegramId));

            if (!session) {
                await ctx.reply('Sessiya yakunlangan. Iltimos qaytadan urining.');
                return;
            }

            const response = await api.post('/phone/report', {
                phoneNumber: session.phoneNumber,
                reportedBy: telegramId,
                category,
            });

            reportingSessions.delete(telegramId);

            await ctx.reply(response.data.message, {
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(I18N.buttons.mainMenu[lang], 'main_menu')],
                ]),
            });
        } catch (err: any) {
            console.error('❌ Send report error:', err);
            await ctx.reply('Shikoyatni qabul qilishda xatolik yuz berdi.');
        }
    });
}