import BalanceSummary from '@/components/BalanceSummary';

export default function BalancePage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">代币余额查询</h1>
          <p className="text-gray-600">
            输入钱包地址查询代币余额，支持按价值汇总显示和详细余额查看
          </p>
        </div>
        
        <BalanceSummary />
      </div>
    </div>
  );
}