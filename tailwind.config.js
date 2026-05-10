/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        utec: {
          // Un guinda elegante y profundo
          primary: '#800020',   
          // Un tono más claro/rojizo para contrastes
          secondary: '#A52A2A', 
          // Un dorado champán para acentos (combina muy bien con el guinda)
          accent: '#D4AF37',    
          // Guinda casi negro para textos o fondos oscuros
          dark: '#4A0404',      
          // Un rosa muy sutil o gris cálido para fondos
          light: '#F8F4F4',     
        },
        status: {
          ocupado: '#dc2626',
          libre: '#16a34a',
          reserva: '#ea580c',
          pendiente: '#eab308',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}