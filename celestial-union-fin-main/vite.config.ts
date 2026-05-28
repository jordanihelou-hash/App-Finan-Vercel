// Configuração para deploy no Vercel com TanStack Start (SSR via Nitro).
//
// Mudanças em relação ao original:
//   - Trocamos @lovable.dev/vite-tanstack-config pelo config padrão do TanStack Start
//     para ter controle total sobre o preset de deploy (vercel).
//   - Adicionamos manualmente tailwindcss e vite-tsconfig-paths (antes embutidos no Lovable config).
//   - O preset 'vercel' faz o Nitro gerar output em .vercel/output/ automaticamente.
//
// Para desenvolvimento local: bun run dev  (funciona igual)
// Para build Vercel:          bun run build

import { defineConfig } from "@tanstack/react-start/config";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tailwindcss(),
    ],
  },
  server: {
    // 'vercel' gera output compatível com Vercel Serverless Functions
    preset: "vercel",
  },
});
