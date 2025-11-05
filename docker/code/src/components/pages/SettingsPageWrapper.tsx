'use client';

import SettingsPageClient from '@/components/settings/SettingsPageClient';
import { WidgetLayout } from '@/components/layouts/WidgetLayout';

export default function SettingsPageWrapper() {
  return (
    <WidgetLayout>
      <SettingsPageClient />
    </WidgetLayout>
  );
}
