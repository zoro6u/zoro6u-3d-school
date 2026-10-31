import elementsJson from '../../../../../content/elements.json';
import type { ElementDef } from './types';

export const elements = elementsJson as Record<string, ElementDef>;
export const elementDef = (symbol: string): ElementDef | undefined => elements[symbol];
