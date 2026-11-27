// Server component that injects theme CSS variables into the initial HTML
// This prevents the "flash of default colors" that occurs when using client-side useEffect

import { getThemeById, getThemeCSSVariables } from '@/lib/themes';

interface ThemeStylesProps {
  themeId: string;
}

export function ThemeStyles({ themeId }: ThemeStylesProps) {
  const theme = getThemeById(themeId);
  const cssVars = getThemeCSSVariables(theme);

  // Build CSS string for :root variables
  const cssString = Object.entries(cssVars)
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root { ${cssString} }`,
      }}
    />
  );
}
