import { Schema } from '@just-io/schema';
import {
    MultipleKeys,
    MultipleRelationshipTypes,
    OperationEditableResource,
    OperationNewResource,
    RelationshipValue,
    Resource,
    ResourceDeclaration,
    SingleRelationshipTypes,
} from './resource-declaration';

export type MetaType = Record<string, unknown>;

export type ResourceIdentifier<T> = {
    type: T;
    id: string;
};

export type ResourceLocalIdentifier<T> = {
    type: T;
    lid: string;
};

export type OperationResourceIdentifier<T> = ResourceIdentifier<T> | ResourceLocalIdentifier<T>;

export type CommonResourceRelationship = DataList<ResourceIdentifier<string>> | ResourceIdentifier<string> | null;

export type QueryRef<
    D extends ResourceDeclaration,
    T extends 'list' | 'id' | 'relationship',
    R extends keyof D['relationships'] = keyof D['relationships'],
> = T extends 'relationship'
    ? {
          type: D['type'];
          id: string;
          related?: boolean;
          relationship: R & string;
      }
    : T extends 'id'
    ? {
          type: D['type'];
          id: string;
      }
    : {
          type: D['type'];
      };

export type OperationQueryRef<
    D extends ResourceDeclaration,
    T extends 'id' | 'relationship',
    R extends keyof D['relationships'] = keyof D['relationships'],
> = (T extends 'relationship'
    ? {
          type: D['type'];
          relationship: R;
      }
    : {
          type: D['type'];
      }) &
    (
        | {
              id: string;
          }
        | {
              lid: string;
          }
    );

export type CommonQueryRef = QueryRef<ResourceDeclaration, 'list' | 'id' | 'relationship'>;

export type Fields<D extends ResourceDeclaration> = {
    [K in D['type']]?: (keyof D['attributes'] | keyof D['relationships'])[];
};

export type ArrayFields<IRD extends ResourceDeclaration[]> = IRD extends [infer I, ...infer R]
    ? I extends ResourceDeclaration
        ? R extends ResourceDeclaration[]
            ? Fields<I> & ArrayFields<R>
            : Record<string, never>
        : never
    : IRD extends [infer I]
    ? I extends ResourceDeclaration
        ? Fields<I>
        : never
    : unknown;

export type QueryParams<P, D extends ResourceDeclaration, I extends ResourceDeclaration[]> = {
    fields?: ArrayFields<[D, ...I]>;
    filter?: {
        [K in keyof D['filter']]?: string[];
    };
    include?: string[][];
    page?: P;
    sort?: {
        field: D['sort'][keyof D['sort']] extends never ? never : keyof D['sort'] & string;
        asc: boolean;
    }[];
};

export type Query<
    P,
    D extends ResourceDeclaration,
    I extends ResourceDeclaration[],
    T extends 'list' | 'id' | 'relationship',
    R extends keyof D['relationships'] = keyof D['relationships'],
> = {
    ref: QueryRef<D, T, R>;
    params?: QueryParams<P, D, I>;
};

export type CommonQuery<P> = Query<P, ResourceDeclaration, [], 'list' | 'id' | 'relationship'>;

export interface SortField {
    field: string;
    asc: boolean;
}

export type FilterFields = Record<string, string[]>;

export interface PageProvider<P> {
    schema: Schema<P, 'default'>;
    extractFromEntries(entries: [string, string][]): P;
    toEntries(page: P): [string, string][];
    getPages(page: P, total: number, limit: number): { first: P; last: P; prev?: P; next?: P };
}

export interface MetaProvider<M> {
    composeList(list: DataList<ResourceIdentifier<string>>): M | undefined;
    compose(resource: ResourceIdentifier<string> | null): M | undefined;
    composeRoot(queryRef: CommonQueryRef): M | undefined;
}

export type OperationRelationshipValue<D extends ResourceDeclaration> =
    | OperationResourceIdentifier<SingleRelationshipTypes<D>>
    | null
    | OperationResourceIdentifier<MultipleRelationshipTypes<D>>[];

export type AddResourceOperation<D extends ResourceDeclaration> = {
    op: 'add';
    data: OperationNewResource<D>;
};

export type UpdateResourceOperation<D extends ResourceDeclaration> = {
    op: 'update';
    data: OperationEditableResource<D>;
};

export type RemoveResourceOperation<D extends ResourceDeclaration> = {
    op: 'remove';
    ref: OperationQueryRef<D, 'id'>;
};

export type AddRelationshipsOperation<D extends ResourceDeclaration, R extends MultipleKeys<D>> = {
    op: 'add-relationships';
    ref: OperationQueryRef<D, 'relationship', R>;
    data: OperationResourceIdentifier<MultipleRelationshipTypes<D>>[];
};

export type UpdateRelationshipsOperation<D extends ResourceDeclaration, R extends MultipleKeys<D>> = {
    op: 'update-relationships';
    ref: OperationQueryRef<D, 'relationship', R>;
    data:
        | OperationResourceIdentifier<SingleRelationshipTypes<D>>
        | null
        | OperationResourceIdentifier<MultipleRelationshipTypes<D>>[];
};

export type RemoveRelationshipsOperation<D extends ResourceDeclaration, R extends MultipleKeys<D>> = {
    op: 'remove-relationships';
    ref: OperationQueryRef<D, 'relationship', R>;
    data: OperationResourceIdentifier<MultipleRelationshipTypes<D>>[];
};

export type Operation<D extends ResourceDeclaration, R extends MultipleKeys<D> = MultipleKeys<D>> =
    | AddResourceOperation<D>
    | UpdateResourceOperation<D>
    | RemoveResourceOperation<D>
    | AddRelationshipsOperation<D, R>
    | UpdateRelationshipsOperation<D, R>
    | RemoveRelationshipsOperation<D, R>;

export type OperationResult<
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
    ? Resource<D>
    : O extends { op: 'update' }
    ? Resource<D>
    : O extends { op: 'remove' }
    ? string
    : [string, RelationshipValue<D['relationships'][R]>];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OperationResults<OA extends Operation<any, any>[]> = {
    -readonly [P in keyof OA]: OperationResult<OA[P]>;
};

export type DataList<V> = {
    items: V[];
    offset?: number;
    total?: number;
    limit?: number;
};

export type UntypedKeys<Obj, T> = {
    [K in keyof Obj]: Obj[K] extends T ? never : K;
}[keyof Obj];

export type PartialRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export type TypedKeys<Obj, T> = {
    [K in keyof Obj]: Obj[K] extends T ? K : never;
}[keyof Obj];

export type FilterRecord<Obj, T> = Pick<Obj, TypedKeys<Obj, T>>;
export type InvertedFilterRecord<Obj, T> = Omit<Obj, TypedKeys<Obj, T>>;

export type FilterValues<Obj, T> = Pick<Obj, TypedKeys<Obj, T>>[TypedKeys<Obj, T>];
export type InvertedFilterValues<Obj, T> = Omit<Obj, TypedKeys<Obj, T>>[Exclude<keyof Obj, TypedKeys<Obj, T>>];
