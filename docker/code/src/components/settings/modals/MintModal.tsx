import React, { useState } from 'react';
import { Modal, Alert, FormSelect, FormInput } from '@/components/common';
import UnifiedAddressSelector from '@/components/common/UnifiedAddressSelector';
import { apiService } from '@/lib/apiService';

interface MintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Mint主网资产模态框
 * 分离出的子组件，独立处理Mint逻辑
 */
const MintModal: React.FC<MintModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedAddress, setSelectedAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleMint = async () => {
    setError('');
    setSuccess('');

    if (!selectedAddress) {
      setError('请先选择要Mint的地址');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('请输入有效的BNB数量');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.post('/api/fork/mint', {
        address: selectedAddress,
        amount,
        token: 'BNB',
      });

      if (response.success) {
        setSuccess(`成功Mint ${amount} BNB`);
        setAmount('');
        setSelectedAddress('');
        setTimeout(() => {
          onClose();
          onSuccess?.();
        }, 1000);
      } else {
        setError(response.error || 'Mint失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedAddress('');
    setAmount('');
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Mint 主网资产"
      onClose={handleClose}
      actions={[
        {
          label: loading ? '处理中...' : '确认Mint',
          onClick: handleMint,
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
        <UnifiedAddressSelector
          value={selectedAddress}
          onChange={setSelectedAddress}
          placeholder="搜索或选择账号..."
        />

        <FormInput
          label="BNB 数量"
          value={amount}
          onChange={setAmount}
          placeholder="输入BNB数量"
          type="number"
          step="0.01"
          min="0"
          disabled={loading}
        />

        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}
      </div>
    </Modal>
  );
};

export default MintModal;
