import { FetchResponseRelationshipData, FetchResponseRelationshipsData } from '../formatter';
import { PartialResourceDeclaration, ResourceDeclaration } from '../resource-declaration';
import { Query } from '../types';
import { Options } from './types';

export default class RelationshipQueryBuilder<
    D extends ResourceDeclaration,
    R extends keyof D['relationships'] & string,
    C,
    P,
    M,
    I extends ResourceDeclaration[],
> {
    #options: Options<C, P>;

    #query: Required<Query<P, ResourceDeclaration, [], 'relationship'>>;

    constructor(type: D['type'], id: string, relationship: R, options: Options<C, P>) {
        this.#options = options;

        this.#query = {
            ref: {
                type,
                id,
                relationship,
            },
            params: {},
        };
    }

    include<ID extends ResourceDeclaration>(relationship: string): RelationshipQueryBuilder<D, R, C, P, M, [...I, ID]>;
    include<ID extends ResourceDeclaration, K extends keyof ID['attributes'] | keyof ID['relationships']>(
        relationship: string,
        type: ID['type'],
        ...fields: K[]
    ): RelationshipQueryBuilder<D, R, C, P, M, [...I, PartialResourceDeclaration<ID, K>]>;
    include<ID extends ResourceDeclaration, K extends keyof ID['attributes'] | keyof ID['relationships']>(
        relationship: string,
        type?: ID['type'],
        ...fields: K[]
    ): RelationshipQueryBuilder<D, R, C, P, M, [...I, ID]> {
        const query = new RelationshipQueryBuilder<D, R, C, P, M, [...I, ID]>(
            this.#query.ref.type,
            this.#query.ref.id,
            this.#query.ref.relationship as R,
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

    page(page: D['relationships'][R]['multiple'] extends true ? P : never): this {
        this.#query.params.page = page;

        return this;
    }

    exec(
        context: C,
    ): Promise<
        D['relationships'][R]['multiple'] extends true
            ? FetchResponseRelationshipsData<M, D, R, I>
            : FetchResponseRelationshipData<M, D, R, I>
    > {
        return this.#options.fetcher(context, 'get', this.#query) as Promise<
            D['relationships'][R]['multiple'] extends true
                ? FetchResponseRelationshipsData<M, D, R, I>
                : FetchResponseRelationshipData<M, D, R, I>
        >;
    }
}
