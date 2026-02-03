/**
 * Visibility Event System
 *
 * Provides a centralized event system for synchronizing visibility state
 * between the toolbar and spatial panel components.
 */

export const VISIBILITY_CHANGED_EVENT = 'bim:visibility-changed';
export const ISOLATION_CHANGED_EVENT = 'bim:isolation-changed';

export interface VisibilityChangedDetail {
  elementIds: number[]; // Array of localIds affected
  visible: boolean; // true = shown, false = hidden
  source: 'toolbar' | 'spatial-panel' | 'chatbot'; // Who triggered the change
}

export interface IsolationChangedDetail {
  modelIdMap: { [modelId: string]: Set<number> }; // ModelIdMap of isolated elements
  isIsolated: boolean; // true = elements isolated, false = unisolated
  source: 'toolbar' | 'chatbot'; // Who triggered the change
}

/**
 * Dispatches a visibility changed event to notify all listeners
 * @param detail - The visibility change details
 */
export const dispatchVisibilityChanged = (
  detail: VisibilityChangedDetail
): void => {
  const event = new CustomEvent<VisibilityChangedDetail>(
    VISIBILITY_CHANGED_EVENT,
    {
      detail,
      bubbles: true,
      composed: true,
    }
  );
  window.dispatchEvent(event);
};

/**
 * Listens for visibility changes from other components
 * @param callback - Function to call when visibility changes
 * @returns Cleanup function to remove the listener
 */
export const listenToVisibilityChanges = (
  callback: (detail: VisibilityChangedDetail) => void
): (() => void) => {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<VisibilityChangedDetail>;
    callback(customEvent.detail);
  };

  window.addEventListener(VISIBILITY_CHANGED_EVENT, handler);

  return () => {
    window.removeEventListener(VISIBILITY_CHANGED_EVENT, handler);
  };
};

/**
 * Dispatches an isolation changed event to notify all listeners
 * @param detail - The isolation change details
 */
export const dispatchIsolationChanged = (
  detail: IsolationChangedDetail
): void => {
  const event = new CustomEvent<IsolationChangedDetail>(
    ISOLATION_CHANGED_EVENT,
    {
      detail,
      bubbles: true,
      composed: true,
    }
  );
  window.dispatchEvent(event);
};

/**
 * Listens for isolation changes from other components
 * @param callback - Function to call when isolation changes
 * @returns Cleanup function to remove the listener
 */
export const listenToIsolationChanges = (
  callback: (detail: IsolationChangedDetail) => void
): (() => void) => {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<IsolationChangedDetail>;
    callback(customEvent.detail);
  };

  window.addEventListener(ISOLATION_CHANGED_EVENT, handler);

  return () => {
    window.removeEventListener(ISOLATION_CHANGED_EVENT, handler);
  };
};
