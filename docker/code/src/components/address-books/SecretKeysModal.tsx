'use client';

import React, { useState } from 'react';

interface Account {
  account_name: string;
  address: string;
  mnemonic?: string;
  private_key: string;
}

interface Props {
  account: Account;
  isDerived?: boolean;
  onClose: () => void;
}

export default function SecretKeysModal({ account, isDerived = false, onClose }: Props) {
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`已复制${label}到剩贴板`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900">账号秘密信息</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* 账号信息 */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              账号名称
            </label>
            <div className="bg-gray-100 p-3 rounded text-sm text-gray-700">
              {account.account_name}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              账号地址
            </label>
            <div className="bg-gray-100 p-3 rounded text-sm text-gray-700 break-all font-mono">
              {account.address}
            </div>
            <button
              onClick={() => handleCopy(account.address, '地址')}
              className="mt-2 w-full py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded transition-colors"
            >
              📋 复制地址
            </button>
          </div>

          {/* 助记词 */}
          {!isDerived && account.mnemonic && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-900">
                  助记词
                </label>
                <button
                  onClick={() => setShowMnemonic(!showMnemonic)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {showMnemonic ? '隐藏' : '显示'}
                </button>
              </div>
              {showMnemonic ? (
                <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-gray-700 break-words">
                  {account.mnemonic}
                </div>
              ) : (
                <div className="bg-gray-100 p-3 rounded text-sm text-gray-500 text-center">
                  点击上方"显示"查看助记词
                </div>
              )}
              {showMnemonic && (
                <button
                  onClick={() => handleCopy(account.mnemonic!, '助记词')}
                  className="mt-2 w-full py-1 text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-600 rounded transition-colors"
                >
                  ⚠️ 复制助记词
                </button>
              )}
            </div>
          )}

          {/* 私钥 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-900">
                私钥
              </label>
              <button
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {showPrivateKey ? '隐藏' : '显示'}
              </button>
            </div>
            {showPrivateKey ? (
              <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-gray-700 break-all font-mono">
                {account.private_key}
              </div>
            ) : (
              <div className="bg-gray-100 p-3 rounded text-sm text-gray-500 text-center">
                点击上方"显示"查看私钥
              </div>
            )}
            {showPrivateKey && (
              <button
                onClick={() => handleCopy(account.private_key, '私钥')}
                className="mt-2 w-full py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
              >
                ⚠️ 复制私钥
              </button>
            )}
          </div>

          {/* 警告信息 */}
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs text-yellow-800">
            ⚠️ <strong>重要提示：</strong> 不要与他人分享您的助记词或私钥。任何拥有这些信息的人都可以控制您的账号。
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}