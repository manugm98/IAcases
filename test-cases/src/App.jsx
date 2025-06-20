import React, { useState } from 'react'; // Corrected import statement

// Function to extract Jira ID from URL - moved outside App component for cleaner structure
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

// Main App component for the Jira Test Case Generator
function App() {
    // State to hold the Jira link (now mandatory)
    const [jiraLink, setJiraLink] = useState('');
    // State to hold the Jira story/epic description content
    const [jiraContent, setJiraContent] = useState('');
    // State to store the generated test cases as structured data
    const [testCases, setTestCases] = useState(null);
    // State to store the generated impacts analysis
    const [impacts, setImpacts] = useState('');
    // State to store the generated regression tests suggestions
    const [regressionTests, setRegressionTests] = useState('');
    // State to manage loading status during AI generation
    const [isLoading, setIsLoading] = useState(false);
    // State to store any error messages
    const [errorMessage, setErrorMessage] = useState('');

    /**
     * Handles the analysis process:
     * 1. Validates input, including the mandatory Jira link.
     * 2. Simulates fetching additional context based on the Jira link.
     * 3. Calls the Gemini AI model to generate test cases, impacts, and regression tests.
     * 4. Updates state with results or errors.
     */
    const handleAnalyze = async () => {
        // Clear previous results and errors
        setTestCases(null);
        setImpacts('');
        setRegressionTests('');
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
            // Extract Jira ID from the provided link for context and eventual inclusion in test cases
            const currentJiraId = getJiraIdFromUrl(jiraLink);

            // Simulate fetching additional context from the Jira link (in a real app, this would involve API calls)
            let additionalContext = '';
            // Simple check for example.com, in a real application this would involve robust API calls
            if (jiraLink.includes('example.com')) {
                additionalContext = `Contexto adicional simulado del enlace de Jira (${jiraLink}): Este enlace podría contener información sobre el proyecto, módulos afectados, historial de cambios, etc.`;
            } else {
                additionalContext = `No se pudo obtener contexto adicional significativo del enlace: ${jiraLink}.`;
            }

            // Construct the prompt for the AI model, now specifically requesting Gherkin format, impacts, and regression tests in JSON
            // Also explicitly ask the AI to include the Jira ID in each test case
            // Added instruction to prepend "Validar " to the scenario title
            const prompt = `Analiza la siguiente descripción de una historia de usuario o épica de Jira y el contexto adicional. Genera:
            1. Una lista de casos de prueba detallados en lenguaje Gherkin. Para cada caso de prueba, incluye la propiedad "jiraId" con el ID de Jira "${currentJiraId}". El valor de la propiedad "scenario" debe comenzar con la palabra "Validar ".
            2. Una lista de posibles impactos del cambio.
            3. Una lista de pruebas de regresión necesarias.

            La respuesta debe ser un objeto JSON con las siguientes propiedades: "testCases" (un arreglo de objetos Gherkin), "impacts" (una cadena de texto con saltos de línea para cada impacto), y "regressionTests" (una cadena de texto con saltos de línea para cada prueba de regresión).
            Cada objeto de caso de prueba en "testCases" debe tener las propiedades: "feature", "scenario", "given", "when", "then", y "jiraId".

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
                  "scenario": "Validar Inicio de sesión exitoso", // Updated example to reflect "Validar " prefix
                  "given": "Estoy en la página de inicio de sesión\\nY tengo credenciales válidas",
                  "when": "Ingreso mis credenciales\\nY hago clic en el botón 'Iniciar Sesión'",
                  "then": "Debería ser redirigido al panel de control\\nY mi nombre de usuario debería mostrarse en la esquina superior"
                }
              ],
              "impacts": "Posible impacto 1\\nPosible impacto 2",
              "regressionTests": "Prueba regresiva crítica 1\\nPrueba regresiva de interfaz 2"
            }

            ---

            Genera el análisis completo en JSON ahora:`;

            // Prepare chat history for the API call
            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });

            // Payload for the Gemini API with structured response schema
            const payload = {
                contents: chatHistory,
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
                                        "jiraId": { "type": "STRING" }, // Added jiraId to schema
                                        "feature": { "type": "STRING" },
                                        "scenario": { "type": "STRING" },
                                        "given": { "type": "STRING" },
                                        "when": { "type": "STRING" },
                                        "then": { "type": "STRING" }
                                    },
                                    "propertyOrdering": ["jiraId", "feature", "scenario", "given", "when", "then"] // Added jiraId to ordering
                                }
                            },
                            "impacts": { "type": "STRING" },
                            "regressionTests": { "type": "STRING" }
                        },
                        "propertyOrdering": ["testCases", "impacts", "regressionTests"]
                    }
                }
            };
            // API key is left empty; Canvas environment will provide it
            const apiKey = "AIzaSyAOlVAOzzIR35EfcvSTFbHDVLL7U2EPf8g";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            // Make the API call
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Check if the response was successful
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Error ${response.status}: ${errorData.message || 'Error desconocido al llamar a la API.'}`);
            }

            const result = await response.json();

            // Extract and parse the generated JSON text from the API response
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const jsonText = result.candidates[0].content.parts[0].text;
                try {
                    const parsedJson = JSON.parse(jsonText);
                    // Update states with parsed data
                    setTestCases(parsedJson.testCases || []);
                    setImpacts(parsedJson.impacts || '');
                    setRegressionTests(parsedJson.regressionTests || '');
                } catch (jsonParseError) {
                    setErrorMessage(`Error al parsear la respuesta JSON: ${jsonParseError.message}. Respuesta: ${jsonText}`);
                }
            } else {
                setErrorMessage('No se pudieron generar casos de prueba ni análisis. La respuesta de la IA no fue la esperada.');
            }
        } catch (error) {
            console.error('Error al generar análisis:', error);
            setErrorMessage(`Ocurrió un error: ${error.message}. Por favor, inténtalo de nuevo.`);
        } finally {
            setIsLoading(false); // Stop loading spinner
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-inter">
            <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-5xl border border-gray-200">
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
                        placeholder="Pega aquí la descripción completa de tu historia de usuario o épica de Jira (ej. 'Como usuario, quiero...' o 'Funcionalidad XYZ...')."
                        required
                    ></textarea>
                </div>

                {/* Analyze Button */}
                <div className="mb-6">
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading}
                        className={`w-full py-3 px-4 rounded-md text-white font-semibold transition duration-300 ${
                            isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
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
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Casos de Prueba Generados:</h2>
                        <table className="min-w-full divide-y divide-gray-300 rounded-lg overflow-hidden shadow-sm">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        ID de Jira
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
                        <span className="block sm:inline ml-2">No se generaron casos de prueba para la descripción proporcionada.</span>
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

                {/* Regression Tests Section */}
                {regressionTests && (
                    <div className="mt-8 bg-green-50 p-6 rounded-lg border border-green-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Pruebas de Regresión Sugeridas:</h2>
                        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed bg-white p-4 rounded-md border border-green-300 shadow-inner">
                            {regressionTests}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
