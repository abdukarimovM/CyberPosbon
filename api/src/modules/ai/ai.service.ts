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
    private readonly chatHistories = new Map<string, ChatMessage[]>();

    // Eng barqaror va yuklamasi kam modellarning ketma-ket zaxira ro'yxati
    private readonly fallbackModels = [
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-3-flash-preview',
        'gemini-2.5-pro',
    ];

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.logger.warn('⚠️ GEMINI_API_KEY topilmadi!');
        }
        this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
    }

    /**
     * Modellarni navbat bilan sinab, birinchisi ishlamasa keyingisiga o'tish mexanizmi
     */
    private async generateWithFallback(contents: any, systemInstruction?: string): Promise<string> {
        let lastError: any = null;

        for (const model of this.fallbackModels) {
            try {
                const response = await this.ai.models.generateContent({
                    model,
                    contents,
                    config: systemInstruction ? { systemInstruction } : undefined,
                });

                const text = response.text?.trim();
                if (text) {
                    return text;
                }
            } catch (err: any) {
                lastError = err;
                this.logger.warn(`⚠️ Model [${model}] javob bermadi (${err?.status || err?.message}). Keyingisiga o'tilmoqda...`);
            }
        }

        this.logger.error('❌ Barcha Gemini modellari rad etildi:', lastError);
        throw lastError;
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
Sen "KiberPosbon" tizimining AI ekspertisan.
${data.type === 'file' ? 'Fayl' : 'Sayt'}: ${data.target}
Xavf darajasi: ${data.riskLevel} (${data.riskScore}/100)
Tahdidlar: ${data.rawDetections?.join(', ') || 'Hech qanday ochiq tahdid yo‘q'}

Vazifa: Oddiy fuqaro tushunadigan tilda 2-3 ta qisqa jumla bilan xulosa va amaliy tavsiya ber.
Til: ${lang === 'ru' ? 'rus' : lang === 'uz_cyr' ? 'o‘zbek kirill' : 'o‘zbek lotin'}.
`;

            return await this.generateWithFallback(prompt);
        } catch (error) {
            return 'Hozirda AI xulosasini shakllantirib bo‘lmadi.';
        }
    }

    /**
     * Universal suhbatdosh (Chat mode)
     */
    async chat(userId: string, userMessage: string, lang: string = 'uz_lat'): Promise<string> {
        try {
            let history = this.chatHistories.get(userId) || [];

            if (history.length > 8) {
                history = history.slice(-8);
            }

            const systemInstruction = `
Sen "CyberPosbon" kiberxavfsizlik Telegram botining rasmiy aqlli AI yo'lko'rsatuvchisisan.
Sening asosiy vazifang — foydalanuvchiga bot imkoniyatlaridan to'g'ri foydalanishni tushuntirish va kiberxavfsizlik bo'yicha maslahat berish.

CyberPosbon boti qanday ishlaydi va foydalanuvchi qayerga nima yuborishi kerak:
1. 📱 APK / Ilova tekshirish:
   - Foydalanuvchiga tushuntir: "Asosiy menyudan '📱 Fayl / ilovani tekshirish' tugmasini bosing va shubhali APK faylni botga yuboring. Tizim uni VirusTotal va ichki skanerlar orqali virus, troyan va zararli ruxsatlarga tekshirib beradi."
   - Bu chatga to'g'ridan-to'g'ri fayl tashlamaslikni, avval menyudagi o'sha bo'limni tanlash kerakligini ayt.
2. 🌐 Veb-sayt / Havola tekshirish:
   - "Asosiy menyudan '🌐 Havolani tekshirish' tugmasini bosing va shubhali havolani (masalan, payme soxta sayti yoki yutuqli fishing link) yuboring. Tizim domen xavfsizligini, Google Safe Browsing va URLScan orqali chuqur tahlil qiladi."
3. 📱 Telefon raqam tekshirish:
   - "Asosiy menyudan '📱 Raqamni tekshirish' bo'limi orqali firibgarlar bazasidagi shubhali raqamlarni qidirish mumkin."
4. 🤖 AI Yordamchi (Hozirgi bo'lim):
   - Sen bilan kiberxavfsizlik, shaxsiy ma'lumotlar himoyasi, fishing xabarlarni aniqlash yoki erkin mavzularda savol-javob qilish mumkin.
   - Suhbatni yakunlash uchun pastdagi "⬅️ Suhbatni tugatish" tugmasini bosib, asosiy menyuga qaytish kifoya.

Muloqot qoidalari:
- Til: ${lang === 'ru' ? 'rus' : lang === 'uz_cyr' ? 'o‘zbek kirill' : 'o‘zbek lotin'}.
- Foydalanuvchi qayerga havola yoki fayl yuborishni so'rasa, tashqi saytlarga (VirusTotal va h.k.) yo'naltirma, aynan ushbu bot tugmalaridan qanday foydalanishni qadamma-qadam tushuntir.
- O'ta rasmiyatchiliksiz, qisqa, tushunarli va do'stona javob ber.
`;

            const contents = [
                ...history,
                { role: 'user', parts: [{ text: userMessage }] },
            ];

            const replyText = await this.generateWithFallback(contents, systemInstruction);

            // Tarixni saqlash
            history.push({ role: 'user', parts: [{ text: userMessage }] });
            history.push({ role: 'model', parts: [{ text: replyText }] });
            this.chatHistories.set(userId, history);

            return replyText;
        } catch (error) {
            return 'AI xizmatida vaqtinchalik uzilish yuz berdi. Iltimos, birozdan so‘ng qayta urinib ko‘ring.';
        }
    }

    clearHistory(userId: string) {
        this.chatHistories.delete(userId);
    }
}