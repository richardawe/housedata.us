import type { Metadata, Viewport } from "next";
import "./globals.css";

const BASE_URL = "https://housedata.us";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "HouseData — Free Property Tax Appeal Tool",
    template: "%s — HouseData",
  },
  description:
    "Find out if your home is over-assessed in seconds. Free instant property tax check backed by public appraisal data. Get a ready-to-file evidence packet.",
  keywords: [
    "property tax appeal",
    "protest property tax",
    "property tax protest",
    "over-assessed home",
    "home assessment check",
    "Texas property tax",
    "appraisal protest",
    "property tax reduction",
  ],
  authors: [{ name: "HouseData", url: BASE_URL }],
  creator: "HouseData",
  publisher: "HouseData",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "HouseData",
    title: "HouseData — Is your home over-assessed?",
    description:
      "Free instant property tax check — backed by public appraisal data. Get a ready-to-file evidence packet in seconds.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "HouseData — Is your home over-assessed?",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@housedataus",
    title: "HouseData — Is your home over-assessed?",
    description:
      "Free instant property tax check — backed by public appraisal data. Get a ready-to-file evidence packet in seconds.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      { rel: "manifest", url: "/site.webmanifest" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
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
