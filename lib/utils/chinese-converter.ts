/**
 * Chinese character conversion utility
 * Converts between Simplified and Traditional Chinese characters
 */

import { Converter } from 'opencc-js';

// Cache converter instance for performance
let converterInstance: ((text: string) => string) | null = null;

/**
 * Initialize the OpenCC converter
 * Converts from Simplified Chinese (cn) to Traditional Chinese Taiwan variant (tw)
 */
function getConverter(): (text: string) => string {
  if (!converterInstance) {
    // Initialize converter: cn (Simplified) -> tw (Traditional Taiwan)
    converterInstance = Converter({ from: 'cn', to: 'tw' });
  }
  return converterInstance;
}

/**
 * Convert Simplified Chinese text to Traditional Chinese
 * @param text - Text in Simplified Chinese
 * @returns Text converted to Traditional Chinese (Taiwan variant)
 */
export function convertToTraditional(text: string): string {
  if (!text) return text;
  
  const converter = getConverter();
  return converter(text);
}

/**
 * Convert text based on character set preference
 * @param text - Text in Simplified Chinese (source format)
 * @param characterSet - Target character set ('simplified' | 'traditional')
 * @returns Converted text or original text if simplified
 */
export function convertText(
  text: string,
  characterSet: 'simplified' | 'traditional'
): string {
  if (characterSet === 'traditional') {
    return convertToTraditional(text);
  }
  return text;
}
