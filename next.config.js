/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Desabilita strict mode para evitar double-mount que cria player YouTube duplicado
  reactStrictMode: false,
  
  // ✅ Otimiza bundle para dispositivos fracos como Fire TV Stick
  compiler: {
    // Remove console.log em produção
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // ✅ Desabilita telemetria do Next.js
  poweredByHeader: false,

  // ✅ Headers de cache para assets estáticos
  async headers() {
    return [
      {
        source: '/tv-ducking.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
        ],
      },
      {
        source: '/logo.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
