import {
	type UseSuspenseQueryResult,
	useSuspenseQuery,
} from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { apiClient } from './api-client';

type ErrorMessage = {
	message: string;
	reason: string;
	stack: string;
};

export function suspenseQuery<
	S,
	M extends keyof S,
	P extends InferRequestType<S[M]>,
	R extends InferResponseType<S[M]>['data'],
>(func: S, method: M, props: P): UseSuspenseQueryResult<R, ErrorMessage> {
	return useSuspenseQuery<unknown, ErrorMessage, R, string[]>({
		queryKey: [...(JSON.stringify(props) ?? [])],
		queryFn: async () => {
			const data = await (func[method] as (props: P) => Promise<R>)(props);
			return data;
		},
	});
}

const { data } = suspenseQuery(apiClient.user.getTickets, '$get', {
	query: { id: '1' },
});

