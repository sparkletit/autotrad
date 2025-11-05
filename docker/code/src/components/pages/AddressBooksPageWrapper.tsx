'use client';

import AddressBooksClient from '@/components/address-books/AddressBooksClient';
import { WidgetLayout } from '@/components/layouts/WidgetLayout';

export default function AddressBooksPageWrapper() {
  return (
    <WidgetLayout>
      <AddressBooksClient />
    </WidgetLayout>
  );
}
