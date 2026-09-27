/**
 * Spintax Parser & Template Hydrator for WaOutreach
 *
 * Supports:
 * 1. Recursive / Nested Spintax: {Hi|Hello|{Hey|Greetings}}
 * 2. Lead Variable Interpolation: {{name}}, {{company}}, {{custom_field}}
 * 3. Fallback variable syntax: {{name|there}}
 */

/**
 * Resolves nested curly-brace spintax expressions by picking random options from innermost outward.
 * @param {string} text - Spintax template string
 * @returns {string} - Spun text
 */
export function spinText(text) {
  if (!text || typeof text !== 'string') return '';

  // Only match curly braces that contain at least one pipe '|' (i.e., genuine spintax choices)
  const spintaxRegex = /\{([^{}]*\|[^{}]*)\}/;
  let spun = text;

  let iterations = 0;
  const maxIterations = 50; // Safety guardrail against malformed infinite regex loops

  while (spintaxRegex.test(spun) && iterations < maxIterations) {
    spun = spun.replace(spintaxRegex, (_, options) => {
      const choices = options.split('|');
      const randomIndex = Math.floor(Math.random() * choices.length);
      return choices[randomIndex];
    });
    iterations++;
  }

  return spun;
}

/**
 * Hydrates variables in the format {{variableName}} or {{variableName|fallback}}
 * @param {string} text - Message template
 * @param {Record<string, any>} variables - Object with variable values (e.g. { name: 'John', company: 'Acme' })
 * @returns {string} - Hydrated message
 */
export function hydrateVariables(text, variables = {}) {
  if (!text || typeof text !== 'string') return '';

  // Case-insensitive lookup map for variables
  const normalizedVars = {};
  for (const [k, v] of Object.entries(variables || {})) {
    if (v !== undefined && v !== null) {
      normalizedVars[k.toLowerCase()] = String(v).trim();
    }
  }

  return text.replace(/\{\{\s*([a-zA-Z0-9_-]+)(?:\|([^}]+))?\s*\}\}/g, (match, key, fallback) => {
    const lowerKey = key.toLowerCase();
    if (normalizedVars[lowerKey] !== undefined && normalizedVars[lowerKey] !== '') {
      return normalizedVars[lowerKey];
    }
    return fallback !== undefined ? fallback.trim() : '';
  });
}

/**
 * Combined Spintax Parser and Variable Hydrator
 * Hydrates variables and resolves spintax alternatives.
 *
 * @param {string} template - Raw spintax template with {{vars}}
 * @param {Record<string, any>} variables - Lead data attributes
 * @returns {string} - Final humanized personalized message
 */
export function parseSpintax(template, variables = {}) {
  if (!template) return '';
  const hydrated = hydrateVariables(template, variables);
  return spinText(hydrated);
}

/**
 * Generates N sample variations for frontend preview/testing
 * @param {string} template
 * @param {Record<string, any>} sampleVariables
 * @param {number} count
 * @returns {string[]}
 */
export function generateVariations(template, sampleVariables = {}, count = 4) {
  const variations = new Set();
  const maxTries = count * 4;
  let tries = 0;

  while (variations.size < count && tries < maxTries) {
    variations.add(parseSpintax(template, sampleVariables));
    tries++;
  }

  return Array.from(variations);
}

export default {
  spinText,
  hydrateVariables,
  parseSpintax,
  generateVariations
};
