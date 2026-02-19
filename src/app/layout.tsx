import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UrbnLab",
  description: "Community-powered city improvement platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
        {children}
      </body>
    </html>
  );
}
