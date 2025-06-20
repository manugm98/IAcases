# Generador de Casos de Prueba y Análisis de Impacto para Jira

Esta aplicación web frontend es una herramienta útil para equipos de QA y desarrollo que trabajan con Jira. Permite generar casos de prueba detallados en formato Gherkin, identificar posibles impactos de los cambios y sugerir pruebas de regresión necesarias, todo ello basándose en la descripción de una historia de usuario o épica de Jira.

## Características

* **Generación de Casos de Prueba Gherkin:** Convierte descripciones de Jira en escenarios de prueba estructurados con `Feature`, `Scenario` (con prefijo "Validar "), `Given`, `When` y `Then`.
* **Inclusión de ID de Jira:** Asocia automáticamente el ID de la historia o épica de Jira a cada caso de prueba generado.
* **Análisis de Impacto:** Sugiere áreas potenciales del sistema que podrían verse afectadas por el cambio descrito en Jira.
* **Sugerencias de Pruebas de Regresión:** Proporciona una lista de pruebas de regresión recomendadas para asegurar la calidad del producto.
* **Interfaz de Usuario Intuitiva:** Diseño limpio y responsivo, construido con React y Tailwind CSS.

## ¿Cómo funciona?

La aplicación utiliza un modelo de Inteligencia Artificial (IA) de Google (Gemini) para analizar el texto de la descripción de Jira. Debido a las políticas de seguridad web (CORS), la aplicación no puede leer directamente el contenido de una URL de Jira. Por lo tanto, requiere que el usuario pegue manualmente la descripción de la historia o épica. La URL de Jira se utiliza para extraer el ID de la tarea y para proporcionar un contexto adicional (simulado en este ejemplo) a la IA.

## Configuración Local

Para ejecutar esta aplicación en tu máquina local, sigue estos pasos:

### Prerrequisitos

Asegúrate de tener instalado:
* **Node.js** (versión LTS recomendada)
* **npm** (viene con Node.js)

### Pasos de Instalación

1.  **Crea un nuevo proyecto React con Vite:**
    ```bash
    npm create vite@latest
    ```
    Sigue las indicaciones:
    * `Project name:` `jira-test-case-generator-app` (o el nombre que elijas)
    * `Select a framework:` `React`
    * `Select a variant:` `JavaScript`

2.  **Navega a la carpeta del proyecto e instala las dependencias iniciales:**
    ```bash
    cd jira-test-case-generator-app
    npm install
    ```

3.  **Instala y configura Tailwind CSS:**
    ```bash
    npm install -D tailwindcss postcss autoprefixer
    npx tailwindcss init -p
    ```
    * Abre `tailwind.config.js` y actualiza la sección `content`:
        ```javascript
        /** @type {import('tailwindcss').Config} */
        export default {
          content: [
            "./index.html",
            "./src/**/*.{js,ts,jsx,tsx}",
          ],
          theme: {
            extend: {},
          },
          plugins: [],
        }
        ```
    * Abre `src/index.css` y añade las directivas de Tailwind al principio del archivo (borra el contenido previo si existe):
        ```css
        @tailwind base;
        @tailwind components;
        @tailwind utilities;
        ```
    * Asegúrate de que `src/index.css` se importa en `src/main.jsx` (o `main.js`):
        ```javascript
        import './index.css'
        ```

4.  **Reemplaza el código de la aplicación:**
    * Abre el archivo `src/App.jsx` (o `src/App.js`) en tu editor de código.
    * **Borra todo el contenido existente** y pega el código completo de la aplicación "Jira Test Case Generator" que se te proporcionó.

5.  **Configura tu Clave API de Gemini:**
    La aplicación utiliza la API de Google Gemini para la generación de texto. Necesitarás tu propia clave API.
    * Obtén una clave API de Google AI Studio: [https://aistudio.google.com/](https://aistudio.google.com/)
    * En `src/App.jsx` (o `src/App.js`), busca la línea `const apiKey = "";`.
    * Reemplázala con tu clave API real:
        ```javascript
        const apiKey = "TU_CLAVE_API_AQUI"; // ¡IMPORTANTE: Reemplaza con tu clave real!
        ```
    * **Para producción, se recomienda usar variables de entorno.** Si vas a desplegar la app, configura `VITE_GEMINI_API_KEY` en tu hosting y accede a ella con `import.meta.env.VITE_GEMINI_API_KEY`.

6.  **Ejecuta la aplicación:**
    En tu terminal, dentro de la carpeta raíz del proyecto:
    ```bash
    npm run dev
    ```
    La aplicación se abrirá en tu navegador en `http://localhost:5173/` (o un puerto similar).

## Uso

1.  Abre la aplicación en tu navegador.
2.  **Pega la URL de tu historia de usuario o épica de Jira** en el campo "Enlace de Jira".
3.  **Copia y pega la descripción completa** de la historia de usuario o épica de Jira en el área de texto "Contenido de la historia/épica de Jira".
4.  Haz clic en el botón "Generar Análisis Completo".
5.  Los casos de prueba generados en formato de tabla (con el ID de Jira y el prefijo "Validar "), junto con las sugerencias de impactos y pruebas de regresión, se mostrarán en la pantalla.

---
