import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import {
    Document,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    WidthType,
    HeadingLevel,
    AlignmentType,
    Packer,
} from 'docx';

@Injectable()
export class PhoneExportService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Baza ma'lumotlarini to'plash: Tasdiqlangan raqamlar va xavfli saytlar (Source modeli orqali)
     */
    private async getThreatData() {
        const verifiedNumbers = await this.prisma.fraudNumber.findMany({
            where: { isVerified: true },
            orderBy: { updatedAt: 'desc' },
            include: {
                reports: {
                    select: { category: true, comment: true },
                },
            },
        });

        // Bazadagi barcha xavfli deb belgilangan havolalar
        const maliciousSources = await this.prisma.source.findMany({
            where: {
                status: { in: ['malicious', 'phishing', 'scam', 'dangerous'] },
            },
            orderBy: { createdAt: 'desc' },
        });

        return { verifiedNumbers, maliciousSources };
    }

    /**
     * Excel (.xlsx) faylini shakllantirish
     */
    async generateExcel(): Promise<Buffer> {
        const { verifiedNumbers, maliciousSources } = await this.getThreatData();
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'CyberPosbon System';
        workbook.created = new Date();

        // 1-Varaq: Qora ro'yxatdagi telefon raqamlar
        const numSheet = workbook.addWorksheet('Firibgar Raqamlar');
        numSheet.columns = [
            { header: '№', key: 'index', width: 6 },
            { header: 'Telefon raqam', key: 'phone', width: 22 },
            { header: 'Operator', key: 'operator', width: 18 },
            { header: 'Xavf bali', key: 'riskScore', width: 12 },
            { header: 'Shikoyatlar', key: 'reportsCount', width: 15 },
            { header: 'Toifa', key: 'category', width: 25 },
            { header: 'Sana', key: 'date', width: 20 },
        ];

        verifiedNumbers.forEach((item, idx) => {
            const category = item.reports?.[0]?.category || 'OTHER';
            numSheet.addRow({
                index: idx + 1,
                phone: item.phoneNumber,
                operator: item.operator || 'Nomaʼlum',
                riskScore: `${item.riskScore}%`,
                reportsCount: item.reportsCount,
                category,
                date: new Date(item.updatedAt).toLocaleDateString('uz-UZ'),
            });
        });

        numSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        numSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1E1E2F' },
        };

        // 2-Varaq: Xavfli saytlar va fishing domenlar
        const urlSheet = workbook.addWorksheet('Xavfli Saytlar');
        urlSheet.columns = [
            { header: '№', key: 'index', width: 6 },
            { header: 'Domen', key: 'domain', width: 30 },
            { header: 'To‘liq havola (URL)', key: 'url', width: 45 },
            { header: 'Holati / Sabab', key: 'reason', width: 30 },
            { header: 'Sana', key: 'date', width: 20 },
        ];

        maliciousSources.forEach((item, idx) => {
            urlSheet.addRow({
                index: idx + 1,
                domain: item.domain,
                url: item.url,
                reason: item.reason || item.status,
                date: new Date(item.createdAt).toLocaleDateString('uz-UZ'),
            });
        });

        urlSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        urlSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '7562E0' },
        };

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    /**
     * Word (.docx) hisobotini shakllantirish
     */
    async generateWord(): Promise<Buffer> {
        const { verifiedNumbers, maliciousSources } = await this.getThreatData();

        // 1-Jadval: Raqamlar
        const numberTableRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph('№')], width: { size: 8, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph('Telefon raqam')], width: { size: 28, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph('Operator')], width: { size: 24, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph('Xavf')], width: { size: 20, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph('Shikoyat')], width: { size: 20, type: WidthType.PERCENTAGE } }),
                ],
            }),
            ...verifiedNumbers.map(
                (item, idx) =>
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph(`${idx + 1}`)] }),
                            new TableCell({ children: [new Paragraph(item.phoneNumber)] }),
                            new TableCell({ children: [new Paragraph(item.operator || '-')] }),
                            new TableCell({ children: [new Paragraph(`${item.riskScore}%`)] }),
                            new TableCell({ children: [new Paragraph(`${item.reportsCount}`)] }),
                        ],
                    }),
            ),
        ];

        // 2-Jadval: Xavfli havolalar
        const urlTableRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph('№')], width: { size: 8, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph('Domen / Havola')], width: { size: 52, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph('Tahdid tavsifi')], width: { size: 40, type: WidthType.PERCENTAGE } }),
                ],
            }),
            ...maliciousSources.map(
                (item, idx) =>
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph(`${idx + 1}`)] }),
                            new TableCell({ children: [new Paragraph(item.domain || item.url)] }),
                            new TableCell({ children: [new Paragraph(item.reason || 'Fishing / Firibgarlik manbasi')] }),
                        ],
                    }),
            ),
        ];

        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: [
                        new Paragraph({
                            text: 'CYBERPOSBON — RASMIY TAHIDLAR REESTRI',
                            heading: HeadingLevel.TITLE,
                            alignment: AlignmentType.CENTER,
                        }),
                        new Paragraph({
                            text: `Hujjat shakllantirilgan sana: ${new Date().toLocaleString('uz-UZ')}\n`,
                        }),
                        new Paragraph({
                            text: `1. Tasdiqlangan firibgar raqamlar ro‘yxati (${verifiedNumbers.length} ta)`,
                            heading: HeadingLevel.HEADING_2,
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: numberTableRows,
                        }),
                        new Paragraph({
                            text: `\n2. Xavfli fishing va firibgar saytlar ro‘yxati (${maliciousSources.length} ta)`,
                            heading: HeadingLevel.HEADING_2,
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: urlTableRows,
                        }),
                    ],
                },
            ],
        });

        return await Packer.toBuffer(doc);
    }
}