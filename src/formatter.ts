import { QueryConverter } from './query-converter';
import {
    ResourceIdentifier,
    DataList,
    PageProvider,
    CommonResourceRelationship,
    MetaProvider,
    MetaType,
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

export interface RelationshipPresenter {
    data: ResourceIdentifier<string> | null;
    links: {
        self: string;
        related: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
    meta?: MetaType;
}

export interface RelationshipsPresenter {
    data: ResourceIdentifier<string>[];
    links: {
        self: string;
        related: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
    meta?: MetaType;
}

export interface ResourcePresenter {
    type: string;
    id: string;
    lid?: string;
    attributes: Record<string, unknown>;
    links?: {
        self: string;
    };
    relationships?: Record<string, RelationshipPresenter | RelationshipsPresenter>;
    meta?: MetaType;
}

export interface FetchResponseError {
    errors: CommonError[];
}

export interface FetchResourceIdentifierData {
    data: ResourceIdentifier<string>;
    meta?: MetaType;
    links: {
        self: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
}

export interface FetchResponseResourcesData {
    data: ResourcePresenter[];
    meta?: MetaType;
    links: {
        self: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
    included?: ResourcePresenter[];
}

export interface FetchResponseResourceData {
    data: ResourcePresenter | null;
    meta?: MetaType;
    links: {
        self: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
    included?: ResourcePresenter[];
}

export interface FetchResponseRelationshipData extends RelationshipPresenter {
    included?: ResourcePresenter[];
}

export interface FetchResponseRelationshipsData extends RelationshipsPresenter {
    included?: ResourcePresenter[];
}

export interface FetchResponseOperationsData {
    'atomic:results': (
        | FetchResponseResourceData
        | FetchResponseResourcesData
        | FetchResponseRelationshipData
        | FetchResponseRelationshipsData
    )[];
}

export type FetchResponse =
    | FetchResponseError
    | FetchResponseResourceData
    | FetchResponseResourcesData
    | FetchResponseRelationshipData
    | FetchResponseRelationshipsData
    | FetchResponseOperationsData;

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
    ): Pick<FetchResponseResourceData['links'], 'first' | 'last' | 'next' | 'prev'> {
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

    #makeRelationship(
        type: string,
        id: string,
        relationship: string,
        resourceIdentifier: ResourceIdentifier<string> | null,
    ): RelationshipPresenter {
        return {
            data: resourceIdentifier,
            links: {
                self: this.#queryConverter.makePath({ type, id, relationship, related: false }),
                related: this.#queryConverter.makePath({ type, id, relationship, related: true }),
            },
            meta: this.#metaProvider.compose(resourceIdentifier) as MetaType,
        };
    }

    #makeRelationships(
        type: string,
        id: string,
        relationship: string,
        list: DataList<ResourceIdentifier<string>>,
    ): RelationshipsPresenter {
        const links =
            list.total && list.limit
                ? this.#getListLinks(
                      this.#queryConverter.makeDefaultQuery({
                          type,
                          id,
                          relationship,
                      }),
                      list.total,
                      list.limit,
                  )
                : {};

        return {
            data: list.items,
            links: {
                self: this.#queryConverter.makePath({ type, id, relationship, related: false }),
                related: this.#queryConverter.makePath({ type, id, relationship, related: true }),
                ...links,
            },
            meta: this.#metaProvider.composeList(list) as MetaType,
        };
    }

    #makeIncluded<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        query: Query<P, D, I, 'list' | 'id' | 'relationship'>,
        included: CommonResource[],
    ): ResourcePresenter[] {
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

    formatRelationship<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        query: Query<P, D, I, 'relationship'>,
        resourceIdentifier: ResourceIdentifier<string> | null,
        included: CommonResource[],
    ): FetchResponseRelationshipData {
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
            meta: this.#metaProvider.compose(resourceIdentifier) as MetaType,
        };
    }

    formatRelationships<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        query: Query<P, D, I, 'relationship'>,
        list: DataList<ResourceIdentifier<string>>,
        included: CommonResource[],
    ): FetchResponseRelationshipsData {
        const links = list.total && list.limit ? this.#getListLinks(query, list.total, list.limit) : {};

        return {
            data: list.items,
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
                ...links,
            },
            meta: this.#metaProvider.composeList(list) as MetaType,
        };
    }

    #makeResourceData(resource: CommonResource, options: FormatResourceOptions = {}): ResourcePresenter {
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
            {} as Record<string, RelationshipPresenter | RelationshipsPresenter>,
        );

        const resourcePresenter: ResourcePresenter = {
            type: filteredResource.type,
            id: filteredResource.id,
            attributes: filteredResource.attributes,
            relationships: keys.length === 0 && options.excludeEmptyRelationships ? undefined : relationships,
            meta: this.#metaProvider.compose(resource) as MetaType,
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
    ): FetchResponseResourceData {
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
            meta: this.#metaProvider.composeRoot(query.ref as CommonQueryRef) as MetaType,
        };
    }

    formatResources<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        query: Query<P, D, I, 'list'>,
        list: DataList<CommonResource>,
        included: CommonResource[],
    ): FetchResponseResourcesData {
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
            },
        };
    }
}
