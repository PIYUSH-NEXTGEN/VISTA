import { useCallback, useState } from "react";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
}

export function useToastQueue() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((title: string, description?: string) => {
    setItems((current) => [
      ...current,
      { id: Date.now() + Math.random(), title, description },
    ]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((t) => t.id !== id));
  }, []);

  return { items, push, remove };
}
