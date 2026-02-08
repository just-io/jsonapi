import { ResourceDeclaration } from './resource-declaration';
import { ResourceIdentifier } from './common';

export type FormatResourceOptions = {
    excludeEmptyRelationships?: boolean;
    excludeLinks?: boolean;
    fields?: string[];
};

export interface RelationshipPresenter<M, D extends ResourceDeclaration, R extends keyof D['relationships']> {
    data: ResourceIdentifier<D['relationships'][R]['types']> | null;
    links: {
        self: string;
        related: string;
    };
    meta?: M;
}

export interface RelationshipsPresenter<M, D extends ResourceDeclaration, R extends keyof D['relationships']> {
    data: ResourceIdentifier<D['relationships'][R]['types']>[];
    links: {
        self: string;
        related: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
    meta?: M;
}

export interface ResourcePresenter<M, D extends ResourceDeclaration> {
    type: D['type'];
    id: string;
    lid?: string;
    attributes: D['attributes'];
    links?: {
        self: string;
    };
    relationships?: {
        [K in keyof D['relationships']]: D['relationships'][K]['multiple'] extends true
            ? RelationshipsPresenter<M, D, K>
            : RelationshipPresenter<M, D, K>;
    };
    meta?: M;
}

export interface CommonError {
    code?: string;
    source?:
        | {
              pointer: string;
              header?: string;
          }
        | {
              parameter: 'include' | 'fields' | 'sort' | 'filter' | 'page' | 'query' | 'method';
              header?: string;
          };
    status: number;
    title: string;
    detail?: string;
}

export interface FetchResponseError {
    errors: CommonError[];
}

export interface FetchResourceIdentifierData<M> {
    data: ResourceIdentifier<string>;
    meta?: M;
    links: {
        self: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
}

export interface FetchResponseResourcesData<M, D extends ResourceDeclaration, I extends ResourceDeclaration[] = []> {
    data: ResourcePresenter<M, D>[];
    meta?: M;
    links: {
        self: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
    included?: ResourcePresenter<M, I[number]>[];
}

export interface FetchNotExistResponseResourceData<M> {
    data: null;
    meta?: M;
    links: {
        self: string;
    };
    included?: [];
}

export interface FetchExistResponseResourceData<
    M,
    D extends ResourceDeclaration,
    I extends ResourceDeclaration[] = [],
> {
    data: ResourcePresenter<M, D>;
    meta?: M;
    links: {
        self: string;
    };
    included?: ResourcePresenter<M, I[number]>[];
}

export type FetchResponseResourceData<M, D extends ResourceDeclaration, I extends ResourceDeclaration[] = []> =
    | FetchExistResponseResourceData<M, D, I>
    | FetchNotExistResponseResourceData<M>;

export interface FetchResponseRelationshipData<
    M,
    D extends ResourceDeclaration,
    R extends keyof D['relationships'],
    I extends ResourceDeclaration[] = [],
> extends RelationshipPresenter<M, D, R> {
    included?: ResourcePresenter<M, I[number]>[];
}

export interface FetchResponseRelationshipsData<
    M,
    D extends ResourceDeclaration,
    R extends keyof D['relationships'],
    I extends ResourceDeclaration[] = [],
> extends RelationshipsPresenter<M, D, R> {
    included?: ResourcePresenter<M, I[number]>[];
}

export interface FetchResponseOperationsData<M> {
    'atomic:results': (
        | FetchResponseResourceData<M, ResourceDeclaration>
        | FetchResponseResourcesData<M, ResourceDeclaration>
        | FetchResponseRelationshipData<M, ResourceDeclaration, keyof ResourceDeclaration['relationships']>
        | FetchResponseRelationshipsData<M, ResourceDeclaration, keyof ResourceDeclaration['relationships']>
    )[];
}

export type FetchResponse<M> =
    | FetchResponseError
    | FetchResponseResourceData<M, ResourceDeclaration>
    | FetchResponseResourcesData<M, ResourceDeclaration>
    | FetchResponseRelationshipData<M, ResourceDeclaration, keyof ResourceDeclaration['relationships']>
    | FetchResponseRelationshipsData<M, ResourceDeclaration, keyof ResourceDeclaration['relationships']>
    | FetchResponseOperationsData<M>;
