import { z } from 'zod';
import type { Context } from 'hono';
import { ValidationError } from './common-type.ts';

export function handleError(err: Error, c: Context): Response {
	if (err instanceof z.ZodError) {
		const firstError = err.errors[0]!;

		return c.json(
			{
				code: 422,
				message: `\`${firstError.path}\`: ${firstError.message}`,
				timeISO: new Date().toISOString(),
				stack: err.stack?.split('\n').slice(1, 3).join('\n').trim(),
			},
			422,
		);
	}

	if (err instanceof ValidationError) {
		return c.json(
			{
				code: 422,
				message: err.message,
				timeISO: new Date().toISOString(),
				stack: err.stack?.split('\n').slice(1, 3).join('\n').trim(),
			},
			422,
		);
	}
	console.error(err.stack);
	return c.json(
		{
			code: 500,
			timeISO: new Date().toISOString(),
			message: 'Something went wrong, please try again later.',
			stack: err.stack?.split('\n').slice(0, 2).join('\n'),
		},
		{ status: 500 },
	);
}
