import { create } from "zustand";
import { categoriesApi } from "@/services";
import type { Category, CategoryKind } from "@/types/api";

interface CategoriesState {
  categories: Category[];
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  create: (kind: CategoryKind, name: string, color?: string) => Promise<Category>;
  remove: (id: number) => Promise<void>;
}

export const useCategoriesStore = create<CategoriesState>()((set, get) => ({
  categories: [],
  loaded: false,
  load: async (force = false) => {
    if (get().loaded && !force) return;
    const categories = await categoriesApi.list();
    set({ categories, loaded: true });
  },
  create: async (kind, name, color) => {
    const cat = await categoriesApi.create({ kind, name, color });
    set({ categories: [...get().categories, cat] });
    return cat;
  },
  remove: async (id) => {
    await categoriesApi.remove(id);
    set({ categories: get().categories.filter((c) => c.id !== id) });
  },
}));
