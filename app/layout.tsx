import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  return {
    title: "JinTai FactoryOps",
    description: "金汰工厂运营管理系统",
    openGraph: {
      title: "JinTai FactoryOps",
      description: "金汰工厂运营管理系统",
      images: [{ url: imageUrl, width: 1680, height: 941, alt: "JinTai FactoryOps" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "JinTai FactoryOps",
      description: "金汰工厂运营管理系统",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
