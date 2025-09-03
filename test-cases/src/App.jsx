import React, { useState } from 'react';

// Function to extract Jira ID from URL
const getJiraIdFromUrl = (url) => {
    try {
        const urlObj = new URL(url);
        // Assuming Jira ID is the last segment after /browse/ or /ticket/
        const pathSegments = urlObj.pathname.split('/');
        const idIndex = pathSegments.findIndex(segment => segment === 'browse' || segment === 'ticket');
        if (idIndex !== -1 && idIndex + 1 < pathSegments.length) {
            return pathSegments[idIndex + 1];
        }
        // Fallback if common patterns not found, just return the last segment
        return pathSegments[pathSegments.length - 1];
    } catch (error) {
        console.warn("Invalid Jira URL provided:", url, error);
        return '';
    }
};

// Helper function to sort test cases by priority
const sortTestCasesByPriority = (cases) => {
    const priorityOrder = {
        'Alta': 1,
        'Media': 2,
        'Baja': 3,
        'High': 1, // Also support English priorities if AI generates them
        'Medium': 2,
        'Low': 3,
        '': 4 // Handle cases with no priority
    };

    return [...cases].sort((a, b) => {
        const priorityA = priorityOrder[a.priority] || 4;
        const priorityB = priorityOrder[b.priority] || 4;
        return priorityA - priorityB;
    });
};

// Main App component for the Jira Test Case Generator
function App() {
    // State to hold the Jira link (now mandatory)
    const [jiraLink, setJiraLink] = useState('');
    // State to hold the Jira story/epic description content
    const [jiraContent, setJiraContent] = useState('');
    // State to store the generated main test cases as structured data
    const [testCases, setTestCases] = useState(null);
    // State to store the generated impacts analysis
    const [impacts, setImpacts] = useState('');
    // State to store the initial regression test suggestions (as plain text)
    const [regressionTestSuggestions, setRegressionTestSuggestions] = useState('');
    // State to store the Gherkin test cases generated from regression suggestions
    const [regressionGherkinTestCases, setRegressionGherkinTestCases] = useState(null);
    // State to manage loading status during AI generation
    const [isLoading, setIsLoading] = useState(false);
    // State to manage PDF loading status
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    // State to store any error messages
    const [errorMessage, setErrorMessage] = useState('');

    /**
     * Handles PDF file upload and extracts text content.
     * @param {Event} event The file input change event.
     */
    const handlePdfUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        if (file.type !== 'application/pdf') {
            setErrorMessage('Por favor, selecciona un archivo PDF válido.');
            return;
        }

        setIsPdfLoading(true);
        setErrorMessage('');
        setJiraContent(''); // Clear previous content

        try {
            // Dynamically load PDF.js if not already available
            if (typeof window.pdfjsLib === 'undefined') {
                await loadPdfJs();
            }

            // Define PDF_WORKER_SRC directly here to ensure it's in scope
            const PDF_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(' ') + '\n';
            }
            setJiraContent(fullText);
        } catch (error) {
            console.error("Error al leer el PDF:", error);
            setErrorMessage(`Error al leer el PDF: ${error.message}. Asegúrate de que es un PDF de texto seleccionable.`);
        } finally {
            setIsPdfLoading(false);
        }
    };

    /**
     * Dynamically loads the PDF.js library.
     */
    const loadPdfJs = () => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load PDF.js library.'));
            document.head.appendChild(script);
        });
    };

    /**
     * Handles the analysis process:
     * 1. Validates input, including the mandatory Jira link.
     * 2. Simulates fetching additional context based on the Jira link.
     * 3. Calls the Gemini AI model to generate main test cases, impacts, and regression test suggestions.
     * 4. Makes a second AI call to convert regression suggestions into Gherkin test cases.
     * 5. Updates state with results or errors.
     */
    const handleAnalyze = async () => {
        // Clear previous results and errors
        setTestCases(null);
        setImpacts('');
        setRegressionTestSuggestions('');
        setRegressionGherkinTestCases(null);
        setErrorMessage('');

        if (!jiraLink.trim()) {
            setErrorMessage('El enlace de Jira es obligatorio para el análisis de impacto.');
            return;
        }

        if (!jiraContent.trim()) {
            setErrorMessage('Por favor, ingresa la descripción de la historia o épica de Jira.');
            return;
        }

        setIsLoading(true); // Start loading spinner

        try {
            const currentJiraId = getJiraIdFromUrl(jiraLink);

            let additionalContext = '';
            if (jiraLink.includes('example.com')) {
                additionalContext = `Contexto adicional simulado del enlace de Jira (${jiraLink}): Este enlace podría contener información sobre el proyecto, módulos afectados, historial de cambios, etc.`;
            } else {
                additionalContext = `No se pudo obtener contexto adicional significativo del enlace: ${jiraLink}.`;
            }

            // --- FIRST AI CALL: Generate main test cases, impacts, and regression test suggestions ---
            const firstPrompt = `Analiza la siguiente descripción de una historia de usuario o épica de Jira y el contexto adicional. Genera:
            1. Una lista de casos de prueba detallados en lenguaje Gherkin. Para cada caso de prueba, incluye las propiedades "jiraId" con el ID de Jira "${currentJiraId}", y "priority" (Prioridad: Alta, Media, Baja). El valor de la propiedad "scenario" debe comenzar con la palabra "Validar ".
            2. Una lista de posibles impactos del cambio.
            3. Una lista de pruebas de regresión necesarias. La propiedad "regressionTests" debe ser una cadena de texto que contenga una lista numerada o con viñetas de las pruebas de regresión sugeridas, cada una en una línea separada, que luego se utilizarán para generar escenarios Gherkin.

            La respuesta debe ser un objeto JSON con las siguientes propiedades: "testCases" (un arreglo de objetos Gherkin), "impacts" (una cadena de texto con saltos de línea para cada impacto), y "regressionTests" (una cadena de texto con saltos de línea para cada prueba de regresión).
            Cada objeto de caso de prueba en "testCases" debe tener las propiedades: "feature", "scenario", "given", "when", "then", "jiraId", y "priority".

            Descripción de Jira:
            "${jiraContent}"

            Contexto Adicional (del enlace de Jira):
            "${additionalContext}"

            Ejemplo de formato JSON deseado:
            {
              "testCases": [
                {
                  "jiraId": "${currentJiraId}",
                  "feature": "Gestión de Usuarios",
                  "scenario": "Validar Inicio de sesión exitoso",
                  "given": "Estoy en la página de inicio de sesión\\nY tengo credenciales válidas",
                  "when": "Ingreso mis credenciales\\nY hago clic en el botón 'Iniciar Sesión'",
                  "then": "Debería ser redirigido al panel de control\\nY mi nombre de usuario debería mostrarse en la esquina superior",
                  "priority": "Alta"
                }
              ],
              "impacts": "Posible impacto 1\\nPosible impacto 2",
              "regressionTests": "1. Validar que el inicio de sesión existente sigue funcionando\\n2. Validar que la creación de usuarios no se ve afectada"
            }

            ---

            Genera el análisis completo en JSON ahora:
            sin embargo, ten en cuenta lo siguiente:
            Actúa como Lead QA certificado ISTQB. A partir de cualquier historia de usuario o especificación, diseña una suite completa y priorizada de casos de prueba aplicando técnicas ISTQB apropiadas según el tipo de prueba detectado (funcional, seguridad, rendimiento, otras no funcionales, y estructurales/básicas).

            A partir de la historia de usuario o requerimiento que reciba, genera casos de prueba aplicando ISTQB, seleccionando automáticamente la técnica según el tipo de prueba:
            Funcional (ISTQB CTFL/CTAL-TA): Equivalence Partitioning (EP), Boundary Value Analysis (BVA), Decision Tables (DT), State Transition (ST), Use Cases, Pairwise.
            Seguridad (ISTQB CT-SEC): autenticación, autorización, sesión, validación de entrada, cifrado, logging, errores, pruebas negativas y de abuso.
            Rendimiento (ISTQB CT-PT): carga, estrés, pico/spike, resistencia, escalabilidad, con métricas y SLAs claros.
            No funcionales (ISTQB CTFL/CTAL-TA): usabilidad, compatibilidad, confiabilidad, accesibilidad, mantenibilidad.
             Estructurales (CTFL/CTAL-TTA): cobertura por sentencias, ramas, condiciones, MC/DC. En la columna de escenario debes indicar que tipo de tecnica de ISTQB aplicaste
             La respuesta completa a menos de que sean terminos tecnicos debe estar en español, los terminos tecnicos pueden estar en ingles, las tecnicas de ISTQB si deben estar en español, recuerda que debes añadirla en la columna feature.`;

            let chatHistoryFirstCall = [];
            chatHistoryFirstCall.push({ role: "user", parts: [{ text: firstPrompt }] });

            const payloadFirstCall = {
                contents: chatHistoryFirstCall,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            "testCases": {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        "jiraId": { "type": "STRING" },
                                        "feature": { "type": "STRING" },
                                        "scenario": { "type": "STRING" },
                                        "given": { "type": "STRING" },
                                        "when": { "type": "STRING" },
                                        "then": { "type": "STRING" },
                                        "priority": { "type": "STRING" } // Added priority to schema
                                    },
                                    "propertyOrdering": ["jiraId", "feature", "scenario", "given", "when", "then", "priority"] // Added priority to ordering
                                }
                            },
                            "impacts": { "type": "STRING" },
                            "regressionTests": { "type": "STRING" }
                        },
                        "propertyOrdering": ["testCases", "impacts", "regressionTests"]
                    }
                }
            };


            // Keep API key as is
            const apiKey = import.meta.env.VITE_API_KEY;
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const responseFirstCall = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadFirstCall)
            });

            if (!responseFirstCall.ok) {
                const errorData = await responseFirstCall.json();
                throw new Error(`Error ${responseFirstCall.status}: ${errorData.message || 'Error desconocido en la primera llamada a la API.'}`);
            }

            const resultFirstCall = await responseFirstCall.json();
            let parsedFirstJson = {};

            // Robust check for the first API call response structure
            if (resultFirstCall.candidates && resultFirstCall.candidates.length > 0 &&
                resultFirstCall.candidates[0].content && resultFirstCall.candidates[0].content.parts &&
                resultFirstCall.candidates[0].content.parts.length > 0 &&
                resultFirstCall.candidates[0].content.parts[0].text) {
                const jsonTextFirstCall = resultFirstCall.candidates[0].content.parts[0].text;
                try {
                    parsedFirstJson = JSON.parse(jsonTextFirstCall);
                    setTestCases(sortTestCasesByPriority(parsedFirstJson.testCases || []));
                    setImpacts(parsedFirstJson.impacts || '');
                    setRegressionTestSuggestions(parsedFirstJson.regressionTests || ''); // Set initial suggestions
                } catch (jsonParseError) {
                    setErrorMessage(`Error al parsear la primera respuesta JSON: ${jsonParseError.message}. Respuesta: ${jsonTextFirstCall}`);
                    setIsLoading(false);
                    return;
                }
            } else {
                setErrorMessage('No se pudieron generar los datos iniciales. La respuesta de la IA no fue la esperada o está vacía.');
                setIsLoading(false);
                return;
            }

            // --- SECOND AI CALL: Generate Gherkin test cases from regression suggestions ---
            if (parsedFirstJson.regressionTests && parsedFirstJson.regressionTests.trim()) {
                const secondPrompt = `Convierte la siguiente lista de pruebas de regresión sugeridas en un arreglo JSON de objetos de casos de prueba en formato Gherkin. Cada objeto debe tener las propiedades: "feature" (usa "Regresión" o una característica relevante si se puede inferir), "scenario" (debe comenzar con "Validar "), "given", "when", y "then". Incluye la propiedad "jiraId" con el ID de Jira "${currentJiraId}".

                Lista de pruebas de regresión sugeridas:
                "${parsedFirstJson.regressionTests}"

                Ejemplo de formato JSON deseado:
                [
                  {
                    "jiraId": "${currentJiraId}",
                    "feature": "Regresión",
                    "scenario": "Validar funcionalidad de inicio de sesión",
                    "given": "El usuario está en la página de inicio de sesión",
                    "when": "Ingresa credenciales válidas",
                    "then": "El usuario es redirigido al panel principal",
                    "priority": "Media"
                  },
                  {
                    "jiraId": "${currentJiraId}",
                    "feature": "Regresión",
                    "scenario": "Validar creación de nuevos usuarios",
                    "given": "El administrador está en la sección de gestión de usuarios",
                    "when": "Intenta crear un nuevo usuario con datos válidos",
                    "then": "El nuevo usuario es creado exitosamente",
                    "priority": "Alta"
                  }
                ]

                ---

                Genera los casos de prueba de regresión en Gherkin ahora:`;

                let chatHistorySecondCall = [];
                chatHistorySecondCall.push({ role: "user", parts: [{ text: secondPrompt }] });

                const payloadSecondCall = {
                    contents: chatHistorySecondCall,
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    "jiraId": { "type": "STRING" },
                                    "feature": { "type": "STRING" },
                                    "scenario": { "type": "STRING" },
                                    "given": { "type": "STRING" },
                                    "when": { "type": "STRING" },
                                    "then": { "type": "STRING" },
                                    "priority": { "type": "STRING" } // Added priority to schema
                                },
                                "propertyOrdering": ["jiraId", "feature", "scenario", "given", "when", "then", "priority"] // Added priority to ordering
                            }
                        }
                    }
                };

                const responseSecondCall = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadSecondCall)
                });

                if (!responseSecondCall.ok) {
                    const errorData = await responseSecondCall.json();
                    throw new Error(`Error ${responseSecondCall.status}: ${errorData.message || 'Error desconocido en la segunda llamada a la API.'}`);
                }

                const resultSecondCall = await responseSecondCall.json();

                // Robust check for the second API call response structure
                if (resultSecondCall.candidates && resultSecondCall.candidates.length > 0 &&
                    resultSecondCall.candidates[0].content && resultSecondCall.candidates[0].content.parts &&
                    resultSecondCall.candidates[0].content.parts.length > 0 &&
                    resultSecondCall.candidates[0].content.parts[0].text) {
                    const jsonTextSecondCall = resultSecondCall.candidates[0].content.parts[0].text;
                    try {
                        const parsedSecondJson = JSON.parse(jsonTextSecondCall);
                        if (Array.isArray(parsedSecondJson)) {
                            // Sort regression test cases by priority
                            setRegressionGherkinTestCases(sortTestCasesByPriority(parsedSecondJson));
                        } else {
                            setErrorMessage('La segunda respuesta de la IA no es un formato de arreglo JSON válido.');
                        }
                    } catch (jsonParseError) {
                        setErrorMessage(`Error al parsear la segunda respuesta JSON: ${jsonParseError.message}. Respuesta: ${jsonTextSecondCall}`);
                    }
                } else {
                    setErrorMessage('No se pudieron generar casos de prueba de regresión Gherkin. La respuesta de la IA no fue la esperada o está vacía.');
                }
            }

        } catch (error) {
            console.error('Error general al generar análisis:', error);
            setErrorMessage(`Ocurrió un error: ${error.message}. Por favor, inténtalo de nuevo.`);
        } finally {
            setIsLoading(false); // Stop loading spinner
        }
    };

    /**
     * Helper function to escape text for CSV, handling commas, double quotes, and newlines.
     * It also ensures compatibility with various special characters by using UTF-8 encoding
     * when creating the Blob, which is standard for Google Sheets compatibility.
     * Special characters beyond those handled by CSV standard (e.g., accents) are preserved
     * due to UTF-8 encoding. If a stricter "omission" of non-standard characters is needed,
     * a specific regex filter would be required here (e.g., `text.replace(/[^a-zA-Z0-9\s.,]/g, '')`).
     * This current implementation focuses on CSV format integrity.
     * @param {string} text The text to escape.
     * @returns {string} The escaped text.
     */
    const escapeCsv = (text) => {
        if (text === null || text === undefined) return '';
        let escapedText = String(text).replace(/"/g, '""').replace(/\n/g, ' '); // Replace internal double quotes and newlines
        // Enclose in double quotes if the text contains commas or double quotes (after replacement)
        if (escapedText.includes(',') || escapedText.includes('"')) {
            escapedText = `"${escapedText}"`;
        }
        return escapedText;
    };

    /**
     * Formats the generated test cases and analysis into a CSV string for export.
     * @returns {string} The formatted CSV content.
     */
    const formatContentForCsvExport = () => {
        const headers = ["ID de Jira", "Característica", "Escenario", "Prioridad", "Dado", "Cuando", "Entonces"];
        let csvContent = headers.map(h => `"${h}"`).join(',') + '\n';

        const addTestCasesToCsv = (cases) => {
            cases.forEach(tc => {
                const row = [
                    escapeCsv(tc.jiraId),
                    escapeCsv(tc.feature),
                    escapeCsv(tc.scenario),
                    escapeCsv(tc.priority),
                    escapeCsv(tc.given),
                    escapeCsv(tc.when),
                    escapeCsv(tc.then)
                    
                ];
                csvContent += row.join(',') + '\n';
            });
        };

        if (testCases && testCases.length > 0) {
            csvContent += '\n"--- Casos de Prueba Principales ---"\n';
            addTestCasesToCsv(testCases);
        }

        if (regressionGherkinTestCases && regressionGherkinTestCases.length > 0) {
            csvContent += '\n"--- Casos de Prueba de Regresión ---"\n';
            addTestCasesToCsv(regressionGherkinTestCases);
        }

        // Add impacts and regression suggestions as separate sections if needed
        if (impacts) {
            csvContent += `\n"--- Impactos Sugeridos ---"\n"${escapeCsv(impacts)}"\n`;
        }
        if (regressionTestSuggestions) {
            csvContent += `\n"--- Sugerencias de Pruebas de Regresión (Texto) ---"\n"${escapeCsv(regressionTestSuggestions)}"\n`;
        }

        return csvContent;
    };

    /**
     * Handles the export of generated content to a CSV file.
     */
    const handleExport = () => {
        const content = formatContentForCsvExport();
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'casos_prueba_jira.csv'; // Changed to .csv
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up the URL object
    };


    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-inter">
            <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-5xl border border-gray-200">
                {/* Nuevo título añadido aquí */}
                <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">
                    Implementación de IA en Quality Assurance Kushki
                </h2>

                <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
                    Generador de Casos de Prueba y Análisis de Impacto para Jira
                </h1>
                <p className="text-gray-600 text-center mb-8">
                    Pega el enlace y la descripción de tu historia de usuario o épica de Jira a continuación. La IA generará casos de prueba, sugerirá impactos y pruebas de regresión.
                </p>

                {/* Jira Link Input (now mandatory) */}
                <div className="mb-6">
                    <label htmlFor="jiraLink" className="block text-gray-700 text-sm font-medium mb-2">
                        Enlace de Jira <span className="text-red-500">*</span>:
                    </label>
                    <input
                        type="url" // Use type="url" for better validation
                        id="jiraLink"
                        value={jiraLink}
                        onChange={(e) => setJiraLink(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                        placeholder="Ej: https://jira.example.com/browse/PROJ-123"
                        required
                    />
                </div>

                {/* PDF Import Section */}
                <div className="mb-6 flex items-center space-x-4">
                    <label htmlFor="pdfUpload" className="block text-gray-700 text-sm font-medium">
                        Importar Descripción desde PDF:
                    </label>
                    <input
                        type="file"
                        id="pdfUpload"
                        accept=".pdf"
                        onChange={handlePdfUpload}
                        className="hidden" // Hide the default file input
                    />
                    <button
                        onClick={() => document.getElementById('pdfUpload').click()}
                        disabled={isPdfLoading}
                        className={`py-2 px-4 rounded-md text-white font-semibold transition duration-300 ${isPdfLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
                            }`}
                    >
                        {isPdfLoading ? (
                            <div className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Cargando PDF...
                            </div>
                        ) : (
                            'Seleccionar PDF'
                        )}
                    </button>
                </div>

                {/* Jira Content Textarea */}
                <div className="mb-6">
                    <label htmlFor="jiraContent" className="block text-gray-700 text-sm font-medium mb-2">
                        Contenido de la historia/épica de Jira <span className="text-red-500">*</span>:
                    </label>
                    <textarea
                        id="jiraContent"
                        rows="10"
                        value={jiraContent}
                        onChange={(e) => setJiraContent(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-y"
                        placeholder="Pega aquí la descripción completa de tu historia de usuario o épica de Jira (ej. 'Como usuario, quiero...' o 'Funcionalidad XYZ...'). También puedes importar un PDF."
                        required
                    ></textarea>
                </div>

                {/* Analyze Button */}
                <div className="mb-6">
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading}
                        className={`w-full py-3 px-4 rounded-md text-white font-semibold transition duration-300 ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                            }`}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analizando...
                            </div>
                        ) : (
                            'Generar Análisis Completo'
                        )}
                    </button>
                </div>

                {/* Error Message Display */}
                {errorMessage && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
                        <strong className="font-bold">¡Error!</strong>
                        <span className="block sm:inline ml-2">{errorMessage}</span>
                    </div>
                )}

                {/* Generated Test Cases Display */}
                {testCases && testCases.length > 0 && (
                    <div className="mt-8 bg-gray-50 p-6 rounded-lg border border-gray-200 overflow-x-auto">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Casos de Prueba Generados (Principales):</h2>
                        <table className="min-w-full divide-y divide-gray-300 rounded-lg overflow-hidden shadow-sm">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        ID de Jira
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Prioridad
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Característica
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Escenario
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Dado
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Cuando
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Entonces
                                    </th>
                                   
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {testCases.map((testCase, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.jiraId}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.priority}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.feature}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.scenario}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.given}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.when}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.then}
                                        </td>
                                        
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {testCases && testCases.length === 0 && (
                    <div className="mt-8 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Información:</strong>
                        <span className="block sm:inline ml-2">No se generaron casos de prueba principales para la descripción proporcionada.</span>
                    </div>
                )}

                {/* Impacts Section */}
                {impacts && (
                    <div className="mt-8 bg-orange-50 p-6 rounded-lg border border-orange-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Impactos Sugeridos:</h2>
                        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed bg-white p-4 rounded-md border border-orange-300 shadow-inner">
                            {impacts}
                        </pre>
                    </div>
                )}

                {/* Regression Test Suggestions Section (initial plain text) */}
                {regressionTestSuggestions && (
                    <div className="mt-8 bg-purple-50 p-6 rounded-lg border border-purple-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Sugerencias de Pruebas de Regresión (Texto):</h2>
                        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed bg-white p-4 rounded-md border border-purple-300 shadow-inner">
                            {regressionTestSuggestions}
                        </pre>
                    </div>
                )}

                {/* Regression Gherkin Test Cases Section */}
                {regressionGherkinTestCases && regressionGherkinTestCases.length > 0 && (
                    <div className="mt-8 bg-green-50 p-6 rounded-lg border border-green-200 overflow-x-auto">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Casos de Prueba de Regresión Generados (Gherkin):</h2>
                        <table className="min-w-full divide-y divide-gray-300 rounded-lg overflow-hidden shadow-sm">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        ID de Jira
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Prioridad
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Característica
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Escenario
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Dado
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Cuando
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Entonces
                                    </th>
                                   
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {regressionGherkinTestCases.map((testCase, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.jiraId}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.priority}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.feature}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.scenario}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.given}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.when}
                                        </td>
                                        <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-900">
                                            {testCase.then}
                                        </td>
                                       
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {regressionGherkinTestCases && regressionGherkinTestCases.length === 0 && regressionTestSuggestions && (
                    <div className="mt-8 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Información:</strong>
                        <span className="block sm:inline ml-2">No se pudieron generar casos de prueba Gherkin a partir de las sugerencias de regresión.</span>
                    </div>
                )}

                {/* Export Button */}
                {(testCases && testCases.length > 0) || (regressionGherkinTestCases && regressionGherkinTestCases.length > 0) || impacts || regressionTestSuggestions ? (
                    <div className="mt-8 text-center">
                        <button
                            onClick={handleExport}
                            className="py-3 px-6 rounded-md text-white font-semibold bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-300"
                        >
                            Exportar a CSV (Compatible con Google Sheets)
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default App;
