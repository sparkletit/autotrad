import React from 'react';
import { createPortal } from 'react-dom';

export interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: ModalAction[];
  maxWidth?: string;
}

/**
 * 通用模态框组件
 * 支持自定义标题、内容、按钮
 * 使用Portal渲染到document.body，避免被父元素遮挡
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  onClose,
  children,
  actions = [],
  maxWidth = 'max-w-md',
}) => {
  if (!isOpen) return null;

  const variantClasses = {
    primary: 'px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700',
    secondary: 'px-4 py-2 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400',
    danger: 'px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700',
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[999] flex items-center justify-center">
      <div className={`bg-white rounded-lg shadow-xl p-6 ${maxWidth} w-full mx-4`}>
        {/* 标题 */}
        <h3 className="text-xl font-bold text-gray-900 mb-4">{title}</h3>

        {/* 内容 */}
        <div className="mb-6">{children}</div>

        {/* 操作按钮 */}
        {actions.length > 0 && (
          <div className="flex gap-3">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                disabled={action.disabled || false}
                className={`flex-1 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed ${
                  variantClasses[action.variant || 'primary']
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
};

export default Modal;
