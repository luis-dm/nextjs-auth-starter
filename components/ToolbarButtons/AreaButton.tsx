import React, { useCallback } from 'react';
import { useTranslations } from 'use-intl';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import { useIfcContext } from '@/app/(main)/[locale]/(core)/workspace/(facility-level)/facility/[facility_id]/ifc-context';
import ToolbarButton from './ToolbarButton';

type MeasurementTool = 'length' | 'area' | 'clipper';

interface AreaButtonProps {
  isEnabled: boolean;
  onToggle: (tool: MeasurementTool, enabled: boolean) => void;
}

export default function AreaButton({ isEnabled, onToggle }: AreaButtonProps) {
  const t = useTranslations('Viewer');
  const { componentsRef } = useIfcContext();
  const onClick = useCallback(() => {
    const components = componentsRef.current;
    if (!components) return;
    const areaMeasurer = components.get(OBF.AreaMeasurement);
    const wasEnabled = areaMeasurer.enabled;
    onToggle('area', !wasEnabled);
  }, [componentsRef, onToggle]);

  return (
    <ToolbarButton
      icon="crop_free"
      label={t('area')}
      title={t('area')}
      onClick={onClick}
      isActive={isEnabled}
    />
  );
}
