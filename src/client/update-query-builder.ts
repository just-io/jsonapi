import { FetchExistResponseResourceData } from '../types/formats';
import { EditableResource, PartialResourceDeclaration, ResourceDeclaration } from '../types/resource-declaration';
import { Query } from '../types/common';
import { Options } from './types';

export default class UpdateQueryBuilder<D extends ResourceDeclaration, C, P, M, I extends ResourceDeclaration[]> {
    #options: Options<C, P>;

    #query: Required<Query<P, ResourceDeclaration, [], 'id'>>;

    #editableResource: EditableResource<D>;

    constructor(editableResource: EditableResource<D>, options: Options<C, P>) {
        this.#options = options;
        this.#editableResource = editableResource;

        this.#query = {
            ref: {
                type: editableResource.type,
                id: editableResource.id,
            },
            params: {},
        };
    }

    fields<K extends keyof D['attributes'] | keyof D['relationships']>(
        ...fields: K[]
    ): UpdateQueryBuilder<PartialResourceDeclaration<D, K>, C, P, M, I> {
        const query = new UpdateQueryBuilder<PartialResourceDeclaration<D, K>, C, P, M, I>(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.#editableResource as any,
            this.#options,
        );
        query.#query = structuredClone(this.#query);
        if (!query.#query.params.fields) {
            query.#query.params.fields = {};
        }
        query.#query.params.fields[query.#query.ref.type] = fields as string[];

        return query;
    }

    include<ID extends ResourceDeclaration>(relationship: string): UpdateQueryBuilder<D, C, P, M, [...I, ID]>;
    include<ID extends ResourceDeclaration, K extends keyof ID['attributes'] | keyof ID['relationships']>(
        relationship: string,
        type: ID['type'],
        ...fields: K[]
    ): UpdateQueryBuilder<D, C, P, M, [...I, PartialResourceDeclaration<ID, K>]>;
    include<ID extends ResourceDeclaration, K extends keyof ID['attributes'] | keyof ID['relationships']>(
        relationship: string,
        type?: ID['type'],
        ...fields: K[]
    ): UpdateQueryBuilder<D, C, P, M, [...I, ID]> {
        const query = new UpdateQueryBuilder<D, C, P, M, [...I, ID]>(this.#editableResource, this.#options);
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

    exec(context: C): Promise<FetchExistResponseResourceData<M, D, I>> {
        return this.#options.fetcher(context, 'update', this.#query, { data: this.#editableResource }) as Promise<
            FetchExistResponseResourceData<M, D, I>
        >;
    }
}
