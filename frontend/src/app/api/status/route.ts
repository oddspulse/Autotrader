import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/**
 * GET /api/status
 * Returns current bot status
 */
export async function GET() {
  // In Vercel deployment, bot state would be stored in KV or edge storage
  // For now, return placeholder status
  return NextResponse.json({
    success: true,
    data: {
      status: "STOPPED",
      mode: "PAPER",
      activeSymbol: "SOL",
      equity: {
        timestamp: Date.now(),
        totalEquity: 10000,
        freeCollateral: 10000,
        usedMargin: 0,
        unrealizedPnl: 0,
        dailyPnl: 0,
      },
      riskState: {
        dailyPnl: 0,
        dailyPnlPct: 0,
        consecutiveLosses: 0,
        isDailyLossCapHit: false,
        isConsecutiveLossLimitHit: false,
        canTrade: true,
      },
      openOrders: [],
    },
  });
}
