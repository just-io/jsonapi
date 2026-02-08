import { FetchNotExistResponseResourceData } from '../formatter';
import { ResourceDeclaration } from '../resource-declaration';
import { Query } from '../types';
import { Options } from './types';

export default class RemoveQueryBuilder<D extends ResourceDeclaration, C, P> {
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

    exec(context: C): Promise<FetchNotExistResponseResourceData<D>> {
        return this.#options.fetcher(context, 'remove', this.#query) as Promise<FetchNotExistResponseResourceData<D>>;
    }
}
