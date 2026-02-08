import { QueryConverter } from './query-converter';
import {
    ResourceIdentifier,
    DataList,
    PageProvider,
    CommonResourceRelationship,
    MetaProvider,
    CommonQueryRef,
    Query,
} from './types';
import { CommonResource, ResourceDeclaration } from './resource-declaration';
import { filterResourceFields } from './utils';
import { CommonError } from './errors';

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

export class Formatter<P, M> {
    #pageProvider: PageProvider<P>;

    #metaProvider: MetaProvider<M>;

    #queryConverter: QueryConverter<P>;

    constructor(pageProvider: PageProvider<P>, metaProvider: MetaProvider<M>, queryConverter: QueryConverter<P>) {
        this.#pageProvider = pageProvider;
        this.#metaProvider = metaProvider;
        this.#queryConverter = queryConverter;
    }

    #getListLinks<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        query: Query<P, D, I, 'list' | 'id' | 'relationship'>,
        total: number,
        limit: number,
    ): Pick<FetchResponseResourcesData<M, D, I>['links'], 'first' | 'last' | 'next' | 'prev'> {
        const pages = this.#pageProvider.getPages(
            query.params?.page ?? this.#pageProvider.extractFromEntries([]),
            total,
            limit,
        );

        return {
            first:
                total > limit
                    ? this.#queryConverter.make({ ref: query.ref, params: { ...query.params, page: pages.first } })
                    : undefined,
            last:
                total > limit
                    ? this.#queryConverter.make({ ref: query.ref, params: { ...query.params, page: pages.last } })
                    : undefined,
            next: pages.next
                ? this.#queryConverter.make({ ref: query.ref, params: { ...query.params, page: pages.next } })
                : undefined,
            prev: pages.prev
                ? this.#queryConverter.make({ ref: query.ref, params: { ...query.params, page: pages.prev } })
                : undefined,
        };
    }

    #makeRelationship<D extends ResourceDeclaration, R extends keyof D['relationships'] & string>(
        type: D['type'],
        id: string,
        relationship: R,
        resourceIdentifier: ResourceIdentifier<D['relationships'][R]['types']> | null,
    ): RelationshipPresenter<M, D, R> {
        return {
            data: resourceIdentifier,
            links: {
                self: this.#queryConverter.makePath({ type, id, relationship, related: false }),
                related: this.#queryConverter.makePath({ type, id, relationship, related: true }),
            },
            meta: this.#metaProvider.compose(resourceIdentifier),
        };
    }

    #makeRelationships<D extends ResourceDeclaration, R extends keyof D['relationships'] & string>(
        type: D['type'],
        id: string,
        relationship: R,
        list: DataList<ResourceIdentifier<D['relationships'][R]['types']>>,
    ): RelationshipsPresenter<M, D, R> {
        return {
            data: list.items,
            links: {
                self: this.#queryConverter.makePath({ type, id, relationship, related: false }),
                related: this.#queryConverter.makePath({ type, id, relationship, related: true }),
                ...this.#getListLinks(
                    this.#queryConverter.makeDefaultQuery({
                        type,
                        id,
                        relationship,
                    }),
                    list.total,
                    list.limit,
                ),
            },
            meta: this.#metaProvider.composeList(list),
        };
    }

    #makeIncluded<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        query: Query<P, D, I, 'list' | 'id' | 'relationship'>,
        included: CommonResource[],
    ): ResourcePresenter<M, I[number]>[] {
        return included
            .filter(
                (includedResource, i, arr) =>
                    i ===
                    arr.findIndex(
                        (aResource) => aResource.id === includedResource.id && aResource.type === includedResource.type,
                    ),
            )
            .map((includedResource) =>
                this.#makeResourceData(includedResource, {
                    fields: query.params?.fields?.[includedResource.type],
                    // excludeEmptyRelationships: true,
                }),
            );
    }

    formatRelationship<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[],
    >(
        query: Query<P, D, I, 'relationship'>,
        resourceIdentifier: ResourceIdentifier<string> | null,
        included: CommonResource[],
    ): FetchResponseRelationshipData<M, D, R, I> {
        return {
            data: resourceIdentifier,
            included: this.#makeIncluded(query, included),
            links: {
                self: this.#queryConverter.makePath({
                    type: query.ref.type,
                    id: query.ref.id,
                    relationship: query.ref.relationship,
                    related: false,
                }),
                related: this.#queryConverter.makePath({
                    type: query.ref.type,
                    id: query.ref.id,
                    relationship: query.ref.relationship,
                    related: true,
                }),
            },
            meta: this.#metaProvider.compose(resourceIdentifier),
        };
    }

    formatRelationships<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[],
    >(
        query: Query<P, D, I, 'relationship'>,
        list: DataList<ResourceIdentifier<string>>,
        included: CommonResource[],
    ): FetchResponseRelationshipsData<M, D, R, I> {
        return {
            data: list.items,
            included: this.#makeIncluded(query, included),
            links: {
                self: this.#queryConverter.make({
                    ref: {
                        type: query.ref.type,
                        id: query.ref.id,
                        relationship: query.ref.relationship,
                        related: false,
                    },
                    params: query.params,
                }),
                related: this.#queryConverter.make({
                    ref: {
                        type: query.ref.type,
                        id: query.ref.id,
                        relationship: query.ref.relationship,
                        related: true,
                    },
                    params: query.params,
                }),
                ...this.#getListLinks(query, list.total, list.limit),
            },
            meta: this.#metaProvider.composeList(list),
        };
    }

    #makeResourceData<D extends ResourceDeclaration>(
        resource: CommonResource,
        options: FormatResourceOptions = {},
    ): ResourcePresenter<M, D> {
        const filteredResource = filterResourceFields(resource, options.fields);
        const keys = Object.keys(filteredResource.relationships);
        const relationships = keys.reduce(
            (obj, key) => {
                const relationship = filteredResource.relationships[key] as CommonResourceRelationship;
                if (relationship && 'items' in relationship) {
                    obj[key] = this.#makeRelationships(filteredResource.type, filteredResource.id, key, relationship);
                } else {
                    obj[key] = this.#makeRelationship(filteredResource.type, filteredResource.id, key, relationship);
                }

                return obj;
            },
            {} as Record<
                string,
                | RelationshipPresenter<M, D, keyof D['relationships']>
                | RelationshipsPresenter<M, D, keyof D['relationships']>
            >,
        );

        const resourcePresenter: ResourcePresenter<M, D> = {
            type: filteredResource.type,
            id: filteredResource.id,
            attributes: filteredResource.attributes as ResourcePresenter<M, D>['attributes'],
            // TODO: check it
            relationships:
                keys.length === 0 && options.excludeEmptyRelationships
                    ? undefined
                    : (relationships as ResourcePresenter<M, D>['relationships']),
            meta: this.#metaProvider.compose(resource),
        };

        if (!options.excludeLinks) {
            resourcePresenter.links = {
                self: this.#queryConverter.makePath({
                    type: filteredResource.type,
                    id: filteredResource.id,
                }),
            };
        }

        return resourcePresenter;
    }

    formatResource<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        query: Query<P, D, I, 'id'>,
        resource: CommonResource | null,
        included: CommonResource[],
    ): FetchResponseResourceData<M, D, I> {
        return {
            data: resource
                ? this.#makeResourceData(resource, {
                      excludeLinks: true,
                      fields: query.params?.fields?.[resource.type],
                  })
                : null,
            included: this.#makeIncluded(query, included),
            links: {
                self: this.#queryConverter.make(query),
            },
            meta: this.#metaProvider.composeRoot(query.ref as CommonQueryRef),
        } as FetchResponseResourceData<M, D, I>;
    }

    formatResources<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        query: Query<P, D, I, 'list'>,
        list: DataList<CommonResource>,
        included: CommonResource[],
    ): FetchResponseResourcesData<M, D, I> {
        const links =
            list.total !== undefined && list.limit !== undefined
                ? this.#getListLinks(query, list.total, list.limit)
                : {};

        return {
            data: list.items.map((resource) =>
                this.#makeResourceData(resource, { fields: query.params?.fields?.[resource.type] }),
            ),
            included: this.#makeIncluded(query, included),
            links: {
                self: this.#queryConverter.make(query),
                ...links,
            },
            meta: {
                ...this.#metaProvider.composeRoot(query.ref as CommonQueryRef),
                ...this.#metaProvider.composeList(list),
            } as M,
        };
    }
}
