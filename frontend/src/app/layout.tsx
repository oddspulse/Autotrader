import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import { WalletContextProvider } from "@/contexts/WalletContextProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Solana Perps Auto-Trader",
  description: "Automated perpetuals trading on Solana with Phantom wallet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </body>
    </html>
  );
}
