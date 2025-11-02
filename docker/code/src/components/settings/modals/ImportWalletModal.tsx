import React, { useState } from 'react';
import { Modal, Alert, FormInput } from '@/components/common';
import { authService } from '@/lib/authService';

interface ImportWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (accountName: string) => void;
}

/**
 * 导入钱包模态框
 * 分离出的子组件，独立处理导入逻辑
 */
const ImportWalletModal: React.FC<ImportWalletModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [privateKey, setPrivateKey] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleImport = async () => {
    setError('');
    setSuccess('');

    // 验证输入
    const nameValidation = authService.validateAccountName(accountName);
    if (!nameValidation.isValid) {
      setError(nameValidation.error || '账户名称无效');
      return;
    }

    const keyValidation = authService.validatePrivateKeyFormat(privateKey);
    if (!keyValidation.isValid) {
      setError(keyValidation.error || '私钥格式无效');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.importWallet({
        privateKey,
        accountName,
      });

      if (response.success) {
        setSuccess(`成功导入钱包：${response.data?.accountName}`);
        setPrivateKey('');
        setAccountName('');
        setTimeout(() => {
          onClose();
          onSuccess?.(response.data?.accountName || '');
        }, 1000);
      } else {
        setError(response.error || '导入失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPrivateKey('');
    setAccountName('');
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title="导入钱包（私钥）"
      onClose={handleClose}
      actions={[
        {
          label: loading ? '导入中...' : '确认导入',
          onClick: handleImport,
          variant: 'primary',
          disabled: loading,
        },
        {
          label: '取消',
          onClick: handleClose,
          variant: 'secondary',
        },
      ]}
    >
      <div className="space-y-4">
        <FormInput
          label="账号名称"
          value={accountName}
          onChange={setAccountName}
          placeholder="为导入的钱包取个名字"
          disabled={loading}
        />

        <FormInput
          label="私钥"
          value={privateKey}
          onChange={setPrivateKey}
          placeholder="粘贴钱包的私钥（0x开头）"
          className="font-mono text-sm"
          disabled={loading}
        />

        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}
      </div>
    </Modal>
  );
};

export default ImportWalletModal;
