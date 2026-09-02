import { create } from "zustand";
import { persist } from "zustand/middleware";

type LocalState = {
  follows: string[];
  nickname: string;
  toggleFollow: (id: string) => void;
  setNickname: (n: string) => void;
};

export const useLocal = create<LocalState>()(
  persist(
    (set, get) => ({
      follows: [],
      nickname: "",
      toggleFollow: (id) => {
        const cur = get().follows;
        set({ follows: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      },
      setNickname: (nickname) => set({ nickname }),
    }),
    { name: "standstrong-local" },
  ),
);
