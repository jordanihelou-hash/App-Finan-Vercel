import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // ID único do app — deve corresponder ao que você registrar na
  // Google Play Console e no Apple App Store Connect.
  appId: "com.cofredicasal.app",
  appName: "Cofre do Casal",
  webDir: "dist",

  // Configurações do servidor (apenas para desenvolvimento com live reload)
  // Descomente e ajuste a URL abaixo ao rodar `npm run dev` com cap run android/ios
  // server: {
  //   url: "http://SEU_IP_LOCAL:5173",
  //   cleartext: true,
  // },

  plugins: {
    // SplashScreen: oculta automaticamente após o app carregar
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0a0613",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },

    // StatusBar: estilo claro para fundo escuro do app
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0613",
    },
  },

  // Android
  android: {
    // Permite HTTP em dev; em produção, use sempre HTTPS (Supabase já usa)
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // true somente para debug
  },

  // iOS
  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
  },
};

export default config;
