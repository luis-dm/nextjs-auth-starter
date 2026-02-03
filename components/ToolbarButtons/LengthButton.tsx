import React, { useCallback } from 'react';
import { useTranslations } from 'use-intl';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import { useIfcContext } from '@/app/(main)/[locale]/(core)/workspace/(facility-level)/facility/[facility_id]/ifc-context';
import ToolbarButton from './ToolbarButton';

type MeasurementTool = 'length' | 'area' | 'clipper';

interface LengthButtonProps {
  isEnabled: boolean;
  onToggle: (tool: MeasurementTool, enabled: boolean) => void;
}

export default function LengthButton({
  isEnabled,
  onToggle,
}: LengthButtonProps) {
  const t = useTranslations('Viewer');
  const { componentsRef } = useIfcContext();
  const onClick = useCallback(() => {
    const components = componentsRef.current;
    if (!components) return;
    const lengthMeasurer = components.get(OBF.LengthMeasurement);
    const wasEnabled = lengthMeasurer.enabled;
    onToggle('length', !wasEnabled);
  }, [componentsRef, onToggle]);

  return (
    <ToolbarButton
      icon="straighten"
      label={t('length')}
      title={t('length')}
      onClick={onClick}
      isActive={isEnabled}
    />
  );
}
