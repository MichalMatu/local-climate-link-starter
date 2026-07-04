export const tokens = {
  color: {
    background: '#f5f5f7',
    surface: '#ffffff',
    surfaceMuted: '#f2f2f7',
    text: '#1d1d1f',
    textMuted: '#6e6e73',
    border: '#d2d2d7',
    accent: '#007aff',
    accentStrong: '#0066cc',
    accentContrast: '#ffffff',
    overlay: 'rgba(29, 29, 31, 0.44)',
    codeBackground: '#1d1d1f',
    codeText: '#f5f5f7'
  },
  status: {
    ok: {
      bg: '#e8f7ee',
      text: '#146c43',
      border: '#b7e4c7'
    },
    warning: {
      bg: '#fff4ce',
      text: '#7a4f01',
      border: '#f5c542'
    },
    danger: {
      bg: '#ffebee',
      text: '#b00020',
      border: '#ffb3ba'
    },
    inactive: {
      bg: '#f2f2f7',
      text: '#6e6e73',
      border: '#d2d2d7'
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem'
  },
  borderWidth: {
    sm: '1px',
    md: '2px'
  },
  opacity: {
    disabled: '0.55',
    muted: '0.62'
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    round: '999px'
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.85rem',
    md: '0.9rem',
    lg: '0.95rem',
    xl: '1rem',
    '2xl': '1.25rem',
    code: '0.78rem'
  },
  fontWeight: {
    medium: '500',
    semibold: '700',
    bold: '800'
  },
  lineHeight: {
    tight: '1.2',
    compact: '1.35',
    normal: '1.45',
    relaxed: '1.5'
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", system-ui, sans-serif',
    monoFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
  },
  size: {
    shellMaxWidth: '57.5rem',
    proseMaxWidth: '34rem',
    cardColumnMin: '16rem',
    formColumnMin: '12rem',
    savedListColumnMin: '12rem',
    actionMinWidth: '8rem',
    navItemMinWidth: '5.5rem',
    controlMinHeight: '2.75rem',
    compactControlMinHeight: '2.5rem',
    controlIconSize: '1.1rem',
    codePreviewMaxHeight: '22rem',
    modalMaxWidth: '42rem',
    modalWorkspaceMinHeight: '32rem',
    tooltipMaxWidth: '22rem',
    toastMaxWidth: '28rem',
    toastDismissSize: '1.6rem',
    selectIndicatorSize: '0.55rem'
  },
  fluid: {
    shellPadding: 'clamp(0.75rem, 4vw, 1.5rem)',
    panelPadding: 'clamp(1rem, 3vw, 1.5rem)',
    heroTitle: 'clamp(2rem, 6vw, 3.8rem)'
  },
  breakpoint: {
    marketing: '62rem',
    compact: '44rem',
    narrow: '30rem'
  },
  shadow: {
    sm: '0 1px 2px rgba(29, 29, 31, 0.08)',
    md: '0 12px 32px rgba(29, 29, 31, 0.12)',
    lg: '0 20px 56px rgba(29, 29, 31, 0.18)'
  },
  motion: {
    fast: '120ms',
    normal: '180ms'
  },
  zIndex: {
    content: '1',
    header: '10',
    modal: '40',
    toast: '60'
  },
  theme: {
    dark: {
      color: {
        background: '#1c1c1e',
        surface: '#252526',
        surfaceMuted: '#323234',
        text: '#f5f5f7',
        textMuted: '#a1a1a6',
        border: '#3a3a3c',
        accent: '#0a84ff',
        accentStrong: '#006edb',
        accentContrast: '#ffffff',
        overlay: 'rgba(0, 0, 0, 0.56)',
        codeBackground: '#111113',
        codeText: '#f5f5f7'
      },
      status: {
        ok: {
          bg: '#123323',
          text: '#7ee2a8',
          border: '#245c3d'
        },
        warning: {
          bg: '#3a2d0b',
          text: '#ffd76a',
          border: '#6f5a1b'
        },
        danger: {
          bg: '#3a151a',
          text: '#ff8fa3',
          border: '#74313d'
        },
        inactive: {
          bg: '#323234',
          text: '#a1a1a6',
          border: '#3a3a3c'
        }
      },
      shadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.35)',
        md: '0 12px 32px rgba(0, 0, 0, 0.42)',
        lg: '0 20px 56px rgba(0, 0, 0, 0.55)'
      }
    }
  }
} as const;

export type DesignTokens = typeof tokens;
