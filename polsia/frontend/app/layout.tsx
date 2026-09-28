import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polsia Command Center",
  description: "Live control room for an autonomous multi-agent company OS",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
