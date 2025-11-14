"use client";

import { useEffect, useState } from 'react';

export type NetworkKey = 'fork' | 'bsc' | 'ethereum' | 'polygon';

let currentNetwork: NetworkKey = 'fork';
const listeners = new Set<(n: NetworkKey) => void>();

export function getNetwork(): NetworkKey {
  return currentNetwork;
}

export function setNetwork(n: NetworkKey) {
  currentNetwork = n;
  listeners.forEach((fn) => fn(currentNetwork));
}

export function useNetwork(): NetworkKey {
  const [net, setNet] = useState<NetworkKey>(currentNetwork);
  useEffect(() => {
    const fn = (n: NetworkKey) => setNet(n);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return net;
}

