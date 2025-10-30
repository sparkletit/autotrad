'use client';

import React, { useState } from 'react';
import RPCNodesManager from './RPCNodesManager';

interface RPCNode {
  id: number;
  url: string;
  network: string;
  status: 'active' | 'inactive';
  statusColor: 'green' | 'yellow' | 'red';
}

const RPCNodeSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <RPCNodesManager />
    </div>
  );
};

export default RPCNodeSettings;
