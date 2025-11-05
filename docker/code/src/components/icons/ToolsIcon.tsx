/**
 * 工具图标组件
 * 圆角正方形、淡绿色设计
 */
export default function ToolsIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 圆角正方形背景 */}
      <rect
        x="10"
        y="10"
        width="80"
        height="80"
        rx="16"
        ry="16"
        fill="#d1fae5"
        stroke="#86efac"
        strokeWidth="2"
      />

      {/* 左侧扳手 */}
      <g transform="translate(25, 35)">
        {/* 扳手柄 */}
        <path
          d="M 5 15 Q 8 10 15 8 Q 20 6 24 10"
          stroke="#059669"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 扳手头 */}
        <circle cx="24" cy="10" r="4" fill="#059669" />
      </g>

      {/* 右侧螺丝刀 */}
      <g transform="translate(50, 25)">
        {/* 螺丝刀柄 */}
        <rect x="8" y="2" width="4" height="28" rx="2" fill="#059669" />
        {/* 螺丝刀头 */}
        <path d="M 6 30 L 14 30 L 12 35 L 8 35 Z" fill="#059669" />
        {/* 装饰条纹 */}
        <line x1="8" y1="10" x2="12" y2="10" stroke="#10b981" strokeWidth="1" />
        <line x1="8" y1="18" x2="12" y2="18" stroke="#10b981" strokeWidth="1" />
      </g>

      {/* 中间齿轮 */}
      <g transform="translate(60, 50)">
        {/* 外圈齿轮 */}
        <circle cx="0" cy="0" r="10" fill="none" stroke="#059669" strokeWidth="1.5" />
        {/* 齿轮齿 */}
        <g stroke="#059669" strokeWidth="1">
          <line x1="0" y1="-12" x2="0" y2="-14" />
          <line x1="8.5" y1="-8.5" x2="10" y2="-10" />
          <line x1="12" y1="0" x2="14" y2="0" />
          <line x1="8.5" y1="8.5" x2="10" y2="10" />
          <line x1="0" y1="12" x2="0" y2="14" />
          <line x1="-8.5" y1="8.5" x2="-10" y2="10" />
          <line x1="-12" y1="0" x2="-14" y2="0" />
          <line x1="-8.5" y1="-8.5" x2="-10" y2="-10" />
        </g>
        {/* 中心 */}
        <circle cx="0" cy="0" r="2" fill="#059669" />
      </g>
    </svg>
  );
}
