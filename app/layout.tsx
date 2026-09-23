import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MessMate — Shared Meals & Expenses",
  description: "Track meals, shared expenses, deposits, and fair monthly settlements.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

