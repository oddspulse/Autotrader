"use client";

import { useState } from "react";
import { ApiResponse, MarketInfo } from "@autotrader/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startBot = async (walletAddress: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      const data: ApiResponse = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to start bot");
        return false;
      }

      return true;
    } catch (err: any) {
      setError(err.message || "Network error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const stopBot = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/stop`, {
        method: "POST",
      });

      const data: ApiResponse = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to stop bot");
        return false;
      }

      return true;
    } catch (err: any) {
      setError(err.message || "Network error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getMarkets = async (): Promise<MarketInfo[]> => {
    try {
      const response = await fetch(`${API_URL}/api/markets`);
      const data: ApiResponse<MarketInfo[]> = await response.json();

      if (!data.success || !data.data) {
        return [];
      }

      return data.data;
    } catch (err) {
      console.error("Failed to fetch markets", err);
      return [];
    }
  };

  const updateConfig = async (updates: any): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data: ApiResponse = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to update config");
        return false;
      }

      return true;
    } catch (err: any) {
      setError(err.message || "Network error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const downloadTrades = (): void => {
    window.open(`${API_URL}/api/export/trades`, "_blank");
  };

  return {
    loading,
    error,
    startBot,
    stopBot,
    getMarkets,
    updateConfig,
    downloadTrades,
  };
}
