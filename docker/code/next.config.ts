import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 在生产构建中忽略 hydration mismatch 警告（用于处理浏览器扩展修改 HTML 的情况）
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
