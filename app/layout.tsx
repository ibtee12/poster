import type { Metadata } from "next";
import {
  Hind_Siliguri,
  Baloo_Da_2,
  Anek_Bangla,
  Atma,
  Galada,
  Tiro_Bangla,
  Noto_Sans_Bengali,
} from "next/font/google";
import "./globals.css";
import { Navbar } from "./components/Navbar";

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
  display: "swap",
});

const balooDa2 = Baloo_Da_2({
  subsets: ["bengali", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

const anekBangla = Anek_Bangla({
  subsets: ["bengali", "latin"],
  weight: ["700", "800"],
  variable: "--font-anek",
  display: "swap",
});

const atma = Atma({
  subsets: ["bengali", "latin"],
  weight: ["600", "700"],
  variable: "--font-atma",
  display: "swap",
});

const galada = Galada({
  subsets: ["bengali", "latin"],
  weight: "400",
  variable: "--font-galada",
  display: "swap",
});

const tiroBangla = Tiro_Bangla({
  subsets: ["bengali", "latin"],
  weight: "400",
  variable: "--font-tiro",
  display: "swap",
});

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "পোস্টার মেকার | সহজ ও সুন্দর ডিজিটাল পোস্টার তৈরি করুন",
  description: "স্বয়ংক্রিয় ব্যাকগ্রাউন্ড রিমুভাল ও নিখুঁত বাংলা টাইপোগ্রাফি সহ কয়েক ক্লিকেই তৈরি করুন আকর্ষণীয় পোস্টার।",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontClasses = [
    hindSiliguri.variable,
    balooDa2.variable,
    anekBangla.variable,
    atma.variable,
    galada.variable,
    tiroBangla.variable,
    notoSansBengali.variable,
  ].join(" ");

  return (
    <html lang="bn" className={fontClasses}>
      <body>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
