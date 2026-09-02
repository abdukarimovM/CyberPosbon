import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

interface ChatMessage {
    role: 'user' | 'model';
    parts: [{ text: string }];
}

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private readonly ai: GoogleGenAI;

    private readonly modelName = 'gemini-3.0-flash';
    // Foydalanuvchilar suhbat xotirasi (Memory)
    private readonly chatHistories = new Map<string, ChatMessage[]>();

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.logger.warn('⚠️ GEMINI_API_KEY topilmadi. AI imkoniyatlari ishlamasligi mumkin.');
        }
        this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
    }

    /**
     * Texnik hisobotni oddiy inson tilida tushuntirish
     */
    async explainThreat(data: {
        target: string;
        type: 'file' | 'url';
        riskLevel: string;
        riskScore: number;
        rawDetections?: string[];
        language?: string;
    }): Promise<string> {
        try {
            const lang = data.language || 'uz_lat';
            const prompt = `
Sen "KiberPosbon" milliy kiberxavfsizlik tizimining AI ekspertisan.
Quyida tekshirilgan ${data.type === 'file' ? 'fayl' : 'veb-sayt'} bo'yicha texnik natijalar keltirilgan:
- Manzil/Nomi: ${data.target}
- Xavf darajasi: ${data.riskLevel}
- Xavf bali: ${data.riskScore}/100
- Aniqlangan tahdidlar: ${data.rawDetections?.join(', ') || 'Hech qanday ochiq tahdid yo‘q'}

Vazifang:
1. Oddiy fuqaro tushunadigan tilda 2-3 ta qisqa jumla bilan xulosa ber.
2. Bu nima xavf tug'dirishi mumkinligini (masalan: bank parollari, SMS, shaxsiy ma'lumotlar o'g'irlanishi) aniq ayt.
3. Foydalanuvchiga nima qilish kerakligi bo'yicha aniq amaliy tavsiya ber.
Javobni ${lang === 'ru' ? 'rus' : lang === 'uz_cyr' ? 'o‘zbek kirill' : 'o‘zbek lotin'} tilida, ortiqcha salom-aliksiz, aniq va lo‘nda yoz.
`;

            const response = await this.ai.models.generateContent({
                model: this.modelName,
                contents: prompt,
            });

            return response.text?.trim() || 'Tahlil yakunlandi.';
        } catch (error) {
            this.logger.error('❌ AI explain xatosi:', error);
            return 'Hozirda AI xulosasini shakllantirib bo‘lmadi.';
        }
    }

    /**
     * Universal suhbatdosh (Chat mode)
     */
    async chat(userId: string, userMessage: string, lang: string = 'uz_lat'): Promise<string> {
        try {
            let history = this.chatHistories.get(userId) || [];

            // Kontekst uzunligini chegaralash (oxirgi 10 ta xabar)
            if (history.length > 10) {
                history = history.slice(-10);
            }

            const systemInstruction = `
Sen "KiberPosbon" tizimining do'stona, aqlli va universal AI yordamchisisan.
Asosiy ixtisosliging: Kiberxavfsizlik, raqamli xavfsizlik, firibgarliklardan himoyalanish, IT va texnologiyalar.
Biroq foydalanuvchi bilan boshqa barcha mavzularda ham erkin, odobli, samimiy va lo'nda suhbat qura olasan.
Muloqot tili: ${lang === 'ru' ? 'rus' : lang === 'uz_cyr' ? 'o‘zbek kirill' : 'o‘zbek lotin'}.
Javoblaring juda uzun bo'lmasin, Telegram formatiga mos ixcham va tushunarli bo'lsin.
`;

            const contents = [
                ...history,
                { role: 'user', parts: [{ text: userMessage }] },
            ];

            const response = await this.ai.models.generateContent({
                model: this.modelName,
                contents: contents as any,
                config: {
                    systemInstruction,
                },
            });

            const replyText = response.text?.trim() || 'Kechirasiz, javob shakllantira olmadim.';

            // Tarixni yangilash
            history.push({ role: 'user', parts: [{ text: userMessage }] });
            history.push({ role: 'model', parts: [{ text: replyText }] });
            this.chatHistories.set(userId, history);

            return replyText;
        } catch (error) {
            this.logger.error('❌ AI chat xatosi:', error);
            return 'AI xizmatida vaqtinchalik uzilish yuz berdi. Iltimos, birozdan so‘ng qayta urinib ko‘ring.';
        }
    }

    /**
     * Suhbat tarixini tozalash (foydalanuvchi menyuga chiqqanda)
     */
    clearHistory(userId: string) {
        this.chatHistories.delete(userId);
    }
}