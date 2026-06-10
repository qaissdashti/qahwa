/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Default sans across the app → Plus Jakarta Sans (+ IBM Plex Sans
        // Arabic fallback), driven by the --font-sans CSS variable.
        sans:     ['var(--font-sans)'],
        // Legacy aliases kept so any stray font-* utility still renders the
        // new stack instead of breaking.
        fraunces: ['var(--font-sans)'],
        tajawal:  ['var(--font-sans)'],
        dm:       ['var(--font-sans)'],
      },
      colors: {
        qahwa: {
          black:   '#0D0D0D',
          cream:   '#FAFAF7',
          accent:  '#C8F55A',
          red:     '#FF5A5A',
          purple:  '#7B2FBE',
          violet:  '#9B4DCA',
          lavender:'#F5F0FF',
          blue:    '#38BDF8',
          orange:  '#F59A38',
          wa:      '#25D366',
        }
      }
    },
  },
  plugins: [],
};
