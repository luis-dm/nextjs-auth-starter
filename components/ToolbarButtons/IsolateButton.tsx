import React from 'react';
import { useTranslations } from 'use-intl';
import ToolbarButton from './ToolbarButton';

interface IsolateButtonProps {
  onClick: (event: React.MouseEvent) => void;
}

export default function IsolateButton({ onClick }: IsolateButtonProps) {
  const t = useTranslations('Viewer');

  return (
    <ToolbarButton
      icon="select_all"
      label={t('isolate')}
      title={t('tooltip-isolate-selected')}
      onClick={onClick}
    />
  );
}
