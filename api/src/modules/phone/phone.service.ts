import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PhoneNumberUtil, PhoneNumberFormat, PhoneNumberType } from 'google-libphonenumber';
import { PrismaService } from '../../prisma/prisma.service';
import { FraudCategory } from '@prisma/client';
import { PhoneOsintService } from './phone-osint.service';

const phoneUtil = PhoneNumberUtil.getInstance();

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
    constructor(
        private readonly prisma: PrismaService,
        private readonly osintService: PhoneOsintService,
    ) { }

    /**
     * Raqamni tekshirish va xalqaro E.164 formatiga keltirish
     */
    normalizePhoneNumber(rawNumber: string, defaultCountry: string = 'UZ'): {
        formattedNumber: string;
        countryCode: string;
        isValid: boolean;
        operator?: string;
        isVoipLocal?: boolean;
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
            const numberType = phoneUtil.getNumberType(parsed);

            let operator = 'Nomaʼlum operator';
            if (countryCode === 'UZ' && formattedNumber.length === 13) {
                const prefix = formattedNumber.substring(4, 6);
                operator = UZ_OPERATOR_PREFIXES[prefix] || 'Mahalliy provayder';
            }

            const isVoipLocal = numberType === PhoneNumberType.VOIP;

            return {
                formattedNumber,
                countryCode,
                isValid,
                operator,
                isVoipLocal,
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
     * Telefon raqamini bazadan, VoIP va Web OSINT modullaridan tekshirish
     */
    async checkNumber(rawNumber: string) {
        const meta = this.normalizePhoneNumber(rawNumber);
        if (!meta.isValid) {
            throw new BadRequestException('Kiritilgan telefon raqami yaroqsiz formatda.');
        }

        // 1. Bazadagi shikoyatlarni olish
        const record = await this.prisma.fraudNumber.findUnique({
            where: { phoneNumber: meta.formattedNumber },
            include: {
                reports: {
                    select: { category: true, comment: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });

        // 2. VoIP va liniya turini aniqlash (Mahalliy libphonenumber orqali)
        const isVoip = Boolean(meta.isVoipLocal);
        const lineType = isVoip ? 'VoIP / Virtual raqam' : 'Mobil / SIM-karta';

        // 3. Web OSINT tekshiruvi (Ochiq internet manbalari bo'yicha firibgarlik izlari)
        const osint = await this.osintService.searchFraudTraces(meta.formattedNumber);

        // 4. Xavf balini hisoblash
        let riskScore = 0;
        const reportsCount = record?.reportsCount || 0;

        if (record?.isVerified) {
            riskScore = 100;
        } else {
            riskScore = Math.min(50, reportsCount * 15);
            if (isVoip) {
                riskScore = Math.min(100, riskScore + 30);
            }
            if (osint.found) {
                riskScore = Math.min(100, riskScore + 35);
            }
        }

        // 5. Xavf darajasini belgilash
        let riskLevel: 'safe' | 'suspicious' | 'dangerous' = 'safe';
        let message = 'Ushbu raqam bo‘yicha tizimda firibgarlik shikoyatlari mavjud emas.';

        if (record?.isVerified || riskScore >= 70) {
            riskLevel = 'dangerous';
            message = '🚨 Diqqat! Ushbu raqam yuqori xavfli firibgar raqam deb topildi.';
        } else if (riskScore >= 35 || reportsCount >= 3 || isVoip || osint.found) {
            riskLevel = 'suspicious';
            if (osint.found) {
                message = `⚠️ Internetdagi ochiq manbalarda ushbu raqam shubhali to‘lovlar yoki firibgarlik bilan bog‘liq holda tilga olingan.`;
            } else if (isVoip) {
                message = '⚠️ Ogohlantirish! Bu internet orqali olingan virtual (VoIP) raqam. Anonim firibgarlar bunday raqamlardan tez-tez foydalanadi.';
            } else {
                message = '🟡 Ushbu raqam ustidan shubhali holatlar bo‘yicha shikoyatlar mavjud.';
            }
        } else if (reportsCount > 0) {
            riskLevel = 'safe';
            message = `ℹ️ Ushbu raqam bo‘yicha ${reportsCount} ta tekshirilmagan shikoyat mavjud, ammo to‘liq xavfli deb hisoblash uchun yetarli emas.`;
        }

        return {
            phoneNumber: meta.formattedNumber,
            countryCode: meta.countryCode,
            operator: meta.operator,
            lineType,
            isVoip,
            isReported: reportsCount > 0,
            reportsCount,
            riskScore,
            riskLevel,
            isVerified: record?.isVerified || false,
            osintFound: osint.found,
            osintSources: osint.sources,
            message,
        };
    }

    /**
     * Foydalanuvchi tomonidan shikoyat qoldirish
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

        await this.prisma.numberReport.create({
            data: {
                phoneNumberId: fraudNumber.id,
                reportedBy: dto.reportedBy,
                category: dto.category,
                comment: dto.comment,
            },
        });

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

    /**
     * Moderator uchun: Faqat tasdiqlanmagan (kutilayotgan) shikoyatlarni olish
     */
    async getPendingReports(limit = 10) {
        // 1. So'nggi shikoyatlarni olish (zaxirasi bilan)
        const reports = await this.prisma.numberReport.findMany({
            take: limit * 2,
            orderBy: { createdAt: 'desc' },
        });

        // 2. Tegishli raqamlarni biriktirish
        const enrichedReports = await Promise.all(
            reports.map(async (report) => {
                const fraudRecord = await this.prisma.fraudNumber.findUnique({
                    where: { id: report.phoneNumberId },
                    select: {
                        phoneNumber: true,
                        operator: true,
                        riskScore: true,
                        reportsCount: true,
                        isVerified: true,
                    },
                });
                return {
                    ...report,
                    fraudNumber: fraudRecord,
                };
            })
        );

        // 3. Faqat hali tasdiqlanmagan (isVerified !== true) raqamlarni qoldirish
        return enrichedReports
            .filter((item) => !item.fraudNumber?.isVerified)
            .slice(0, limit);
    }
    /**
     * Moderator uchun: Raqamni rasman tasdiqlash (Qora ro'yxat)
     */
    async verifyFraudNumber(phoneNumber: string) {
        const meta = this.normalizePhoneNumber(phoneNumber);
        if (!meta.isValid) {
            throw new BadRequestException('Telefon raqami yaroqsiz formatda.');
        }

        const record = await this.prisma.fraudNumber.upsert({
            where: { phoneNumber: meta.formattedNumber },
            update: {
                isVerified: true,
                riskScore: 100,
            },
            create: {
                phoneNumber: meta.formattedNumber,
                countryCode: meta.countryCode,
                operator: meta.operator,
                reportsCount: 1,
                riskScore: 100,
                isVerified: true,
            },
        });

        return {
            success: true,
            message: 'Raqam muvaffaqiyatli rasmiy qora ro‘yxatga olindi.',
            record,
        };
    }

    /**
     * Moderator uchun: Soxta/noto'g'ri shikoyatni o'chirish va statistikani qayta hisoblash
     */
    async dismissReport(reportId: string) {
        const report = await this.prisma.numberReport.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            throw new NotFoundException('Bunday shikoyat topilmadi.');
        }

        const fraudRecord = await this.prisma.fraudNumber.findUnique({
            where: { id: report.phoneNumberId },
        });

        // Shikoyatni o'chirish
        await this.prisma.numberReport.delete({
            where: { id: reportId },
        });

        // Agar tegishli raqam mavjud bo'lsa, statistikasini qayta hisoblash
        if (fraudRecord) {
            const remainingReports = Math.max(0, fraudRecord.reportsCount - 1);
            const newScore = fraudRecord.isVerified ? 100 : Math.min(100, remainingReports * 15);

            await this.prisma.fraudNumber.update({
                where: { id: fraudRecord.id },
                data: {
                    reportsCount: remainingReports,
                    riskScore: newScore,
                },
            });
        }

        return {
            success: true,
            message: 'Shikoyat muvaffaqiyatli o‘chirildi va ball qayta hisoblandi.',
        };
    }
}