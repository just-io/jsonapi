import { CommonQuery } from '../types';

export type Fetcher<C, P> = (
    context: C,
    method: 'get' | 'add' | 'update' | 'remove' | 'operations',
    query: CommonQuery<P>,
    body?: unknown,
) => Promise<unknown>;

export interface ClientPageProvider<P> {
    toEntries(page: P): [string, string][];
}

export type Options<C, P> = {
    pageProvider: ClientPageProvider<P>;
    fetcher: Fetcher<C, P>;
    domain: string;
    prefix: string;
};
