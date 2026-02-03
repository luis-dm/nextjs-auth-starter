import React from 'react';
import { useTranslations } from 'use-intl';
import ToolbarButton from './ToolbarButton';

interface ResetButtonProps {
  readonly onClick: (event: React.MouseEvent) => void;
}

export default function ResetButton({ onClick }: ResetButtonProps) {
  const t = useTranslations('Viewer');

  return (
    <ToolbarButton
      icon="visibility"
      label={t('reset-view')}
      title={t('tooltip-show-all-visible')}
      onClick={onClick}
    />
  );
}
