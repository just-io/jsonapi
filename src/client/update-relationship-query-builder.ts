import { FetchResponseRelationshipData, FetchResponseRelationshipsData } from '../types/formats';
import { NewRelationshipValue, PartialResourceDeclaration, ResourceDeclaration } from '../types/resource-declaration';
import { Query } from '../types/common';
import { Options } from './types';

export default class UpdateRelationshipQueryBuilder<
    D extends ResourceDeclaration,
    R extends keyof D['relationships'] & string,
    C,
    P,
    M,
    I extends ResourceDeclaration[],
> {
    #options: Options<C, P>;

    #query: Required<Query<P, ResourceDeclaration, [], 'relationship'>>;

    #value: NewRelationshipValue<D['relationships'][R], 'single'>;

    constructor(
        type: D['type'],
        id: string,
        relationship: R,
        value: NewRelationshipValue<D['relationships'][R], 'single'>,
        options: Options<C, P>,
    ) {
        this.#options = options;
        this.#value = value;

        this.#query = {
            ref: {
                type,
                id,
                relationship,
            },
            params: {},
        };
    }

    include<ID extends ResourceDeclaration>(
        relationship: string,
    ): UpdateRelationshipQueryBuilder<D, R, C, P, M, [...I, ID]>;
    include<ID extends ResourceDeclaration, K extends keyof ID['attributes'] | keyof ID['relationships']>(
        relationship: string,
        type: ID['type'],
        ...fields: K[]
    ): UpdateRelationshipQueryBuilder<D, R, C, P, M, [...I, PartialResourceDeclaration<ID, K>]>;
    include<ID extends ResourceDeclaration, K extends keyof ID['attributes'] | keyof ID['relationships']>(
        relationship: string,
        type?: ID['type'],
        ...fields: K[]
    ): UpdateRelationshipQueryBuilder<D, R, C, P, M, [...I, ID]> {
        const query = new UpdateRelationshipQueryBuilder<D, R, C, P, M, [...I, ID]>(
            this.#query.ref.type,
            this.#query.ref.id,
            this.#query.ref.relationship as R,
            this.#value,
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
        return this.#options.fetcher(context, 'update', this.#query, { data: this.#value }) as Promise<
            D['relationships'][R]['multiple'] extends true
                ? FetchResponseRelationshipsData<M, D, R, I>
                : FetchResponseRelationshipData<M, D, R, I>
        >;
    }
}
