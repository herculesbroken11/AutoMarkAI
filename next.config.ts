
// This is the Next.js configuration file.
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    const securityHeaders = [
      {
        key: 'Cross-Origin-Opener-Policy',
        value: 'same-origin',
      },
      {
        key: 'Cross-Origin-Embedder-Policy',
        value: 'credentialless',
      },
      {
        key: 'Content-Security-Policy',
        value: "media-src 'self' res.cloudinary.com firebasestorage.googleapis.com *.w3schools.com *.test-videos.co.uk;",
      }
    ];

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        port: "",
        pathname: "/**",
      },
       {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
    env: {
    NEXT_PUBLIC_BASE_URL: process.env.NODE_ENV === 'production' ? 'your-production-url.com' : 'http://localhost:9002',
    INSTAGRAM_ACCOUNT_ID: process.env.INSTAGRAM_ACCOUNT_ID,
    INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
    FACEBOOK_PAGE_ACCESS_TOKEN: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    HEYGEN_API_KEY: process.env.HEYGEN_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    REPLICATE_API_KEY: process.env.REPLICATE_API_KEY,
    MURFAI_API_KEY: process.env.MURFAI_API_KEY,
    WEATHER_API_KEY: process.env.WEATHER_API_KEY,
    REMOTION_WEBGL: "false",
    REMOTION_BROWSER_SANDBOX: "false",
    BEFORE_CARD_URL: "https://i.postimg.cc/mD8N1Yg9/before-card.png",
    AFTER_CARD_URL: "https://i.postimg.cc/637f7g3f/after-card.png",
    NEXT_PUBLIC_GOOGLE_SHEET_URL: "https://docs.google.com/spreadsheets/d/1wE4a4R7_aAUUNFgk2afxVngEwfgXTTyfaXg0sIZEicM/edit?usp=sharing",
  },
  webpack: (config, { isServer }) => {
    config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules/,
        type: "javascript/auto"
    });
    
    // Required for FFmpeg.wasm
    config.module.rules.push({
      test: /\.d\.ts$/,
      loader: 'ignore-loader',
    });

    config.resolve.fallback = { fs: false, path: false, crypto: false };
    
    return config;
  },
};

export default nextConfig;
