import React from 'react';
import { useTranslations } from 'use-intl';
import ToolbarButton from './ToolbarButton';

interface UnisolateButtonProps {
  onClick: (event: React.MouseEvent) => void;
}

export default function UnisolateButton({ onClick }: UnisolateButtonProps) {
  const t = useTranslations('Viewer');

  return (
    <ToolbarButton
      icon="deselect"
      label={t('unisolate')}
      title={t('tooltip-unisolate-elements')}
      onClick={onClick}
    />
  );
}
