/** @type {import('tailwindcss').Config} */
// The Tatum design system is documented in the `tatum-design` skill, and its
// semantic classes (bg-secondary, text-primary, p-xl, rounded-md,
// text-heading-xs, shadow-xs …) exist only if the skill's generated
// theme.extend is merged in — which is what this file does. Shipping Tailwind
// alone is not enough: an unregistered class used via @apply is a hard PostCSS
// build error. design-tokens/tokens.css holds the CSS variables these entries
// resolve to and is imported from src/index.css.
//
// .cjs, not .js: package.json is "type": "module" and the generated tokens file
// is CommonJS, so a .js config here could not require() it.
const tokens = require('./design-tokens/tailwind.tokens.cjs')

module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Matches the scope tokens.css uses for its dark palette.
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    // The sans face comes from --font-family-sans, which src/index.css points
    // at Bricolage Grotesque for the Thermal theme. Figures use JetBrains Mono.
    extend: {
      ...tokens.theme.extend,
      fontFamily: {
        ...tokens.theme.extend.fontFamily,
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ...tokens.theme.extend.colors,
        ink: '#121212',
        paper: '#F2EFE6',
        slip: '#FFFDF7',
        stamp: '#E8461E',
        'stamp-text': '#C23A15',
        carbon: '#1F4FD8',
        'carbon-light': '#7FA0FF',
        muted: '#5E5A52',
        'muted-light': '#BDB7AA',
        'ink-line': '#3A3732',
      },
    },
  },
  plugins: [],
}
