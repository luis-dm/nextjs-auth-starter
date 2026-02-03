import React, { useCallback, useRef } from 'react';
import { useTranslations } from 'use-intl';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import { useIfcContext } from '@/app/(main)/[locale]/(core)/workspace/(facility-level)/facility/[facility_id]/ifc-context';
import ToolbarButton from './ToolbarButton';

type OriginalColorsMap = Map<
  FRAGS.BIMMaterial,
  { color: number; transparent: boolean; opacity: number }
>;

const setModelTransparent = (
  components: OBC.Components,
  originalColors: OriginalColorsMap
) => {
  const fragments = components.get(OBC.FragmentsManager);

  const materials = [...fragments.core.models.materials.list.values()];
  for (const material of materials) {
    if (material.userData.customId) continue;
    const color =
      'color' in material
        ? material.color.getHex()
        : material.lodColor.getHex();

    originalColors.set(material, {
      color,
      transparent: material.transparent,
      opacity: material.opacity,
    });

    material.transparent = true;
    material.opacity = 0.25;
    material.needsUpdate = true;
    if ('color' in material) {
      material.color.setColorName('white');
    } else {
      material.lodColor.setColorName('white');
    }
  }
};

const restoreModelMaterials = (originalColors: OriginalColorsMap) => {
  for (const [material, data] of originalColors) {
    const { color, transparent, opacity } = data;
    material.transparent = transparent;
    material.opacity = opacity;
    if ('color' in material) {
      material.color.setHex(color);
    } else {
      material.lodColor.setHex(color);
    }
    material.needsUpdate = true;
  }
  originalColors.clear();
};

interface TransparencyButtonProps {
  isDisabled: boolean;
  tooltipKey: string;
}

export default function TransparencyButton({
  isDisabled,
  tooltipKey,
}: TransparencyButtonProps) {
  const t = useTranslations('Viewer');
  const { componentsRef } = useIfcContext();
  const originalColorsRef = useRef<OriginalColorsMap>(new Map());

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      const components = componentsRef.current;
      if (!components) return;

      const button = event.currentTarget as HTMLElement;
      const isCurrentlyTransparent = originalColorsRef.current.size > 0;

      if (!isCurrentlyTransparent) {
        button.classList.add('active');
        setModelTransparent(components, originalColorsRef.current);
      } else {
        button.classList.remove('active');
        restoreModelMaterials(originalColorsRef.current);
      }
    },
    [componentsRef]
  );

  return (
    <ToolbarButton
      icon="opacity"
      label={t('transparent')}
      title={t(tooltipKey)}
      onClick={onClick}
      isDisabled={isDisabled}
    />
  );
}
