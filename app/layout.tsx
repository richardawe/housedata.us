import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HouseData — Property Tax Appeal Tool",
  description:
    "Find out if your home is over-assessed and get a ready-to-file evidence packet for your property tax protest.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
