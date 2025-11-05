'use client';

import CustomFunctionClient from '@/components/custom-function/CustomFunctionClient';
import { WidgetLayout } from '@/components/layouts/WidgetLayout';

export default function CustomFunctionPageWrapper() {
  return (
    <WidgetLayout>
      <CustomFunctionClient />
    </WidgetLayout>
  );
}
