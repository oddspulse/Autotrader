"use client";

import { Order } from "@autotrader/shared";
import { format } from "date-fns";

interface OrdersTableProps {
  orders: Order[];
}

export default function OrdersTable({ orders }: OrdersTableProps) {
  const formatUSD = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
      <h3 className="text-lg font-semibold mb-4">Open Orders</h3>

      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No open orders
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Symbol</th>
                <th className="text-left py-2">Side</th>
                <th className="text-left py-2">Type</th>
                <th className="text-right py-2">Size</th>
                <th className="text-right py-2">Price</th>
                <th className="text-center py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-gray-800 hover:bg-gray-700/30"
                >
                  <td className="py-3">
                    {format(order.timestamp, "HH:mm:ss")}
                  </td>
                  <td className="py-3 font-medium">{order.symbol}</td>
                  <td className="py-3">
                    <span
                      className={`${
                        order.side === "LONG"
                          ? "text-green-400"
                          : "text-red-400"
                      } font-semibold`}
                    >
                      {order.side}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                      {order.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 text-right">{order.size.toFixed(4)}</td>
                  <td className="py-3 text-right">
                    {order.price
                      ? formatUSD(order.price)
                      : order.triggerPrice
                      ? formatUSD(order.triggerPrice)
                      : "Market"}
                  </td>
                  <td className="py-3 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        order.status === "OPEN"
                          ? "bg-blue-900/50 text-blue-400"
                          : order.status === "FILLED"
                          ? "bg-green-900/50 text-green-400"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
