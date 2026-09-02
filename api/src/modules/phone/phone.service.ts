import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';
import { PrismaService } from '../../prisma/prisma.service';
import { FraudCategory } from '@prisma/client';

const phoneUtil = PhoneNumberUtil.getInstance();

// O'zbekiston prefikslari bo'yicha operatorlar xaritasi
const UZ_OPERATOR_PREFIXES: Record<string, string> = {
    '90': 'Beeline',
    '91': 'Beeline',
    '93': 'Ucell',
    '94': 'Ucell',
    '95': 'UzMobile (CDMA/GSM)',
    '97': 'Mobiuz',
    '88': 'Mobiuz',
    '98': 'Perfectum Mobile',
    '99': 'UzMobile',
    '77': 'UzMobile',
    '33': 'Humans',
    '20': 'OQ',
    '71': 'Shahar telefoni (Toshkent)',
};

@Injectable()
export class PhoneService {
    private readonly logger = new Logger(PhoneService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Raqamni tekshirish va xalqaro E.164 formatiga keltirish (+998XXXXXXXXX)
     */
    normalizePhoneNumber(rawNumber: string, defaultCountry: string = 'UZ'): {
        formattedNumber: string;
        countryCode: string;
        isValid: boolean;
        operator?: string;
    } {
        try {
            let cleaned = rawNumber.trim().replace(/[\s\-\(\)]/g, '');
            if (!cleaned.startsWith('+') && cleaned.startsWith('998')) {
                cleaned = `+${cleaned}`;
            } else if (!cleaned.startsWith('+') && cleaned.length === 9) {
                cleaned = `+998${cleaned}`;
            }

            const parsed = phoneUtil.parseAndKeepRawInput(cleaned, defaultCountry);
            const isValid = phoneUtil.isValidNumber(parsed);
            const formattedNumber = phoneUtil.format(parsed, PhoneNumberFormat.E164);
            const countryCode = phoneUtil.getRegionCodeForNumber(parsed) || defaultCountry;

            let operator = 'Nomaʼlum operator';
            if (countryCode === 'UZ' && formattedNumber.length === 13) {
                const prefix = formattedNumber.substring(4, 6);
                operator = UZ_OPERATOR_PREFIXES[prefix] || 'Mahalliy provayder';
            }

            return {
                formattedNumber,
                countryCode,
                isValid,
                operator,
            };
        } catch (err) {
            return {
                formattedNumber: rawNumber,
                countryCode: defaultCountry,
                isValid: false,
            };
        }
    }

    /**
     * Telefon raqamini bazadan tekshirish va xavf darajasini hisoblash
     */
    async checkNumber(rawNumber: string) {
        const meta = this.normalizePhoneNumber(rawNumber);
        if (!meta.isValid) {
            throw new BadRequestException('Kiritilgan telefon raqami yaroqsiz formatda.');
        }

        const record = await this.prisma.fraudNumber.findUnique({
            where: { phoneNumber: meta.formattedNumber },
            include: {
                reports: {
                    select: {
                        category: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });

        if (!record) {
            return {
                phoneNumber: meta.formattedNumber,
                countryCode: meta.countryCode,
                operator: meta.operator,
                isReported: false,
                reportsCount: 0,
                riskScore: 0,
                riskLevel: 'safe' as const,
                categories: [],
                message: 'Ushbu raqam bo‘yicha tizimda firibgarlik shikoyatlari mavjud emas.',
            };
        }

        // Xavf toifalarini guruhlash
        const categoryCounts: Record<string, number> = {};
        for (const r of record.reports) {
            categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
        }

        // 🛡️ Soxta shikoyatlardan himoyalangan xavf baholash
        let riskLevel: 'safe' | 'suspicious' | 'dangerous' = 'safe';
        let message = 'Ushbu raqam bo‘yicha tizimda firibgarlik shikoyatlari mavjud emas.';

        if (record.isVerified) {
            riskLevel = 'dangerous';
            message = '🚨 Diqqat! Ushbu raqam vakolatli organlar yoki tizim administratori tomonidan tasdiqlangan xavfli firibgar raqam hisoblanadi.';
        } else if (record.reportsCount >= 5) {
            riskLevel = 'dangerous';
            message = '🔴 Diqqat! Ushbu raqam ustidan ko‘plab mustaqil foydalanuvchilardan firibgarlik shikoyatlari qayd etilgan.';
        } else if (record.reportsCount >= 3) {
            riskLevel = 'suspicious';
            message = '🟡 Ogohlantirish! Ushbu raqam ustidan bir nechta shubhali holatlar bo‘yicha shikoyat tushgan. Ehtiyot bo‘ling.';
        } else if (record.reportsCount > 0) {
            riskLevel = 'safe';
            message = `ℹ️ Ushbu raqam bo‘yicha ${record.reportsCount} ta tekshirilmagan shikoyat mavjud, ammo bu raqamni to‘liq xavfli deb hisoblash uchun yetarli emas.`;
        }

        return {
            phoneNumber: record.phoneNumber,
            countryCode: record.countryCode || meta.countryCode,
            operator: record.operator || meta.operator,
            isReported: true,
            reportsCount: record.reportsCount,
            riskScore: record.riskScore,
            riskLevel,
            isVerified: record.isVerified,
            categories: Object.keys(categoryCounts),
            lastReports: record.reports,
            message,
        };
    }

    /**
     * Foydalanuvchi tomonidan raqam ustidan shikoyat qoldirish
     */
    async reportNumber(dto: {
        phoneNumber: string;
        reportedBy: string;
        category: FraudCategory;
        comment?: string;
    }) {
        const meta = this.normalizePhoneNumber(dto.phoneNumber);
        if (!meta.isValid) {
            throw new BadRequestException('Kiritilgan telefon raqami yaroqsiz.');
        }

        // Bazada raqam borligini tekshirish yoki yaratish
        let fraudNumber = await this.prisma.fraudNumber.findUnique({
            where: { phoneNumber: meta.formattedNumber },
        });

        if (!fraudNumber) {
            fraudNumber = await this.prisma.fraudNumber.create({
                data: {
                    phoneNumber: meta.formattedNumber,
                    countryCode: meta.countryCode,
                    operator: meta.operator,
                    reportsCount: 0,
                    riskScore: 0,
                },
            });
        }

        // Bir xil foydalanuvchi qayta shikoyat qilganini tekshirish
        const existingReport = await this.prisma.numberReport.findUnique({
            where: {
                phoneNumberId_reportedBy: {
                    phoneNumberId: fraudNumber.id,
                    reportedBy: dto.reportedBy,
                },
            },
        });

        if (existingReport) {
            return {
                success: false,
                alreadyReported: true,
                message: 'Siz allaqachon ushbu raqam ustidan shikoyat qoldirgansiz.',
            };
        }

        // Shikoyatni yozish
        await this.prisma.numberReport.create({
            data: {
                phoneNumberId: fraudNumber.id,
                reportedBy: dto.reportedBy,
                category: dto.category,
                comment: dto.comment,
            },
        });

        // Raqam statistikasini oshirish (Har bir shikoyat 15 ball, tasdiqlangan bo'lsa 100)
        const updatedCount = fraudNumber.reportsCount + 1;
        const newScore = fraudNumber.isVerified ? 100 : Math.min(100, updatedCount * 15);

        await this.prisma.fraudNumber.update({
            where: { id: fraudNumber.id },
            data: {
                reportsCount: updatedCount,
                riskScore: newScore,
            },
        });

        return {
            success: true,
            alreadyReported: false,
            message: 'Shikoyat muvaffaqiyatli qabul qilindi. Jamiyat xavfsizligiga hissa qo‘shganingiz uchun rahmat!',
        };
    }
}