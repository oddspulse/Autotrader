import { NextResponse } from "next/server";
import {
  getClosedTrades,
  getEquityHistory,
  computeMetrics,
  computeDrawdown,
  getKellyStats,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [trades, equity, kelly] = await Promise.all([
      getClosedTrades(500),
      getEquityHistory(500),
      getKellyStats(),
    ]);

    const tradeMetrics = computeMetrics(trades);
    const drawdown = computeDrawdown(equity);

    const equityCurve = equity.map((s: any) => ({
      ts: s.ts,
      equity: Number(s.equity),
      cash: Number(s.cash),
    }));

    const currentEquity = equity.length > 0 ? Number(equity[equity.length - 1].equity) : 0;
    const totalFees = trades.reduce((s: number, t: any) => s + Number(t.fees || 0), 0);

    return NextResponse.json({
      ...tradeMetrics,
      currentEquity,
      maxDrawdown: drawdown.maxDrawdown,
      drawdownSeries: drawdown.series,
      equityCurve,
      kellyStats: kelly,
      totalFees,
      sustainability: {
        netAfterFees: tradeMetrics.totalPnl - totalFees,
        isSustainable: tradeMetrics.totalPnl - totalFees > 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
