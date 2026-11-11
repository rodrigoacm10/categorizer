import type { Metadata } from "next";
import { Providers } from "@/shared/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestão Física de Estoque | Operate Mode",
  description: "Sistema industrial de gestão de almoxarifado, catálogo e livro-razão imutável.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
