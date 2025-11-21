import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web3 交易平台",
  description: "Web3 交易平台 - 一个功能完整的去中心化交易管理平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
