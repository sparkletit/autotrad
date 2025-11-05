import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 在生产构建中忽略 hydration mismatch 警告（用于处理浏览器扩展修改 HTML 的情况）
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5,
  },
  // 禁用 hydration mismatch 相关的警告
  experimental: {
    // NextJS 13+ 的日志级别配置
  },
  webpack: (config: any, { isServer }: any) => {
    // 可以在这里添加额外的 webpack 配置
    return config;
  },
};

export default nextConfig;
