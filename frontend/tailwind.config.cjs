module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          main:       '#00e5ff',
          develop:    '#7c4dff',
          feature:    '#00e676',
          hotfix:     '#ff5252',
          release:    '#ffd740',
          experiment: '#ff6d00',
        },
        surface: {
          base:     '#0a0d1a',
          elevated: '#0f1428',
          overlay:  '#151b35',
          panel:    '#1a2040',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':  'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'fade-in-up':     'fade-in-up 0.5s ease both',
        'fade-in':        'fade-in 0.4s ease both',
        'slide-in-right': 'slide-in-right 0.4s ease both',
        'pulse-glow':     'pulse-glow 2s ease-in-out infinite',
      },
      boxShadow: {
        'glow-accent': '0 0 20px rgba(124, 77, 255, 0.35)',
        'glow-cyan':   '0 0 20px rgba(0, 229, 255, 0.30)',
        'glow-green':  '0 0 20px rgba(0, 230, 118, 0.30)',
        glass:         '0 8px 32px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
