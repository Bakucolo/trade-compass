import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { sendPdfReportToTelegram } from './telegramReportService';
import { agentActivityTracker } from './agentActivityService';

const prisma = new PrismaClient();

export interface PlannedTradeItem {
  id: string;
  symbol: string;
  underlyingSymbol?: string | null;
  action: string; // "BUY" | "SELL" | "SHORT" | "COVER" | "BTO" | "STC" | "STO" | "BTC"
  assetType: string; // "STOCK" | "OPTION" | "ETF" | "CRYPTO"
  timeframe: string; // "DAY" | "WEEK"
  orderType: string; // "LIMIT" | "MARKET" | "STOP_LIMIT"
  quantity: number;
  targetPrice?: number | null;
  currentPrice?: number | null;
  stopLoss?: number | null;
  targetExit?: number | null;
  conviction: string; // "HIGH" | "MEDIUM" | "SPECULATIVE"
  rank: number;
  status: string; // "PENDING" | "TRIGGERED" | "EXECUTED" | "CANCELLED"
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlannedTradeDTO {
  symbol: string;
  underlyingSymbol?: string;
  action: string;
  assetType?: string;
  timeframe?: string;
  orderType?: string;
  quantity: number;
  targetPrice?: number;
  stopLoss?: number;
  targetExit?: number;
  conviction?: string;
  notes?: string;
  rank?: number;
}

export interface UpdatePlannedTradeDTO {
  symbol?: string;
  underlyingSymbol?: string;
  action?: string;
  assetType?: string;
  timeframe?: string;
  orderType?: string;
  quantity?: number;
  targetPrice?: number;
  stopLoss?: number;
  targetExit?: number;
  conviction?: string;
  status?: string;
  notes?: string;
  rank?: number;
}

/**
 * Retrieves all planned trades sorted by rank ascending
 */
export async function getPlannedTrades(filter?: { timeframe?: string; status?: string }): Promise<PlannedTradeItem[]> {
  const where: any = {};
  if (filter?.timeframe && filter.timeframe !== 'ALL') {
    where.timeframe = filter.timeframe.toUpperCase();
  }
  if (filter?.status && filter.status !== 'ALL') {
    where.status = filter.status.toUpperCase();
  }

  const trades = await (prisma as any).plannedTrade.findMany({
    where,
    orderBy: [
      { rank: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return trades;
}

/**
 * Creates a new planned trade and assigns the next rank in queue
 */
export async function createPlannedTrade(dto: CreatePlannedTradeDTO): Promise<PlannedTradeItem> {
  const cleanSym = dto.symbol.trim().toUpperCase();
  const cleanAction = (dto.action || 'BUY').trim().toUpperCase();
  const cleanTimeframe = (dto.timeframe || 'DAY').trim().toUpperCase();
  const cleanAsset = (dto.assetType || 'STOCK').trim().toUpperCase();
  const cleanOrder = (dto.orderType || 'LIMIT').trim().toUpperCase();
  const cleanConviction = (dto.conviction || 'HIGH').trim().toUpperCase();

  // Find max rank to append at the end if rank is not provided
  let nextRank = dto.rank;
  if (nextRank === undefined || nextRank === null) {
    const highestRankTrade = await (prisma as any).plannedTrade.findFirst({
      orderBy: { rank: 'desc' },
      select: { rank: true },
    });
    nextRank = (highestRankTrade?.rank || 0) + 1;
  }

  const newTrade = await (prisma as any).plannedTrade.create({
    data: {
      symbol: cleanSym,
      underlyingSymbol: dto.underlyingSymbol ? dto.underlyingSymbol.trim().toUpperCase() : cleanSym.match(/^[A-Z]+/)?.[0] || cleanSym,
      action: cleanAction,
      assetType: cleanAsset,
      timeframe: cleanTimeframe,
      orderType: cleanOrder,
      quantity: Number(dto.quantity) || 1,
      targetPrice: dto.targetPrice !== undefined && dto.targetPrice !== null ? Number(dto.targetPrice) : null,
      stopLoss: dto.stopLoss !== undefined && dto.stopLoss !== null ? Number(dto.stopLoss) : null,
      targetExit: dto.targetExit !== undefined && dto.targetExit !== null ? Number(dto.targetExit) : null,
      conviction: cleanConviction,
      rank: nextRank,
      status: 'PENDING',
      notes: dto.notes ? dto.notes.trim() : null,
    },
  });

  return newTrade;
}

/**
 * Updates an existing planned trade
 */
export async function updatePlannedTrade(id: string, dto: UpdatePlannedTradeDTO): Promise<PlannedTradeItem> {
  const updateData: any = {};
  if (dto.symbol !== undefined) updateData.symbol = dto.symbol.trim().toUpperCase();
  if (dto.underlyingSymbol !== undefined) updateData.underlyingSymbol = dto.underlyingSymbol ? dto.underlyingSymbol.trim().toUpperCase() : null;
  if (dto.action !== undefined) updateData.action = dto.action.trim().toUpperCase();
  if (dto.assetType !== undefined) updateData.assetType = dto.assetType.trim().toUpperCase();
  if (dto.timeframe !== undefined) updateData.timeframe = dto.timeframe.trim().toUpperCase();
  if (dto.orderType !== undefined) updateData.orderType = dto.orderType.trim().toUpperCase();
  if (dto.quantity !== undefined) updateData.quantity = Number(dto.quantity);
  if (dto.targetPrice !== undefined) updateData.targetPrice = dto.targetPrice !== null ? Number(dto.targetPrice) : null;
  if (dto.stopLoss !== undefined) updateData.stopLoss = dto.stopLoss !== null ? Number(dto.stopLoss) : null;
  if (dto.targetExit !== undefined) updateData.targetExit = dto.targetExit !== null ? Number(dto.targetExit) : null;
  if (dto.conviction !== undefined) updateData.conviction = dto.conviction.trim().toUpperCase();
  if (dto.status !== undefined) updateData.status = dto.status.trim().toUpperCase();
  if (dto.notes !== undefined) updateData.notes = dto.notes ? dto.notes.trim() : null;
  if (dto.rank !== undefined) updateData.rank = Number(dto.rank);

  const updated = await (prisma as any).plannedTrade.update({
    where: { id },
    data: updateData,
  });

  return updated;
}

/**
 * Deletes a planned trade and re-normalizes ranks
 */
export async function deletePlannedTrade(id: string): Promise<{ success: boolean }> {
  await (prisma as any).plannedTrade.delete({
    where: { id },
  });

  // Re-normalize ranks
  const remaining = await (prisma as any).plannedTrade.findMany({
    orderBy: { rank: 'asc' },
  });

  for (let i = 0; i < remaining.length; i++) {
    const item = remaining[i];
    if (item.rank !== i + 1) {
      await (prisma as any).plannedTrade.update({
        where: { id: item.id },
        data: { rank: i + 1 },
      });
    }
  }

  return { success: true };
}

/**
 * Reorders the execution queue based on drag-and-drop ID order
 */
export async function reorderPlannedTrades(orderedIds: string[]): Promise<PlannedTradeItem[]> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return getPlannedTrades();
  }

  // Update ranks in parallel or batch
  await Promise.all(
    orderedIds.map((id, index) =>
      (prisma as any).plannedTrade.update({
        where: { id },
        data: { rank: index + 1 },
      })
    )
  );

  return getPlannedTrades();
}

/**
 * Generates an institutional execution plan PDF using PDFKit
 */
export async function generateExecutionPlanPdfBuffer(trades: PlannedTradeItem[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 36, bottom: 25, left: 36, right: 36 },
      bufferPages: true,
      info: {
        Title: 'TradeFlow Tactical Execution Queue',
        Author: 'TradeFlow Management System',
        Subject: 'Daily & Weekly Ranked Trade Execution Plan',
        CreationDate: new Date(),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const colors = {
      primaryNavy: '#0f172a',
      accentIndigo: '#4f46e5',
      accentCyan: '#0284c7',
      emeraldGreen: '#059669',
      roseRed: '#dc2626',
      amberGold: '#d97706',
      slateDark: '#1e293b',
      slateMuted: '#64748b',
      slateLight: '#f1f5f9',
      borderLine: '#cbd5e1',
    };

    const dateFormatted = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // Summary calculations
    const activeTrades = trades.filter((t) => t.status !== 'CANCELLED');
    const dayTrades = activeTrades.filter((t) => t.timeframe === 'DAY');
    const weekTrades = activeTrades.filter((t) => t.timeframe === 'WEEK');
    const totalEstCapital = activeTrades.reduce(
      (acc, t) => acc + (t.quantity * (t.targetPrice || t.currentPrice || 0)),
      0
    );

    // ==========================================
    // 1. TOP HEADER BANNER
    // ==========================================
    doc.rect(36, 36, 540, 58).fill(colors.primaryNavy);
    doc.rect(36, 92, 540, 2).fill(colors.accentIndigo);

    doc.fillColor('#ffffff').fontSize(13.5).font('Helvetica-Bold')
      .text('TRADEFLOW | TACTICAL TRADE EXECUTION QUEUE', 48, 48, { width: 345 });

    doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
      .text(`Generated: ${dateFormatted} at ${timeFormatted} • Horizon: Day & Weekly Execution Plan`, 48, 70, { width: 345 });

    doc.roundedRect(412, 47, 152, 20, 3).fillAndStroke('#1e293b', '#0369a1');
    doc.fillColor('#38bdf8').fontSize(7.5).font('Helvetica-Bold')
      .text('CONFIDENTIAL / INSTITUTIONAL', 412, 53, { align: 'center', width: 152 });

    // ==========================================
    // 2. EXECUTIVE METRICS STRIP
    // ==========================================
    const kpiY = 104;
    const kpiHeight = 44;
    const kpiWidth = 540 / 4 - 6;

    // Card 1: Total Planned
    doc.roundedRect(36, kpiY, kpiWidth, kpiHeight, 4).fillAndStroke('#f8fafc', colors.borderLine);
    doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica-Bold').text('TOTAL PLANNED TRADES', 44, kpiY + 8);
    doc.fillColor(colors.primaryNavy).fontSize(14).font('Helvetica-Bold').text(`${trades.length}`, 44, kpiY + 20);

    // Card 2: Day Horizon
    doc.roundedRect(36 + (kpiWidth + 8) * 1, kpiY, kpiWidth, kpiHeight, 4).fillAndStroke('#f8fafc', colors.borderLine);
    doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica-Bold').text("TODAY'S ORDERS", 36 + (kpiWidth + 8) * 1 + 8, kpiY + 8);
    doc.fillColor(colors.emeraldGreen).fontSize(14).font('Helvetica-Bold').text(`${dayTrades.length} Active`, 36 + (kpiWidth + 8) * 1 + 8, kpiY + 20);

    // Card 3: Week Horizon
    doc.roundedRect(36 + (kpiWidth + 8) * 2, kpiY, kpiWidth, kpiHeight, 4).fillAndStroke('#f8fafc', colors.borderLine);
    doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica-Bold').text('THIS WEEK HORIZON', 36 + (kpiWidth + 8) * 2 + 8, kpiY + 8);
    doc.fillColor(colors.accentCyan).fontSize(14).font('Helvetica-Bold').text(`${weekTrades.length} Planned`, 36 + (kpiWidth + 8) * 2 + 8, kpiY + 20);

    // Card 4: Est Required Capital
    doc.roundedRect(36 + (kpiWidth + 8) * 3, kpiY, kpiWidth, kpiHeight, 4).fillAndStroke('#f8fafc', colors.borderLine);
    doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica-Bold').text('EST. REQUIRED CAPITAL', 36 + (kpiWidth + 8) * 3 + 8, kpiY + 8);
    doc.fillColor(colors.amberGold).fontSize(14).font('Helvetica-Bold').text(
      totalEstCapital > 0 ? `$${Math.round(totalEstCapital).toLocaleString()}` : '$0',
      36 + (kpiWidth + 8) * 3 + 8,
      kpiY + 20
    );

    // ==========================================
    // 3. RANKED TRADES TABLE
    // ==========================================
    const tableTop = 160;
    doc.fillColor(colors.primaryNavy).fontSize(11).font('Helvetica-Bold')
      .text('RANKED ORDER QUEUE & EXECUTION SPECIFICATIONS', 36, tableTop);
    doc.rect(36, tableTop + 16, 540, 1).fill(colors.accentIndigo);

    let curY = tableTop + 22;

    // Table Header Bar
    doc.rect(36, curY, 540, 18).fill(colors.slateDark);
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    doc.text('RANK', 42, curY + 5);
    doc.text('SYMBOL & ACTION', 78, curY + 5);
    doc.text('HORIZON', 180, curY + 5);
    doc.text('ORDER / QTY', 240, curY + 5);
    doc.text('ENTRY LIMIT', 315, curY + 5);
    doc.text('STOP / TARGET', 375, curY + 5);
    doc.text('EST. CAPITAL', 455, curY + 5);
    doc.text('STATUS', 525, curY + 5);

    curY += 18;

    if (trades.length === 0) {
      doc.rect(36, curY, 540, 36).fill('#f8fafc');
      doc.fillColor(colors.slateMuted).fontSize(9).font('Helvetica')
        .text('No planned trades entered in queue. Add day or weekly orders in the Management section.', 50, curY + 12);
      curY += 40;
    } else {
      trades.forEach((t, idx) => {
        // Page break safety
        if (curY > 680) {
          doc.addPage();
          curY = 40;
          // Re-draw table header on next page
          doc.rect(36, curY, 540, 18).fill(colors.slateDark);
          doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
          doc.text('RANK', 42, curY + 5);
          doc.text('SYMBOL & ACTION', 78, curY + 5);
          doc.text('HORIZON', 180, curY + 5);
          doc.text('ORDER / QTY', 240, curY + 5);
          doc.text('ENTRY LIMIT', 315, curY + 5);
          doc.text('STOP / TARGET', 375, curY + 5);
          doc.text('EST. CAPITAL', 455, curY + 5);
          doc.text('STATUS', 525, curY + 5);
          curY += 18;
        }

        const isEven = idx % 2 === 0;
        const rowHeight = t.notes ? 38 : 26;

        // Background row
        doc.rect(36, curY, 540, rowHeight).fill(isEven ? '#ffffff' : colors.zebraBg);
        doc.rect(36, curY + rowHeight - 0.5, 540, 0.5).fill(colors.borderLine);

        // Rank Badge
        doc.fillColor(idx === 0 ? colors.amberGold : idx === 1 ? '#0284c7' : colors.primaryNavy)
          .fontSize(8.5).font('Helvetica-Bold')
          .text(`#${t.rank}`, 42, curY + 6);

        // Symbol & Action
        const actionColor = t.action === 'BUY' || t.action === 'BTO'
          ? colors.emeraldGreen
          : t.action === 'SELL' || t.action === 'STC'
          ? colors.roseRed
          : colors.amberGold;

        doc.fillColor(colors.primaryNavy).fontSize(8.5).font('Helvetica-Bold')
          .text(t.symbol, 78, curY + 6);

        doc.fillColor(actionColor).fontSize(7).font('Helvetica-Bold')
          .text(t.action, 130, curY + 7);

        // Horizon & Conviction
        const horizonText = t.timeframe === 'DAY' ? 'TODAY' : 'THIS WEEK';
        doc.fillColor(t.timeframe === 'DAY' ? colors.emeraldGreen : colors.accentCyan)
          .fontSize(7.5).font('Helvetica-Bold')
          .text(horizonText, 180, curY + 6);

        const convStars = t.conviction === 'HIGH' ? '★★★' : t.conviction === 'MEDIUM' ? '★★☆' : '★☆☆';
        doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica')
          .text(`${convStars} ${t.conviction}`, 180, curY + 16);

        // Order / Qty
        doc.fillColor(colors.primaryNavy).fontSize(8).font('Helvetica')
          .text(`${t.quantity.toLocaleString()} ${t.assetType === 'OPTION' ? 'cts' : 'shs'}`, 240, curY + 6);
        doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica')
          .text(t.orderType, 240, curY + 16);

        // Entry Limit
        const entryStr = t.targetPrice ? `$${t.targetPrice.toFixed(2)}` : 'Market';
        doc.fillColor(colors.primaryNavy).fontSize(8).font('Helvetica-Bold')
          .text(entryStr, 315, curY + 6);

        // Stop / Target
        const stopStr = t.stopLoss ? `SL: $${t.stopLoss.toFixed(2)}` : 'SL: -';
        const targetStr = t.targetExit ? `TP: $${t.targetExit.toFixed(2)}` : 'TP: -';
        doc.fillColor(colors.roseRed).fontSize(7).font('Helvetica').text(stopStr, 375, curY + 5);
        doc.fillColor(colors.emeraldGreen).fontSize(7).font('Helvetica-Bold').text(targetStr, 375, curY + 15);

        // Est Capital
        const cost = t.quantity * (t.targetPrice || t.currentPrice || 0);
        doc.fillColor(colors.primaryNavy).fontSize(8).font('Helvetica-Bold')
          .text(cost > 0 ? `$${Math.round(cost).toLocaleString()}` : '-', 455, curY + 6);

        // Status
        const statusColor = t.status === 'EXECUTED'
          ? colors.emeraldGreen
          : t.status === 'TRIGGERED'
          ? colors.amberGold
          : colors.slateMuted;

        doc.fillColor(statusColor).fontSize(7).font('Helvetica-Bold')
          .text(t.status, 525, curY + 6);

        // Notes row if present
        if (t.notes) {
          doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica-Oblique')
            .text(`Strategy & Notes: ${t.notes}`, 78, curY + 23, { width: 440, lineBreak: false });
        }

        curY += rowHeight;
      });
    }

    // ==========================================
    // 4. FOOTER: RISK PROTOCOL & DISCLOSURES
    // ==========================================
    curY = Math.max(curY + 16, 680);
    if (curY > 710) {
      doc.addPage();
      curY = 50;
    }

    doc.rect(36, curY, 540, 52).fillAndStroke('#f8fafc', colors.borderLine);
    doc.fillColor(colors.primaryNavy).fontSize(8).font('Helvetica-Bold')
      .text('INSTITUTIONAL EXECUTION & RISK PROTOCOL', 46, curY + 8);
    doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica')
      .text(
        '1. Sizing Limits: Never allocate >10% portfolio capital to single speculative entry.\n' +
        '2. Invalidation: Always respect Stop Loss triggers on close; cancel pending orders if pre-market gap violates R:R.\n' +
        '3. Trade priority adheres to ranked order; execute highest conviction opportunities first during session open.',
        46,
        curY + 20,
        { width: 520, lineGap: 1.5 }
      );

    // Page Numbering
    // Page Numbering (Safely drawn without triggering automatic PDFKit blank pages)
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const originalMarginBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      // Subtle separator line
      doc.rect(36, 746, 540, 0.5).fill('#e2e8f0');

      doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica')
        .text(`TradeFlow Execution Dispatch • Page ${i + 1} of ${totalPages}`, 36, 752, {
          align: 'center',
          width: 540,
          lineBreak: false,
        });

      doc.page.margins.bottom = originalMarginBottom;
    }

    doc.end();
  });
}

/**
 * Dispatches the Execution Plan PDF directly to Telegram
 */
export async function sendExecutionPlanPdfToTelegram(): Promise<{ success: boolean; messageId?: number }> {
  const trades = await getPlannedTrades();
  const pdfBuffer = await generateExecutionPlanPdfBuffer(trades);

  const active = trades.filter((t) => t.status !== 'CANCELLED');
  const dayCount = active.filter((t) => t.timeframe === 'DAY').length;
  const weekCount = active.filter((t) => t.timeframe === 'WEEK').length;
  const topTrade = active[0];

  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `TradeFlow_Execution_Queue_${dateSlug}.pdf`;

  const caption =
    `🎯 *TradeFlow Tactical Execution Queue & Trade Plan*\n\n` +
    `📋 *Summary*:\n` +
    `• Total Orders in Queue: *${trades.length}*\n` +
    `• Day Orders: *${dayCount}* | Week Orders: *${weekCount}*\n` +
    (topTrade ? `• Top Priority (#1): *${topTrade.action} ${topTrade.symbol}* (${topTrade.quantity} ${topTrade.assetType === 'OPTION' ? 'contracts' : 'shares'})\n` : '') +
    `\n📄 *Full ranked execution PDF report attached below with limit prices, stop losses, and target exits.*`;

  return sendPdfReportToTelegram(pdfBuffer, filename, caption);
}
