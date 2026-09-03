import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface OsintSearchResult {
    found: boolean;
    matchesCount: number;
    snippets: string[];
    sources: string[];
}

@Injectable()
export class PhoneOsintService {
    private readonly logger = new Logger(PhoneOsintService.name);

    // O'zbekistondagi firibgarlik va kiberxavfsizlikka oid ochiq Telegram kanallari
    private readonly uzTelegramChannels = [
        'iib_kiberxavfsizlik',
        'kiberjinoyat_xavfsizlik',
    ];

    async searchFraudTraces(phoneNumber: string): Promise<OsintSearchResult> {
        const cleanNumber = phoneNumber.replace(/\D/g, ''); // masalan: 998901234567
        const localNumber = cleanNumber.startsWith('998') ? cleanNumber.substring(3) : cleanNumber; // masalan: 901234567

        const sources: string[] = [];
        const snippets: string[] = [];

        // 1. Ktozvonil.net orqali tekshiruv (Xalqaro va MDH)
        try {
            const url = `https://ktozvonil.net/nomer/${cleanNumber}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                },
                timeout: 5000,
            });

            const html = String(response.data || '');
            const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

            const suspiciousPatterns = [
                'мошенник',
                'негатив',
                'есть нюансы',
                'отрицательн',
                'спам',
            ];

            if (suspiciousPatterns.some((pattern) => text.includes(pattern))) {
                this.logger.log(`[OSINT] ${phoneNumber} bo'yicha Ktozvonil da shubha topildi: ${url}`);
                sources.push(url);
                snippets.push('Ktozvonil saytidagi raqam haqida shubhali yoki salbiy maʼlumot aniqlandi.');
            }
        } catch (error: any) {
            this.logger.debug(`Ktozvonil OSINT so‘rovida xatolik: ${error?.message || error}`);
        }

        // 2. O'zbekiston kanallari orqali tekshiruv (t.me/s/... ochiq veb ko'rinishi)
        for (const channel of this.uzTelegramChannels) {
            try {
                const tgUrl = `https://t.me/s/${channel}`;
                const tgResponse = await axios.get(tgUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    },
                    timeout: 4000,
                });

                const tgHtml = String(tgResponse.data || '');
                const tgText = tgHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

                // Raqam to'liq, clean yoki mahalliy formatda postlarda tilga olinganmi
                if (
                    tgText.includes(phoneNumber) ||
                    tgText.includes(cleanNumber) ||
                    (localNumber.length >= 9 && tgText.includes(localNumber))
                ) {
                    const matchedUrl = `https://t.me/${channel}`;
                    this.logger.log(`[OSINT] ${phoneNumber} Telegram @${channel} kanalida topildi: ${matchedUrl}`);
                    sources.push(matchedUrl);
                    snippets.push(`Telegramdagi rasmiy ogohlantirish kanali (@${channel}) postlarida ushbu raqam qayd etilgan.`);
                    break;
                }
            } catch (tgError: any) {
                this.logger.debug(`Telegram @${channel} skanerida xatolik: ${tgError?.message || tgError}`);
            }
        }

        const found = sources.length > 0;

        return {
            found,
            matchesCount: sources.length,
            snippets,
            sources,
        };
    }
}