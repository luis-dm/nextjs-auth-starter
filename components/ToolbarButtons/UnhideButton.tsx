import React from 'react';
import { useTranslations } from 'use-intl';
import ToolbarButton from './ToolbarButton';

interface UnhideButtonProps {
  onClick: (event: React.MouseEvent) => void;
}

export default function UnhideButton({ onClick }: UnhideButtonProps) {
  const t = useTranslations('Viewer');

  return (
    <ToolbarButton
      icon="visibility"
      label={t('unhide')}
      title={t('tooltip-unhide-elements')}
      onClick={onClick}
    />
  );
}
