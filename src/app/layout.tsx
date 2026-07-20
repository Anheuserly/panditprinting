import type { Metadata } from "next";
import { Manrope, Source_Serif_4 } from "next/font/google";
import "./globals.css";
const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif" });
export const metadata: Metadata = { title: "Pandit Printing Press | S N Enterprises", description: "Commercial printing, invitations, labels, packaging, and finishing by Pandit Printing Press, S N Enterprises, Delhi.", applicationName: "Pandit Printing Press", openGraph: { title: "Pandit Printing Press", description: "Professional printing by S N Enterprises in Delhi.", type: "website" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${manrope.variable} ${sourceSerif.variable}`}>{children}</body></html>; }
