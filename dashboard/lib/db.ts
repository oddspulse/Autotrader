import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getTrades(limit = 100) {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getClosedTrades(limit = 200) {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("status", "closed")
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getEquityHistory(limit = 500) {
  const { data, error } = await supabase
    .from("equity_snapshots")
    .select("*")
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).reverse();
}

export async function getBotStatus() {
  const { data, error } = await supabase
    .from("bot_status")
    .select("*")
    .eq("id", 1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getPositions() {
  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .order("symbol");
  if (error) throw error;
  return data || [];
}

export async function getKellyStats() {
  const { data, error } = await supabase
    .from("kelly_stats")
    .select("*")
    .order("ts", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export function computeMetrics(trades: any[]) {
  const closed = trades.filter((t) => t.status === "closed" && t.pnl != null);
  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl < 0);
  const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalFees = closed.reduce((s, t) => s + (t.fees || 0), 0);

  return {
    totalTrades: closed.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: closed.length > 0 ? wins.length / closed.length : 0,
    totalPnl,
    totalFees,
    netPnl: totalPnl - totalFees,
    avgWin: wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0,
    avgLoss: losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0)) / losses.length : 0,
    bestTrade: closed.length > 0 ? Math.max(...closed.map((t) => t.pnl)) : 0,
    worstTrade: closed.length > 0 ? Math.min(...closed.map((t) => t.pnl)) : 0,
  };
}

export function computeDrawdown(snapshots: any[]) {
  let peak = 0;
  let maxDd = 0;
  const ddSeries: { ts: string; drawdown: number }[] = [];

  for (const s of snapshots) {
    const eq = Number(s.equity);
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? (peak - eq) / peak : 0;
    if (dd > maxDd) maxDd = dd;
    ddSeries.push({ ts: s.ts, drawdown: -dd * 100 });
  }

  return { maxDrawdown: maxDd, series: ddSeries };
}
