import React, { useCallback } from 'react';
import { useTranslations } from 'use-intl';
import {
  enterFirstPersonMode,
  exitFirstPersonMode,
  isFirstPersonModeActive,
} from '@/utils/first-person-mode';
import { useIfcContext } from '@/app/(main)/[locale]/(core)/workspace/(facility-level)/facility/[facility_id]/ifc-context';
import ToolbarButton from './ToolbarButton';

export default function FirstPersonButton() {
  const t = useTranslations('Viewer');
  const { componentsRef, worldRef } = useIfcContext();

  const onClick = useCallback(async () => {
    const components = componentsRef.current;
    const world = worldRef.current;
    if (!components || !world) return;

    if (isFirstPersonModeActive()) {
      await exitFirstPersonMode();
    } else {
      await enterFirstPersonMode({
        components,
        world: world as any,
        t,
      });
    }
  }, [componentsRef, worldRef, t]);

  return (
    <ToolbarButton
      icon="videocam"
      label={t('first-person')}
      title={t('tooltip-first-person-nav')}
      onClick={onClick}
    />
  );
}
