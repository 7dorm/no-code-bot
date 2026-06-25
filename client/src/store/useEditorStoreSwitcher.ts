import { useState, useCallback } from 'react';
import { useEditorStore } from './useEditorStore';
import { useEditorStoreWithInternal } from './useEditorStoreWithInternal';

export type EditorStoreType = 'default' | 'internal';

export const useEditorStoreSwitcher = () => {
  const [storeType, setStoreType] = useState<EditorStoreType>('default');

  const switchStore = useCallback((type: EditorStoreType) => {
    setStoreType(type);
  }, []);

  const useStore = storeType === 'default' ? useEditorStore : useEditorStoreWithInternal;

  return {
    useStore,
    storeType,
    switchStore,
  };
};
