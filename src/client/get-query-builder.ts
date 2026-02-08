import { FetchResponseResourceData } from '../types/formats';
import { PartialResourceDeclaration, ResourceDeclaration } from '../types/resource-declaration';
import { Query } from '../types/common';
import { Options } from './types';

export default class GetQueryBuilder<D extends ResourceDeclaration, C, P, M, I extends ResourceDeclaration[]> {
    #options: Options<C, P>;

    #query: Required<Query<P, ResourceDeclaration, [], 'id'>>;

    constructor(type: D['type'], id: string, options: Options<C, P>) {
        this.#options = options;

        this.#query = {
            ref: {
                type,
                id,
            },
            params: {},
        };
    }

    fields<K extends keyof D['attributes'] | keyof D['relationships']>(
        ...fields: K[]
    ): GetQueryBuilder<PartialResourceDeclaration<D, K>, C, P, M, I> {
        const query = new GetQueryBuilder<PartialResourceDeclaration<D, K>, C, P, M, I>(
            this.#query.ref.type,
            this.#query.ref.id,
            this.#options,
        );
        query.#query = structuredClone(this.#query);
        if (!query.#query.params.fields) {
            query.#query.params.fields = {};
        }
        query.#query.params.fields[query.#query.ref.type] = fields as string[];

        return query;
    }

    include<ID extends ResourceDeclaration>(relationship: string): GetQueryBuilder<D, C, P, M, [...I, ID]>;
    include<ID extends ResourceDeclaration, K extends keyof ID['attributes'] | keyof ID['relationships']>(
        relationship: string,
        type: ID['type'],
        ...fields: K[]
    ): GetQueryBuilder<D, C, P, M, [...I, PartialResourceDeclaration<ID, K>]>;
    include<ID extends ResourceDeclaration, K extends keyof ID['attributes'] | keyof ID['relationships']>(
        relationship: string,
        type?: ID['type'],
        ...fields: K[]
    ): GetQueryBuilder<D, C, P, M, [...I, ID]> {
        const query = new GetQueryBuilder<D, C, P, M, [...I, ID]>(
            this.#query.ref.type,
            this.#query.ref.id,
            this.#options,
        );
        query.#query = structuredClone(this.#query);
        if (type && fields) {
            if (!query.#query.params.fields) {
                query.#query.params.fields = {};
            }
            query.#query.params.fields[type] = fields as string[];
        }
        if (!query.#query.params.include) {
            query.#query.params.include = [];
        }
        query.#query.params.include.push(relationship.split('.'));

        return query;
    }

    page(page: P): this {
        this.#query.params.page = page;

        return this;
    }

    exec(context: C): Promise<FetchResponseResourceData<M, D, I>> {
        return this.#options.fetcher(context, 'get', this.#query) as Promise<FetchResponseResourceData<M, D, I>>;
    }
}
