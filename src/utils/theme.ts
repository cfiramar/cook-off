import type { ThemeConfig } from '../hooks/useFirebaseData';

export const defaultThemes: ThemeConfig[] = [
  {
    id: 'halloween',
    name: 'האלווין',
    primaryColor: '#FF7A00',
    secondaryColor: '#6B21A8',
    backgroundColor: '#0F0F0F',
    backgroundImageUrl: '/spooky_kitchen_bg.webp',
    mobileBackgroundImageUrl: '/spooky_kitchen_bg.webp',
    surfaceColor: 'rgba(31, 31, 31, 0.8)',
    textColor: '#E5E7EB',
    fontFamily: '"Creepster", "Rubik Wet Paint", "Assistant", system-ui, sans-serif'
  },
  {
    id: 'classic',
    name: 'קלאסי (Classic)',
    primaryColor: '#D4AF37',
    secondaryColor: '#002366',
    backgroundColor: '#F5F5F5',
    backgroundImageUrl: '',
    surfaceColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: '"Georgia", serif'
  },
  {
    id: 'modern',
    name: 'מודרני (Modern)',
    primaryColor: '#3B82F6',
    secondaryColor: '#8B5CF6',
    backgroundColor: '#0F172A',
    backgroundImageUrl: '',
    surfaceColor: '#1E293B',
    textColor: '#F8FAFC',
    fontFamily: '"Assistant", "Heebo", "Rubik", "Inter", ui-sans-serif, system-ui, sans-serif'
  }
];

export function getThemeStyles(
  activeThemeId?: string, 
  customThemes?: ThemeConfig[],
  options?: { isMobile?: boolean }
): React.CSSProperties {
  const allThemes = [...(customThemes || []), ...defaultThemes];
  const activeTheme = allThemes.find(t => t.id === activeThemeId) || defaultThemes[0];

  const styles: any = {
    '--theme-primary': activeTheme.primaryColor,
    '--theme-secondary': activeTheme.secondaryColor,
    '--theme-bg': activeTheme.backgroundColor,
  };

  if (activeTheme.surfaceColor) styles['--theme-surface'] = activeTheme.surfaceColor;
  if (activeTheme.textColor) styles['--theme-text'] = activeTheme.textColor;
  if (activeTheme.fontFamily) styles['--theme-font'] = activeTheme.fontFamily;

  const rawBg = options?.isMobile && activeTheme.mobileBackgroundImageUrl
    ? activeTheme.mobileBackgroundImageUrl
    : activeTheme.backgroundImageUrl;

  const bgUrl = (rawBg === '/spooky_kitchen_bg.jpg' || rawBg === '/spooky_kitchen_bg_mobile.webp')
    ? '/spooky_kitchen_bg.webp'
    : rawBg;

  if (bgUrl) {
    styles.backgroundImage = `url('${bgUrl}')`;
    styles.backgroundSize = 'cover';
    styles.backgroundPosition = 'center';
  }

  return styles as React.CSSProperties;
}
