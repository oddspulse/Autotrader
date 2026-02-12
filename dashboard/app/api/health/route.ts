import { NextResponse } from "next/server";
import { getBotStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getBotStatus();

    if (!status) {
      return NextResponse.json({
        status: "unknown",
        message: "No bot status found in database",
      });
    }

    const lastHeartbeat = status.last_heartbeat
      ? new Date(status.last_heartbeat)
      : null;
    const now = new Date();
    const staleSeconds = lastHeartbeat
      ? (now.getTime() - lastHeartbeat.getTime()) / 1000
      : Infinity;

    return NextResponse.json({
      status: status.status,
      mode: status.mode,
      lastHeartbeat: status.last_heartbeat,
      lastError: status.last_error,
      version: status.version,
      uptimeSeconds: status.uptime_seconds,
      isStale: staleSeconds > 180,
      staleSinceSeconds: Math.round(staleSeconds),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
