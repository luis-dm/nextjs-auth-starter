/**
 * In-memory cache for IFC type property indices
 * Stores parsed type property indices per model for O(1) property lookups
 */

import { TypePropertyIndex } from "./ifcTypeIndex";

const typeIndexCache = new Map<string, TypePropertyIndex>();

/**
 * Store a type property index in memory for a model
 */
export const setTypeIndex = (
  modelId: string,
  index: TypePropertyIndex,
): void => {
  typeIndexCache.set(modelId, index);
  console.log("💾 Type index stored in cache:", {
    modelId,
    cacheSize: typeIndexCache.size,
    indexKeys: Object.keys(index),
  });
};

/**
 * Retrieve a cached type property index for a model
 */
export const getTypeIndex = (
  modelId: string,
): TypePropertyIndex | undefined => {
  const index = typeIndexCache.get(modelId);
  console.log("🔍 Cache lookup for model:", {
    modelId,
    found: !!index,
    availableModels: Array.from(typeIndexCache.keys()),
  });
  return index;
};

/**
 * Check if a type index exists in cache
 */
export const hasTypeIndex = (modelId: string): boolean => {
  return typeIndexCache.has(modelId);
};

/**
 * Remove a type index from cache
 */
export const clearTypeIndex = (modelId: string): void => {
  typeIndexCache.delete(modelId);
};

/**
 * Clear all cached type indices
 */
export const clearAllTypeIndices = (): void => {
  typeIndexCache.clear();
};
