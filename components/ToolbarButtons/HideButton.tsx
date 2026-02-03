import React from 'react';
import { useTranslations } from 'use-intl';
import ToolbarButton from './ToolbarButton';

interface HideButtonProps {
  onClick: (event: React.MouseEvent) => void;
}

export default function HideButton({ onClick }: HideButtonProps) {
  const t = useTranslations('Viewer');

  return (
    <ToolbarButton
      icon="visibility_off"
      label={t('hide')}
      title={t('tooltip-hide-selected')}
      onClick={onClick}
    />
  );
}
