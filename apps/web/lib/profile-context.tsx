"use client";

import { createContext, useContext } from "react";
import type { Profile } from "@/lib/types";

export const ProfileContext = createContext<Profile | null>(null);

export function useProfile() {
  return useContext(ProfileContext);
}
