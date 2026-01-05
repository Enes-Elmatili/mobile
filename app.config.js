export default ({ config }) => {
  // Détection de l'environnement
  const isDev = process.env.NODE_ENV !== 'production';
  
  // URL de l'API selon l'environnement
  const apiUrl = isDev 
    ? 'http://192.168.129.179:3000/api'  // Dev : ton IP locale
    : 'https://api.mosaic.com/api';      // Prod : ton domaine

  return {
    ...config,
    expo: {
      name: "mosaic-mobile",
      slug: "mosaic-mobile",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "light",
      scheme: "mosaic",
      splash: {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff"
      },
      assetBundlePatterns: ["**/*"],
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.mosaic.app"
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#ffffff"
        },
        package: "com.mosaic.app"
      },
      web: {
        favicon: "./assets/favicon.png"
      },
      // ✅ Configuration personnalisée accessible dans l'app
      extra: {
        apiUrl,
        environment: isDev ? 'development' : 'production',
        // Autres configs si nécessaire
        enableLogs: isDev,
      }
    }
  };
};