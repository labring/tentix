import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const kebabToCamel = (str: string) =>
	str.replace(/-./g, (m) => (m).toUpperCase()[1]!);

export const camelToKebab = (str: string) =>
	str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

export type ContentBlock = {
	type: 'text' | 'image' | 'code' | 'link' | 'mention' | 'quote';
	content: string;
};


export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isContentBlockArray(
	// biome-ignore lint/suspicious/noExplicitAny: typescript assert function
	content: any,
): asserts content is ContentBlock[] {
	if (
		typeof content !== 'object' ||
		content === null ||
		!Array.isArray(content)
	) {
		throw new ValidationError('Content block type is required');
	}

	if (
		!content.every(
			(block) =>
				typeof block === 'object' &&
				block !== null &&
				'type' in block &&
				['text', 'image', 'code', 'link', 'mention', 'quote'].includes(
					block.type,
				) &&
				'content' in block &&
				typeof block.content === 'string',
		)
	) {
		throw new ValidationError('Content block type is invalid!');
	}
}
