import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyAgroAI | Plataforma Inteligente de Gestão Agrícola",
  description: "Sistema completo de gestão para fazendas: controle de contratos, estoque, produtividade e análises com IA. Gerencie sua operação agrícola de forma inteligente.",
  keywords: ["gestão agrícola", "agronegócio", "IA para fazendas", "controle de estoque", "produtividade agrícola"],
  authors: [{ name: "MyAgroAI Team" }],
  openGraph: {
    title: "MyAgroAI - Gestão Agrícola Inteligente",
    description: "Transforme sua fazenda com insights baseados em IA",
    type: "website",
  },
};


import { ConnectionTest } from "@/components/ConnectionTest";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthProvider as NextAuthSessionProvider } from "@/components/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <NextAuthSessionProvider>
            <AuthProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
              <ConnectionTest />
              <Toaster />
            </AuthProvider>
          </NextAuthSessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
