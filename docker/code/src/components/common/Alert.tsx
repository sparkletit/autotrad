import React from 'react';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  type: AlertType;
  message: string;
  onClose?: () => void;
  className?: string;
}

/**
 * 通用警告/提示组件
 * 支持success/error/warning/info四种类型
 */
const Alert: React.FC<AlertProps> = ({ type, message, onClose, className = '' }) => {
  const typeStyles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
    },
  };

  const styles = typeStyles[type];

  return (
    <div
      className={`p-3 ${styles.bg} border ${styles.border} rounded text-sm ${styles.text} flex items-center justify-between gap-2 ${className}`}
    >
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="text-lg font-semibold hover:opacity-70 transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Alert;
