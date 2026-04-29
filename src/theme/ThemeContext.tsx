import React, { createContext, useContext } from "react";

import { lightTheme, type Theme } from "./colors";

const ThemeContext = createContext<Theme>(lightTheme);

export { ThemeContext };

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
