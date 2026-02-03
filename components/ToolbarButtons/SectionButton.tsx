import React, { useCallback } from 'react';
import { useTranslations } from 'use-intl';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import { useIfcContext } from '@/app/(main)/[locale]/(core)/workspace/(facility-level)/facility/[facility_id]/ifc-context';
import ToolbarButton from './ToolbarButton';

type MeasurementTool = 'length' | 'area' | 'clipper';

interface SectionButtonProps {
  isEnabled: boolean;
  onToggle: (tool: MeasurementTool, enabled: boolean) => void;
}

export default function SectionButton({
  isEnabled,
  onToggle,
}: SectionButtonProps) {
  const t = useTranslations('Viewer');
  const { componentsRef } = useIfcContext();
  const onClick = useCallback(() => {
    const components = componentsRef.current;
    if (!components) return;
    const clipper = components.get(OBC.Clipper);
    const wasEnabled = clipper.enabled;
    onToggle('clipper', !wasEnabled);
  }, [componentsRef, onToggle]);

  return (
    <ToolbarButton
      icon="content_cut"
      label={t('section')}
      title={t('section')}
      onClick={onClick}
      isActive={isEnabled}
    />
  );
}
