import React, { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'use-intl';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import { useIfcContext } from '@/app/(main)/[locale]/(core)/workspace/(facility-level)/facility/[facility_id]/ifc-context';
import ToolbarButton from './ToolbarButton';

interface FocusButtonProps {
  isDisabled: boolean;
  onTransparencyChange: (isActive: boolean) => void;
}

export default function FocusButton({
  isDisabled,
  onTransparencyChange,
}: FocusButtonProps) {
  const t = useTranslations('Viewer');
  const { componentsRef, worldRef, transparency } = useIfcContext();
  const [focusedSelection, setFocusedSelection] =
    useState<OBC.ModelIdMap | null>(null);

  const compareSelection = useCallback(
    (map1: OBC.ModelIdMap, map2: OBC.ModelIdMap): boolean => {
      // Check if both are empty
      const map1Empty = OBC.ModelIdMapUtils.isEmpty(map1);
      const map2Empty = OBC.ModelIdMapUtils.isEmpty(map2);

      if (map1Empty && map2Empty) return true;
      if (map1Empty !== map2Empty) return false;

      // Since there's only one model, get the first (and only) element set from each map
      const [set1] = Object.values(map1);
      const [set2] = Object.values(map2);

      if (!set1 || !set2) return false;
      if (set1.size !== set2.size) return false;

      // Compare Set contents
      for (const elementId of set1) {
        if (!set2.has(elementId)) return false;
      }

      return true;
    },
    []
  );

  const onUnfocus = useCallback(() => {
    transparency?.remove();
    onTransparencyChange(false);
    setFocusedSelection(null);
  }, [transparency, onTransparencyChange]);

  const onClick = useCallback(
    async (event: React.MouseEvent) => {
      const components = componentsRef.current;
      const world = worldRef.current;
      if (!components || !world) return;
      if (!(world.camera instanceof OBC.SimpleCamera)) return;

      const highlighter = components.get(OBF.Highlighter);
      const button = event.currentTarget as HTMLElement;
      const selection = highlighter.selection.select;

      // Do nothing if selection is empty
      if (OBC.ModelIdMapUtils.isEmpty(selection)) return;

      // Store the current selection for auto-unfocus detection
      setFocusedSelection(OBC.ModelIdMapUtils.clone(selection));

      transparency?.apply();
      onTransparencyChange(true);
      button.classList.add('loading');
      await world.camera.fitToItems(selection);
      button.classList.remove('loading');
    },
    [componentsRef, worldRef, transparency, onTransparencyChange]
  );

  // Auto-unfocus when selection changes
  useEffect(() => {
    const components = componentsRef.current;
    const world = worldRef.current;
    if (!components || !focusedSelection || !world) return;

    const highlighter = components.get(OBF.Highlighter);

    const handleSelectionChange = () => {
      const currentSelection = highlighter.selection.select;

      // If selections are different, trigger unfocus
      if (!compareSelection(currentSelection, focusedSelection)) {
        onUnfocus();
      }
    };

    highlighter.events.select.onHighlight.add(handleSelectionChange);
    highlighter.events.select.onClear.add(handleSelectionChange);

    return () => {
      highlighter.events.select.onHighlight.remove(handleSelectionChange);
      highlighter.events.select.onClear.remove(handleSelectionChange);
    };
  }, [componentsRef, worldRef, focusedSelection, onUnfocus, compareSelection]);

  return (
    <ToolbarButton
      icon="filter_center_focus"
      label={t('focus')}
      title={t('tooltip-focus-camera')}
      onClick={onClick}
      isDisabled={isDisabled}
    />
  );
}
