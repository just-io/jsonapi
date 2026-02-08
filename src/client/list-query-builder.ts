import { FetchResponseResourcesData } from '../formatter';
import { PartialResourceDeclaration, ResourceDeclaration } from '../resource-declaration';
import { Query } from '../types';
import { Options } from './types';

export default class ListQueryBuilder<D extends ResourceDeclaration, C, P, M, I extends ResourceDeclaration[]> {
    #options: Options<C, P>;

    #query: Required<Query<P, ResourceDeclaration, [], 'list'>>;

    constructor(type: D['type'], options: Options<C, P>) {
        this.#options = options;

        this.#query = {
            ref: {
                type,
            },
            params: {},
        };
    }

    fields<K extends keyof D['attributes'] | keyof D['relationships']>(
        ...fields: K[]
    ): ListQueryBuilder<PartialResourceDeclaration<D, K>, C, P, M, I> {
        const query = new ListQueryBuilder<PartialResourceDeclaration<D, K>, C, P, M, I>(
            this.#query.ref.type,
            this.#options,
        );
        query.#query = structuredClone(this.#query);
        if (!query.#query.params.fields) {
            query.#query.params.fields = {};
        }
        query.#query.params.fields[query.#query.ref.type] = fields as string[];

        return query;
    }

    include<ID extends ResourceDeclaration>(relationship: string): ListQueryBuilder<D, C, P, M, [...I, ID]>;
    include<ID extends ResourceDeclaration, K extends keyof ID['attributes'] | keyof ID['relationships']>(
        relationship: string,
        type: ID['type'],
        ...fields: K[]
    ): ListQueryBuilder<D, C, P, M, [...I, PartialResourceDeclaration<ID, K>]>;
    include<ID extends ResourceDeclaration, K extends keyof ID['attributes'] | keyof ID['relationships']>(
        relationship: string,
        type?: ID['type'],
        ...fields: K[]
    ): ListQueryBuilder<D, C, P, M, [...I, ID]> {
        const query = new ListQueryBuilder<D, C, P, M, [...I, ID]>(this.#query.ref.type, this.#options);
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

    filter<
        K extends keyof D['listable']['filter'],
        V extends D['listable']['filter'][K]['multiple'] extends true ? string[] | string : string,
    >(filter: K, value: V): this {
        if (!this.#query.params.filter) {
            this.#query.params.filter = {};
        }
        this.#query.params.filter[filter as string] = Array.isArray(value) ? value : ([value] as string[]);

        return this;
    }

    sort<
        K extends keyof D['listable']['sort'],
        V extends D['listable']['sort'][K]['dir'] extends 'both'
            ? boolean
            : D['listable']['sort'][K]['dir'] extends 'asc'
            ? true
            : false,
    >(field: K, asc: V): this {
        if (!this.#query.params.sort) {
            this.#query.params.sort = [];
        }
        this.#query.params.sort.push({
            field: field as string,
            asc,
        });

        return this;
    }

    exec(context: C): Promise<FetchResponseResourcesData<M, D, I>> {
        return this.#options.fetcher(context, 'get', this.#query) as Promise<FetchResponseResourcesData<M, D, I>>;
    }
}
