import { Markup, Telegraf } from 'telegraf';
import { api } from '../api/api.client';
import { getUserLanguage } from '../services/user.service';

type SupportedLang = 'uz_lat' | 'uz_cyr' | 'ru';

function resolveLang(rawLang?: string): SupportedLang {
    if (rawLang === 'ru') return 'ru';
    if (rawLang === 'uz_cyr') return 'uz_cyr';
    return 'uz_lat';
}

// AI suhbat rejimida turgan foydalanuvchilar
const activeAiSessions = new Set<string>();

const I18N = {
    welcome: {
        uz_lat:
            '🤖 *KiberPosbon AI Yordamchisi*\n\nAssalomu alaykum! Men sizga kiberxavfsizlik, shubhali xabarlar, akkauntlar himoyasi hamda umumiy mavzularda yordam bera olaman.\n\nSavolingizni yozib qoldiring:',
        uz_cyr:
            '🤖 *KiberPosbon AI Ёрдамчиси*\n\nАссалому алайкум! Мен сизга киберхавфсизлик, шубҳали хабарлар, аккаунтлар ҳимояси ҳамда умумий мавзуларда ёрдам бера оламан.\n\nСаволингизни ёзиб қолдиринг:',
        ru:
            '🤖 *AI-Помощник KiberPosbon*\n\nЗдравствуйте! Я готов помочь вам с вопросами кибербезопасности, защиты аккаунтов, распознавания фишинга, а также по любым общим темам.\n\nЗадайте ваш вопрос:',
    },
    thinking: {
        uz_lat: '💭 AI javob tayyorlamoqda...',
        uz_cyr: '💭 AI жавоб тайёрламоқда...',
        ru: '💭 AI готовит ответ...',
    },
    exitBtn: {
        uz_lat: '⬅️ Suhbatni tugatish',
        uz_cyr: '⬅️ Суҳбатни тугатиш',
        ru: '⬅️ Завершить диалог',
    },
    cleared: {
        uz_lat: 'Suhbat yakunlandi. Asosiy menyudasiz.',
        uz_cyr: 'Суҳбат якунланди. Асосий менюдасиз.',
        ru: 'Диалог завершен. Вы в главном меню.',
    },
};

export function registerAiHandler(bot: Telegraf) {
    // 1. AI rejimini boshlash
    bot.action('ai_chat_start', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const telegramId = ctx.from.id.toString();
            activeAiSessions.add(telegramId);

            const lang = resolveLang(await getUserLanguage(telegramId));

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback(I18N.exitBtn[lang], 'ai_chat_exit')],
            ]);

            if (ctx.callbackQuery && 'message' in ctx.callbackQuery) {
                await ctx.editMessageText(I18N.welcome[lang], {
                    parse_mode: 'Markdown',
                    ...keyboard,
                });
                return;
            }

            await ctx.reply(I18N.welcome[lang], {
                parse_mode: 'Markdown',
                ...keyboard,
            });
        } catch (error) {
            console.error('❌ AI Chat start error:', error);
        }
    });

    // 2. Suhbatdan chiqish
    bot.action('ai_chat_exit', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const telegramId = ctx.from.id.toString();
            activeAiSessions.delete(telegramId);

            // Backenddagi xotirani ham tozalash
            api.post('/ai/clear', { userId: telegramId }).catch(() => { });

            const lang = resolveLang(await getUserLanguage(telegramId));

            if (ctx.callbackQuery && 'message' in ctx.callbackQuery) {
                await ctx.editMessageText(I18N.cleared[lang]);
            } else {
                await ctx.reply(I18N.cleared[lang]);
            }

            // Asosiy menyu amalini chaqirish
            return (bot as any).handleUpdate({
                ...ctx.update,
                callback_query: {
                    ...ctx.callbackQuery,
                    data: 'main_menu',
                },
            });
        } catch (error) {
            console.error('❌ AI Chat exit error:', error);
        }
    });

    // 3. AI suhbat xabarlarini qabul qilish
    bot.on('text', async (ctx, next) => {
        const telegramId = ctx.from?.id.toString();
        if (!telegramId || !activeAiSessions.has(telegramId)) {
            return next();
        }

        const text = ctx.message.text.trim();

        // Agar menyu yoki bekor qilish buyruqlari kelsa
        if (text.startsWith('/') || text.toLowerCase().includes('menyu')) {
            activeAiSessions.delete(telegramId);
            api.post('/ai/clear', { userId: telegramId }).catch(() => { });
            return next();
        }

        const lang = resolveLang(await getUserLanguage(telegramId));

        try {
            // Telegram status: "typing..."
            await ctx.sendChatAction('typing');

            const response = await api.post('/ai/chat', {
                userId: telegramId,
                message: text,
                language: lang,
            });

            const replyMessage = response.data?.reply || 'Kechirasiz, xatolik yuz berdi.';

            await ctx.reply(replyMessage, {
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(I18N.exitBtn[lang], 'ai_chat_exit')],
                ]),
            });
        } catch (error) {
            console.error('❌ AI Chat process error:', error);
            await ctx.reply('⚠️ Xatolik yuz berdi. Iltimos qaytadan urinib ko‘ring.', {
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(I18N.exitBtn[lang], 'ai_chat_exit')],
                ]),
            });
        }
    });
}