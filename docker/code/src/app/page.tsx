import Header from "@/components/Header";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="flex min-h-screen w-full flex-col items-center justify-center py-32 px-16 bg-white sm:items-start">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Web3 交易平台</h1>
          <p className="text-gray-600 mb-8 text-lg">一个功能完整的去中心化交易管理平台</p>
          <Link
            href="/settings"
            className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            前往设置页面
          </Link>
        </div>
      </main>
    </div>
  );
}