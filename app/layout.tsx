import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaperBank",
  description: "Cambridge past paper question database",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
