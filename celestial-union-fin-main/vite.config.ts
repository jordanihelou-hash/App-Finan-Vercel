// Vite config para deploy como SPA no Vercel.
// Sem SSR/Nitro — TanStack Router funciona 100% client-side.
// Vercel serve o index.html para todas as rotas via rewrite em vercel.json.
//
// base: "./" é necessário para o Capacitor (iOS/Android) carregar assets
// com caminhos relativos dentro do WebView nativo.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
  plugins: [
    // IMPORTANTE: TanStackRouterVite deve vir antes do react()
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      quoteStyle: "double",
    }),
    react(),
    viteTsConfigPaths(),
    tailwindcss(),
  ],
});
