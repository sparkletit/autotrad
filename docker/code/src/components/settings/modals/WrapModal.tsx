import React, { useState } from 'react';
import { Modal, Alert, FormInput } from '@/components/common';
import UnifiedAddressSelector from '@/components/common/UnifiedAddressSelector';
import { apiService } from '@/lib/apiService';

interface WrapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * 包装WBNB模态框
 * 分离出的子组件，独立处理包装逻辑
 */
const WrapModal: React.FC<WrapModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedAddress, setSelectedAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleWrap = async () => {
    setError('');
    setSuccess('');

    if (!selectedAddress) {
      setError('请先选择要包装的地址');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('请输入有效的BNB数量');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.post('/api/swap/wrap-wbnb', {
        account: selectedAddress,
        amount,
        network: 'fork',
      });

      if (response.success) {
        setSuccess(`成功将 ${amount} BNB 包装为 WBNB`);
        setAmount('');
        setSelectedAddress('');
        setTimeout(() => {
          onClose();
          onSuccess?.();
        }, 1000);
      } else {
        setError(response.error || '包装失败');
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
      title="包装 BNB 为 WBNB"
      onClose={handleClose}
      actions={[
        {
          label: loading ? '处理中...' : '确认包装',
          onClick: handleWrap,
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

export default WrapModal;
