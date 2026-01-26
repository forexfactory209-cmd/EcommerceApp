/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#090966', // Brand Primary
        secondary: '#F3F4F6', // Light Gray
        dark: '#1F2937', // Dark Gray
      }
    },
  },
  plugins: [],
}
