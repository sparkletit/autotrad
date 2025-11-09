import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 在生产构建中忽略 hydration mismatch 警告（用于处理浏览器扩展修改 HTML 的情况）
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5,
  },
  turbopack: {
    // 显式设置根目录，避免多 lockfile 导致的推断错误
    root: __dirname,
  },
};

export default nextConfig;
