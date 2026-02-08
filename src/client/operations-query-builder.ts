import {
    FetchExistResponseResourceData,
    FetchNotExistResponseResourceData,
    FetchResponseRelationshipData,
    FetchResponseRelationshipsData,
} from '../types/formats';
import { MultipleKeys, ResourceDeclaration } from '../types/resource-declaration';
import { Operation } from '../types/common';
import { Options } from './types';

type OperationResult<
    M,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    O extends Operation<any, any>,
    D extends ResourceDeclaration = O extends Operation<infer RD>
        ? RD extends ResourceDeclaration
            ? RD
            : never
        : never,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    R extends MultipleKeys<D> = O extends Operation<any, infer K> ? (K extends MultipleKeys<D> ? K : never) : never,
> = O extends { op: 'add' }
    ? FetchExistResponseResourceData<M, D>
    : O extends { op: 'update' }
    ? FetchExistResponseResourceData<M, D>
    : O extends { op: 'remove' }
    ? FetchNotExistResponseResourceData<D>
    : R extends MultipleKeys<D>
    ? FetchResponseRelationshipsData<M, D, R>
    : FetchResponseRelationshipData<M, D, R>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FetchResponseOperationsData<M, OA extends Operation<any, any>[]> {
    'atomic:results': {
        -readonly [P in keyof OA]: OperationResult<M, OA[P]>;
    };
}

const operationMap = {
    'add-relationships': 'add',
    'update-relationships': 'update',
    'remove-relationships': 'remove',
    add: 'add',
    update: 'update',
    remove: 'remove',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class OperationsQueryBuilder<C, P, M, const OA extends Operation<any, any>[]> {
    #options: Options<C, P>;

    #operations: OA;

    constructor(operations: OA, options: Options<C, P>) {
        this.#operations = operations;
        this.#options = options;
    }

    exec(context: C): Promise<FetchResponseOperationsData<M, OA>> {
        return this.#options.fetcher(
            context,
            'operations',
            { ref: { type: 'operations' } },
            {
                'atomic:operations': this.#operations.map((operation) => ({
                    ...operation,
                    op: operationMap[operation.op],
                })),
            },
        ) as Promise<FetchResponseOperationsData<M, OA>>;
    }
}
