/** @type {import('tailwindcss').Config} */
export default {
  // ---------------------------------------------------------------------------
  // 1. CONTENT: La parte más importante para React.
  // Aquí le dices a Tailwind qué archivos debe escanear para encontrar
  // las clases que estás usando. Si una clase no está en estos archivos,
  // no se generará en el CSS final.
  // ---------------------------------------------------------------------------
  content: [
    "./index.html", // El HTML principal de tu proyecto (común en Vite)
    "./src/**/*.{js,ts,jsx,tsx}", // ¡CRUCIAL! Escanea todos los archivos de React en la carpeta src.
  ],

  // ---------------------------------------------------------------------------
  // 2. MODO OSCURO (OPCIONAL PERO RECOMENDADO)
  // Permite usar clases como `dark:bg-gray-800`.
  // 'class' es la estrategia más común y flexible: se activa añadiendo
  // la clase "dark" al elemento <html> o <body>.
  // ---------------------------------------------------------------------------
  darkMode: 'class',

  // ---------------------------------------------------------------------------
  // 3. THEME: Personaliza el diseño base de Tailwind.
  // La sección `extend` es la mejor práctica para añadir tus propias
  // personalizaciones sin sobreescribir las de Tailwind.
  // ---------------------------------------------------------------------------
  theme: {
    extend: {
      // --- Colores Personalizados ---
      // Úsalos en tu JSX como: `bg-primary`, `text-accent`, etc.
      colors: {
        'primary': '#007BFF',
        'secondary': '#6C757D',
        'accent': {
          DEFAULT: '#FFC107',
          light: '#FFD54F',
          dark: '#FFA000',
        },
        'brand-blue': '#1a91da',
      },

      // --- Tipografías Personalizadas ---
      // Asegúrate de importar estas fuentes en tu `index.css` o `index.html`.
      // Úsalas como: `font-sans`, `font-serif`
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'], // Fuente principal para la UI
        serif: ['"Merriweather"', 'serif'], // Fuente para artículos o textos largos
      },

      // --- Espaciado y Tamaños Personalizados ---
      // Úsalos como: `mt-128`, `w-screen-half`
      spacing: {
        '128': '32rem', // 128 * 0.25rem = 32rem
      },
      width: {
        'screen-half': '50vw',
      },

      // --- Breakpoints (Puntos de Ruptura) Personalizados ---
      // Para un diseño responsivo a tu medida.
      // Úsalos como: `lg-custom:grid-cols-3`
      screens: {
        'xs': '480px',
        'lg-custom': '1100px',
      },

      // --- Animaciones Personalizadas ---
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
      }
    },
  },

  // ---------------------------------------------------------------------------
  // 4. PLUGINS: Extiende la funcionalidad de Tailwind.
  // Aquí puedes añadir plugins oficiales o de la comunidad para cosas como
  // estilos de formularios, tipografía, etc.
  // ---------------------------------------------------------------------------
  plugins: [
    require('@tailwindcss/forms'), // Mejora los estilos base de los formularios.
    require('@tailwindcss/typography'), // Para estilizar bloques de HTML (ej. de un CMS).
  ],
}