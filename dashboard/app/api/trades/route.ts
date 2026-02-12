import { NextResponse } from "next/server";
import { getTrades } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    const trades = await getTrades(Math.min(limit, 500));

    return NextResponse.json({ trades });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
