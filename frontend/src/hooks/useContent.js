import useStore from '../stores/useStore';

// Hook wrapper for ContentContext functionality
export const useContent = () => {
  const creatorContent = useStore((state) => state.creatorContent);
  const addCreatorContent = useStore((state) => state.addCreatorContent);
  const getCreatorContent = useStore((state) => state.getCreatorContent);

  return {
    creatorContent,
    addCreatorContent,
    getCreatorContent
  };
};