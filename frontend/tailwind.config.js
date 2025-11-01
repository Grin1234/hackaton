export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cursor-bg': {
          primary: '#1e1e1e',
          secondary: '#252526',
          tertiary: '#2d2d30',
        },
        'cursor-text': {
          primary: '#cccccc',
          secondary: '#858585',
          muted: '#6a6a6a',
        },
        'cursor-accent': '#007acc',
        'cursor-accent-hover': '#1a8cd8',
        'cursor-border': '#3e3e42',
        'cursor-hover': '#2a2d2e',
        'cursor-active': '#37373d',
        'cursor-selection': '#264f78',
        'cursor-error': '#f48771',
        'cursor-warning': '#cca700',
        'cursor-success': '#89d185',
        // Enhanced colorful highlights
        'critical': '#ff4444',
        'critical-bg': 'rgba(255, 68, 68, 0.15)',
        'high': '#ff9500',
        'high-bg': 'rgba(255, 149, 0, 0.15)',
        'medium': '#ffd700',
        'medium-bg': 'rgba(255, 215, 0, 0.15)',
        'low': '#4fc3f7',
        'low-bg': 'rgba(79, 195, 247, 0.15)',
        'security': '#ff6b9d',
        'security-bg': 'rgba(255, 107, 157, 0.15)',
        'performance': '#4ecdc4',
        'performance-bg': 'rgba(78, 205, 196, 0.15)',
      },
    },
  },
  plugins: [],
}
