/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        syne:   ['Syne', 'sans-serif'],
        tajawal:['Tajawal', 'sans-serif'],
        dm:     ['DM Sans', 'sans-serif'],
      },
      colors: {
        qahwa: {
          black:   '#0D0D0D',
          cream:   '#FAFAF7',
          accent:  '#C8F55A',
          red:     '#FF5A5A',
          purple:  '#8B7FF5',
          blue:    '#38BDF8',
          orange:  '#F59A38',
          wa:      '#25D366',
        }
      }
    },
  },
  plugins: [],
};
