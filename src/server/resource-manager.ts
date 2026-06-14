import { ErrorFactory } from './errors';
import { ResourceStatus, ResourceKeeper, FetchResourceOptions } from './resource-keeper';
import {
    ResourceIdentifier,
    CommonResourceRelationship,
    FilterFields,
    Query,
    OperationRelationshipValue,
    DataList,
    Operation,
    OperationResults,
} from '../types/common';
import {
    ResourceDeclaration,
    CommonResource,
    NewResource,
    CommonEditableResource,
    CommonNewResource,
    EditableResource,
    MultipleRelationshipTypes,
    SingleRelationshipTypes,
    Resource,
    IncludedResources,
    RelationshipValue,
    NewRelationshipValue,
} from '../types/resource-declaration';
import { Checker } from './checker';
import { ErrorSet, Pointer, Result } from '@just-io/schema';
import { Eventable, EventEmitter, EventStore, Subscriber } from '@just-io/utils';
import { filterResourceFields } from './utils';
import { CommonError } from '../types/formats';
import { PageProvider } from './types';
import { defaultErrorFormatter, ErrorFormatter } from './error-formatter';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommonResourceKeeper<C, P> = ResourceKeeper<any, C, P>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommonFetchResourceOptions<P> = FetchResourceOptions<any, P>;

export type OuterEvent =
    | {
          type: 'add';
          resourceIdentifier: ResourceIdentifier<string>;
          newResource?: NewResource<ResourceDeclaration>;
          resource: CommonResource;
      }
    | {
          type: 'update';
          resourceIdentifier: ResourceIdentifier<string>;
          previousResource?: Resource<ResourceDeclaration>;
          editableResource?: EditableResource<ResourceDeclaration>;
          resource: CommonResource;
      }
    | {
          type: 'remove';
          resourceIdentifier: ResourceIdentifier<string>;
          oldResource?: Resource<ResourceDeclaration>;
      };

export type ErrorContext<P> =
    | {
          method: 'get';
          query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>;
      }
    | {
          method: 'list';
          query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'list'>;
      }
    | {
          method: 'relationship';
          query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'relationship'>;
      }
    | {
          method: 'add';
          query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'list'>;
          newResource: NewResource<ResourceDeclaration>;
      }
    | {
          method: 'update';
          query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>;
          editableResource: EditableResource<ResourceDeclaration>;
      }
    | {
          method: 'remove';
          query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>;
      }
    | {
          method: 'add-relationship';
          query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'relationship'>;
          relationshipValue: ResourceIdentifier<string>[];
      }
    | {
          method: 'update-relationship';
          query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'relationship'>;
          relationshipValue: ResourceIdentifier<string> | ResourceIdentifier<string>[] | null;
      }
    | {
          method: 'remove-relationship';
          query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'relationship'>;
          relationshipValue: ResourceIdentifier<string>[];
      }
    | {
          method: 'operations';
          operations: Operation<ResourceDeclaration>[];
          lidMap: Map<string, string>;
          finished: number;
          finishedResults: OperationResults<Operation<ResourceDeclaration>[]>;
      };

export type EventOrigin = 'api' | 'outer';

export type EventMap<C, P> = {
    get: [
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>,
        resource: CommonResource | null,
        included: CommonResource[],
    ];
    list: [
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'list'>,
        resources: DataList<CommonResource>,
        included: CommonResource[],
    ];
    relationship: [
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'relationship'>,
        relationship: DataList<ResourceIdentifier<string>> | ResourceIdentifier<string> | null,
        included: CommonResource[],
    ];
    add:
        | [
              context: C,
              query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'list'>,
              newResource: NewResource<ResourceDeclaration>,
              resource: CommonResource,
              included: CommonResource[],
              origin: 'api',
          ]
        | [
              context: C,
              query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'list'>,
              newResource: NewResource<ResourceDeclaration> | undefined,
              resource: CommonResource,
              included: CommonResource[],
              origin: 'outer',
          ];
    update:
        | [
              context: C,
              query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>,
              editableResource: EditableResource<ResourceDeclaration>,
              resource: CommonResource,
              included: CommonResource[],
              origin: 'api',
          ]
        | [
              context: C,
              query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>,
              editableResource: EditableResource<ResourceDeclaration> | undefined,
              resource: CommonResource,
              included: CommonResource[],
              origin: 'outer',
          ];
    remove: [context: C, query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>, origin: EventOrigin];
    change: [
        context: C,
        query:
            | Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>
            | Query<P, ResourceDeclaration, ResourceDeclaration[], 'list'>,
        oldResource: CommonResource | null,
        newResource: CommonResource | null,
        origin: EventOrigin,
    ];
    'add-relationship': [
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'relationship'>,
        relationshipValue: ResourceIdentifier<string>[],
        relationship: DataList<ResourceIdentifier<string>>,
        included: CommonResource[],
    ];
    'update-relationship': [
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'relationship'>,
        relationshipValue: ResourceIdentifier<string> | ResourceIdentifier<string>[] | null,
        relationship: ResourceIdentifier<string> | DataList<ResourceIdentifier<string>> | null,
        included: CommonResource[],
    ];
    'remove-relationship': [
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'relationship'>,
        relationshipValue: ResourceIdentifier<string>[],
        relationship: DataList<ResourceIdentifier<string>>,
        included: CommonResource[],
    ];
    operations: [
        context: C,
        operations: Operation<ResourceDeclaration>[],
        results: OperationResults<Operation<ResourceDeclaration>[]>,
    ];
    error: [context: C, errorContext: ErrorContext<P>, error: ErrorSet<CommonError>];
};

export class ResourceManager<C, P> implements Eventable<EventMap<C, P>> {
    #resourceKeepers: Record<string, CommonResourceKeeper<C, P>> = {};

    #pageProvider: PageProvider<P>;

    #checker: Checker<C, P>;

    #eventEmitter = new EventEmitter<EventMap<C, P>>();

    #initialized: boolean = false;

    constructor(pageProvider: PageProvider<P>) {
        this.#pageProvider = pageProvider;
        this.#checker = new Checker(pageProvider);
    }

    on<K extends keyof EventMap<C, P>>(event: K, subscriber: Subscriber<EventMap<C, P>[K]>): this {
        this.#eventEmitter.on(event, subscriber);

        return this;
    }

    once<K extends keyof EventMap<C, P>>(event: K, subscriber: Subscriber<EventMap<C, P>[K]>): this {
        this.#eventEmitter.once(event, subscriber);

        return this;
    }

    off<K extends keyof EventMap<C, P>>(event: K, subscriber: Subscriber<EventMap<C, P>[K]>): boolean {
        return this.#eventEmitter.off(event, subscriber);
    }

    get pageProvider(): PageProvider<P> {
        return this.#pageProvider;
    }

    get checker(): Checker<C, P> {
        return this.#checker;
    }

    addResourceKeeper<D extends ResourceDeclaration>(resourceKeeper: ResourceKeeper<D, C, P>): this {
        this.#resourceKeepers[resourceKeeper.schema.type] = resourceKeeper;
        this.#checker.addResourceKeeper(resourceKeeper);
        return this;
    }

    #composeFilter(
        resourceKeeper: CommonResourceKeeper<C, P>,
        filter: FilterFields,
        errorFormatter: ErrorFormatter,
    ): Result<CommonFetchResourceOptions<P>['filter'], ErrorSet<CommonError>> {
        const newFilter: CommonFetchResourceOptions<P>['filter'] = {};
        const errorSet = new ErrorSet<CommonError>();
        if (resourceKeeper.schema.listable) {
            for (const key in filter) {
                const filterSchema = resourceKeeper.schema.filter[key];
                if (filterSchema.multiple) {
                    const result = filterSchema.transformer(filter[key], errorFormatter);
                    if (!result.ok) {
                        errorSet.append(result.error);
                    } else {
                        newFilter[key] = result.value;
                    }
                } else {
                    const result = filterSchema.transformer(filter[key][0], errorFormatter);
                    if (!result.ok) {
                        errorSet.append(result.error);
                    } else {
                        newFilter[key] = result.value;
                    }
                }
            }
        }

        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }

        return {
            ok: true,
            value: newFilter,
        };
    }

    async #listIncludes<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        context: C,
        query: Query<P, D, I, 'list' | 'id' | 'relationship'>,
        type: string,
        mainResources: CommonResource[],
        include: string[],
        errorFormatter: ErrorFormatter,
    ): Promise<Result<CommonResource[], ErrorSet<CommonError>>> {
        const resources: CommonResource[] = [];
        const [name, ...rest] = include;
        if (!name) {
            return {
                ok: true,
                value: [],
            };
        }

        if (!this.#resourceKeepers[type].schema.relationships[name]) {
            return {
                ok: false,
                error: new ErrorSet<CommonError>().add(
                    ErrorFactory.makeInvalidQueryParameterError(
                        errorFormatter,
                        'include',
                        `The resource type '${type}' does not have field '${name}'.`,
                    ),
                ),
            };
        }

        const groups = mainResources.reduce(
            (obj, mainResource) => {
                const relationship = mainResource.relationships[name] as CommonResourceRelationship;
                if (relationship && 'items' in relationship) {
                    for (const identifier of relationship.items) {
                        if (!obj[identifier.type]) {
                            obj[identifier.type] = [];
                        }
                        obj[identifier.type].push(identifier.id);
                    }
                } else if (relationship) {
                    if (!obj[relationship.type]) {
                        obj[relationship.type] = [];
                    }
                    obj[relationship.type].push(relationship.id);
                }

                return obj;
            },
            {} as Record<string, string[]>,
        );

        const errorSet = new ErrorSet<CommonError>();
        for (const key of Object.keys(groups)) {
            const resourceKeeper = this.#resourceKeepers[key];
            const statuses = await resourceKeeper.status(context, groups[key], errorFormatter);
            for (const status of Object.values(statuses)) {
                if (status.type === 'forbidden') {
                    errorSet.add(ErrorFactory.makeForbiddenError(errorFormatter, 'include', status.reason));
                    continue;
                }
                if (!status || status.type === 'not-found') {
                    errorSet.add(ErrorFactory.makeNotFoundError(errorFormatter, 'include', name));
                    continue;
                }
            }
            if (errorSet.errors.length) {
                return {
                    ok: false,
                    error: errorSet,
                };
            }

            const includedResources = await resourceKeeper.get(context, groups[key], {
                // fields: query.params.fields[query.ref.type],
                page: query.params?.page,
            });

            for (const includedResource of includedResources) {
                if (
                    !resources.some(
                        (resource) => resource.id === includedResource.id && resource.type === includedResource.type,
                    )
                ) {
                    resources.push(includedResource);
                }
            }

            const resultOfSubResources = await this.#listIncludes(
                context,
                query,
                key,
                includedResources,
                rest,
                errorFormatter,
            );
            if (resultOfSubResources.ok) {
                for (const subResource of resultOfSubResources.value) {
                    if (
                        !resources.some(
                            (resource) => resource.id === subResource.id && resource.type === subResource.type,
                        )
                    ) {
                        resources.push(subResource);
                    }
                }
            } else {
                errorSet.append(resultOfSubResources.error);
            }
        }

        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }

        return {
            ok: true,
            value: resources.map((resource) => filterResourceFields(resource, query.params?.fields?.[resource.type])),
        };
    }

    async status(context: C, type: string, id: string, errorFormatter: ErrorFormatter): Promise<ResourceStatus> {
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const resourceKeeper = this.#resourceKeepers[type];
        return (await resourceKeeper.status(context, [id], errorFormatter))[id];
    }

    async #get<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'id'>,
        location: Pointer | 'query',
        errorFormatter: ErrorFormatter,
    ): Promise<Result<{ resource: Resource<D> | null; included: IncludedResources<I>[] }, ErrorSet<CommonError>>> {
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet =
            location === 'query'
                ? this.#checker.checkQuery('get', query, true, errorFormatter)
                : this.#checker.checkResourceMethod('get', query.ref, location, true, errorFormatter);
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }
        const status = (await resourceKeeper.status(context, [query.ref.id], errorFormatter))[query.ref.id];
        if (!status || status.type === 'not-found') {
            return {
                ok: true,
                value: {
                    resource: null,
                    included: [],
                },
            };
        }
        if (status.type === 'forbidden') {
            return {
                ok: false,
                error: new ErrorSet<CommonError>().add(
                    ErrorFactory.makeForbiddenError(errorFormatter, location, status.reason),
                ),
            };
        }
        const [resource] = await resourceKeeper.get(context, [query.ref.id], {
            page: query.params?.page,
        });
        const included: CommonResource[] = [];
        if (query.params?.include) {
            for (const relationshipInclude of query.params.include) {
                const includedResourceResult = await this.#listIncludes(
                    context,
                    query,
                    resource.type,
                    [resource],
                    relationshipInclude,
                    errorFormatter,
                );
                if (!includedResourceResult.ok) {
                    return {
                        ok: false,
                        error: includedResourceResult.error,
                    };
                }
                included.push(...includedResourceResult.value);
            }
        }

        return {
            ok: true,
            value: {
                resource: filterResourceFields(resource, query.params?.fields?.[resource.type]) as Resource<D>,
                included: included as IncludedResources<I>[],
            },
        };
    }

    async #callWithErrorBoundary<T>(
        context: C,
        func: (eventStore: EventStore<EventMap<C, P>>) => Promise<Result<T, ErrorSet<CommonError>>>,
        errorContext: ErrorContext<P>,
    ): Promise<{
        result: Result<T, ErrorSet<CommonError>>;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();
        try {
            const result = await func(eventStore);
            if (result.ok) {
                return {
                    result,
                    eventStore,
                };
            }

            throw result.error;
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add('error', context, errorContext, error);

                return {
                    result: {
                        ok: false,
                        error,
                    },
                    eventStore,
                };
            }

            throw error;
        }
    }

    async get<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'id'>,
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<{
        result: Result<
            {
                resource: Resource<D> | null;
                included: IncludedResources<I>[];
            },
            ErrorSet<CommonError>
        >;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        return this.#callWithErrorBoundary(
            context,
            async (eventStore) => {
                const result = await this.#get(context, query, 'query', errorFormatter);
                if (!result.ok) {
                    return result;
                }

                eventStore.add('get', context, query, result.value.resource, result.value.included);

                return result;
            },
            {
                method: 'get',
                query,
            },
        );
    }

    async #relationship<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        location: Pointer | 'query',
        errorFormatter: ErrorFormatter,
    ): Promise<
        Result<
            { relationship: RelationshipValue<D['relationships'][R]>; included: IncludedResources<I>[] },
            ErrorSet<CommonError>
        >
    > {
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet =
            location === 'query'
                ? this.#checker.checkQuery('get', query, true, errorFormatter)
                : this.#checker.checkResourceMethod('get', query.ref, location, true, errorFormatter);
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }
        const status = (await resourceKeeper.status(context, [query.ref.id], errorFormatter))[query.ref.id];
        if (status.type === 'forbidden') {
            return {
                ok: false,
                error: new ErrorSet<CommonError>().add(
                    ErrorFactory.makeForbiddenError(errorFormatter, 'query', status.reason),
                ),
            };
        }
        if (status.type === 'not-found') {
            return {
                ok: false,
                error: new ErrorSet<CommonError>().add(ErrorFactory.makeNotFoundError(errorFormatter, 'query')),
            };
        }

        const relationshipInfo = resourceKeeper.schema.relationships[query.ref.relationship];
        if (!relationshipInfo) {
            return {
                ok: false,
                error: new ErrorSet<CommonError>().add(ErrorFactory.makeNotFoundError(errorFormatter, 'query')),
            };
        }

        const included: CommonResource[] = [];
        let relationship: RelationshipValue<D['relationships'][R]>;

        if (relationshipInfo.multiple) {
            relationship = (
                await relationshipInfo.get(context, [query.ref.id], {
                    page: query.params?.page,
                    asMain: true,
                })
            )[query.ref.id] as RelationshipValue<D['relationships'][R]>;
        } else {
            relationship = (await relationshipInfo.get(context, [query.ref.id]))[query.ref.id] as RelationshipValue<
                D['relationships'][R]
            >;
        }
        if (query.params?.include) {
            const [resource] = await resourceKeeper.get(context, [query.ref.id], {
                page: query.params?.page,
            });
            resource.relationships[query.ref.relationship] = relationship;
            for (const relationshipInclude of query.params.include) {
                const includedResourceResult = await this.#listIncludes(
                    context,
                    query,
                    resource.type,
                    [resource],
                    relationshipInclude,
                    errorFormatter,
                );
                if (!includedResourceResult.ok) {
                    return {
                        ok: false,
                        error: includedResourceResult.error,
                    };
                }
                included.push(...includedResourceResult.value);
            }
        }

        return {
            ok: true,
            value: {
                relationship,
                included: included as IncludedResources<I>[],
            },
        };
    }

    async relationship<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<{
        result: Result<
            {
                relationship: RelationshipValue<D['relationships'][R]>;
                included: IncludedResources<I>[];
            },
            ErrorSet<CommonError>
        >;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        return this.#callWithErrorBoundary(
            context,
            async (eventStore) => {
                const result = await this.#relationship(context, query, 'query', errorFormatter);
                if (!result.ok) {
                    return result;
                }

                eventStore.add('relationship', context, query, result.value.relationship, result.value.included);

                return result;
            },
            {
                method: 'relationship',
                query,
            },
        );
    }

    async #list<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'list'>,
        location: Pointer | 'query',
        errorFormatter: ErrorFormatter,
    ): Promise<Result<{ resources: DataList<Resource<D>>; included: IncludedResources<I>[] }, ErrorSet<CommonError>>> {
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet =
            location === 'query'
                ? this.#checker.checkQuery('list', query, true, errorFormatter)
                : this.#checker.checkResourceMethod('list', query.ref, location, true, errorFormatter);
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }
        const filterResult = this.#composeFilter(resourceKeeper, query.params?.filter as FilterFields, errorFormatter);
        if (!filterResult.ok) {
            return filterResult;
        }
        const result = await resourceKeeper.list(context, {
            filter: filterResult.value,
            page: query.params?.page,
            sort: query.params?.sort,
            // fields: query.params?.fields?.[query.ref.type],
            errorFormatter,
        });
        if (!result.ok) {
            return result;
        }
        const included: CommonResource[] = [];
        if (query.params?.include) {
            for (const relationshipInclude of query.params.include) {
                const includedResourceResult = await this.#listIncludes(
                    context,
                    query,
                    query.ref.type,
                    result.value.items,
                    relationshipInclude,
                    errorFormatter,
                );
                if (!includedResourceResult.ok) {
                    return {
                        ok: false,
                        error: includedResourceResult.error,
                    };
                }
                included.push(...includedResourceResult.value);
            }
        }

        result.value.items = result.value.items.map(
            (resource) => filterResourceFields(resource, query.params?.fields?.[resource.type]) as Resource<D>,
        );

        return {
            ok: true,
            value: {
                resources: result.value as DataList<Resource<D>>,
                included: included as IncludedResources<I>[],
            },
        };
    }

    async list<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'list'>,
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<{
        result: Result<
            {
                resources: DataList<Resource<D>>;
                included: IncludedResources<I>[];
            },
            ErrorSet<CommonError>
        >;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        return this.#callWithErrorBoundary(
            context,
            async (eventStore) => {
                const result = await this.#list(context, query, 'query', errorFormatter);
                if (!result.ok) {
                    return result;
                }

                eventStore.add('list', context, query, result.value.resources, result.value.included);

                return result;
            },
            {
                method: 'list',
                query,
            },
        );
    }

    async #checkResourceRelationshipFields(
        context: C,
        type: string,
        resource: Omit<CommonNewResource | CommonEditableResource, 'id'>,
        pointer: Pointer,
        errorFormatter: ErrorFormatter,
    ): Promise<ErrorSet<CommonError>> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];

        if (!resourceKeeper) {
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeInvalidResourceTypeError(errorFormatter, resource.type, 'query'),
            );
        }

        for (const [name, relationshipResource] of Object.entries(resource.relationships)) {
            if (Array.isArray(relationshipResource)) {
                for (let i = 0; i < relationshipResource.length; i++) {
                    const status = await this.#checkResourceStatus(
                        context,
                        relationshipResource[i].type,
                        relationshipResource[i].id,
                        errorFormatter,
                    );
                    if (status.type === 'not-found') {
                        errorSet.add(
                            ErrorFactory.makeNotFoundError(
                                errorFormatter,
                                pointer.concat('relationships', name, i, 'id'),
                            ),
                        );
                    } else if (status.type === 'forbidden') {
                        errorSet.add(
                            ErrorFactory.makeForbiddenError(
                                errorFormatter,
                                pointer.concat('relationships', name, i, 'id'),
                            ),
                        );
                    }
                }
            } else if (relationshipResource) {
                const status = await this.#checkResourceStatus(
                    context,
                    relationshipResource.type,
                    relationshipResource.id,
                    errorFormatter,
                );
                if (status.type === 'not-found') {
                    errorSet.add(
                        ErrorFactory.makeNotFoundError(errorFormatter, pointer.concat('relationships', name, 'id')),
                    );
                } else if (status.type === 'forbidden') {
                    errorSet.add(
                        ErrorFactory.makeForbiddenError(errorFormatter, pointer.concat('relationships', name, 'id')),
                    );
                }
            }
        }

        return errorSet;
    }

    async #add<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'list'>,
        newResource: NewResource<D>,
        pointer: Pointer,
        operation: boolean,
        errorFormatter: ErrorFormatter,
    ): Promise<Result<string, ErrorSet<CommonError>>> {
        const location = operation ? pointer : 'query';
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        if (query.ref.type !== newResource.type) {
            return {
                ok: false,
                error: new ErrorSet<CommonError>().add(
                    ErrorFactory.makeInvalidResourceTypeError(errorFormatter, newResource.type, location),
                ),
            };
        }
        const errorSet =
            location === 'query'
                ? this.#checker.checkQuery('add', query, true, errorFormatter)
                : this.#checker.checkResourceMethod('add', query.ref, location, true, errorFormatter);
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }
        errorSet.append(
            this.#checker.checkResourceFields(pointer, newResource.type, newResource, true, errorFormatter),
        );
        errorSet.append(
            this.#checker.checkResourceFieldsForExisting(pointer, newResource.type, newResource, errorFormatter),
        );
        errorSet.append(
            await this.#checkResourceRelationshipFields(
                context,
                newResource.type,
                newResource,
                pointer,
                errorFormatter,
            ),
        );
        if (newResource.id) {
            const status = await this.#checkResourceStatus(context, newResource.type, newResource.id, errorFormatter);
            if (status.type !== 'not-found') {
                errorSet.add(ErrorFactory.makeExistsResourceIdError(errorFormatter));
            }
        }
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }

        return resourceKeeper.add(context, newResource, { location, errorFormatter });
    }

    async add<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'list'>,
        newResource: NewResource<D>,
        pointer: Pointer = new Pointer(''),
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<{
        result: Result<
            {
                resource: Resource<D>;
                included: IncludedResources<I>[];
            },
            ErrorSet<CommonError>
        >;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        return this.#callWithErrorBoundary(
            context,
            async (eventStore) => {
                const result = await this.#add(context, query, newResource, pointer, false, errorFormatter);

                if (!result.ok) {
                    return result;
                }

                const newResourceResult = await this.#get(
                    context,
                    {
                        ref: { ...query.ref, id: result.value },
                        params: query.params,
                    },
                    'query',
                    errorFormatter,
                );
                if (!newResourceResult.ok) {
                    return newResourceResult;
                }

                eventStore.add(
                    'add',
                    context,
                    query,
                    newResource as unknown as NewResource<ResourceDeclaration>,
                    newResourceResult.value.resource!,
                    newResourceResult.value.included,
                    'api',
                );

                return newResourceResult as Result<
                    {
                        resource: Resource<D>;
                        included: IncludedResources<I>[];
                    },
                    ErrorSet<CommonError>
                >;
            },
            {
                method: 'add',
                query,
                newResource: newResource as unknown as NewResource<ResourceDeclaration>,
            },
        );
    }

    async #update<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'id'>,
        editableResource: EditableResource<D>,
        pointer: Pointer,
        operation: boolean,
        errorFormatter: ErrorFormatter,
    ): Promise<Result<void, ErrorSet<CommonError>>> {
        const location = operation ? pointer : 'query';
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        if (query.ref.type !== editableResource.type) {
            return {
                ok: false,
                error: new ErrorSet<CommonError>().add(
                    ErrorFactory.makeInvalidResourceTypeError(errorFormatter, editableResource.type, location),
                ),
            };
        }
        if (query.ref.id !== editableResource.id) {
            return {
                ok: false,
                error: new ErrorSet<CommonError>().add(
                    ErrorFactory.makeInvalidResourceIdError(errorFormatter, pointer.concat('id')),
                ),
            };
        }
        const errorSet =
            location === 'query'
                ? this.#checker.checkQuery('update', query, true, errorFormatter)
                : this.#checker.checkResourceMethod('update', query.ref, location, true, errorFormatter);
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }
        errorSet.append(
            this.#checker.checkResourceFields(pointer, editableResource.type, editableResource, false, errorFormatter),
        );
        errorSet.append(
            await this.#checkResourceRelationshipFields(
                context,
                editableResource.type,
                editableResource,
                pointer,
                errorFormatter,
            ),
        );
        const status = await this.#checkResourceStatus(
            context,
            editableResource.type,
            editableResource.id,
            errorFormatter,
        );
        if (status.type === 'not-found') {
            errorSet.add(ErrorFactory.makeNotFoundError(errorFormatter, location));
        } else if (status.type === 'forbidden') {
            errorSet.add(ErrorFactory.makeForbiddenError(errorFormatter, location));
        }
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }

        return resourceKeeper.update(context, editableResource, { location, errorFormatter });
    }

    async update<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'id'>,
        editableResource: EditableResource<D>,
        pointer: Pointer = new Pointer(''),
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<{
        result: Result<
            {
                resource: Resource<D>;
                included: IncludedResources<I>[];
            },
            ErrorSet<CommonError>
        >;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        return this.#callWithErrorBoundary(
            context,
            async (eventStore) => {
                const oldResourceResult = await this.#get(context, { ref: query.ref }, 'query', errorFormatter);
                if (!oldResourceResult.ok) {
                    return oldResourceResult;
                }
                const result = await this.#update(context, query, editableResource, pointer, false, errorFormatter);
                if (!result.ok) {
                    return result;
                }
                const resourceResult = await this.#get(context, query, 'query', errorFormatter);
                if (!resourceResult.ok) {
                    return resourceResult;
                }
                const newResourceResult = await this.#get(context, { ref: query.ref }, 'query', errorFormatter);
                if (!newResourceResult.ok) {
                    return newResourceResult;
                }

                eventStore.add(
                    'update',
                    context,
                    query,
                    editableResource as unknown as EditableResource<ResourceDeclaration>,
                    resourceResult.value.resource!,
                    resourceResult.value.included,
                    'api',
                );
                eventStore.add(
                    'change',
                    context,
                    query,
                    oldResourceResult.value.resource,
                    newResourceResult.value.resource,
                    'api',
                );

                return resourceResult as Result<
                    {
                        resource: Resource<D>;
                        included: IncludedResources<I>[];
                    },
                    ErrorSet<CommonError>
                >;
            },
            {
                method: 'update',
                query,
                editableResource: editableResource as unknown as EditableResource<ResourceDeclaration>,
            },
        );
    }

    async #remove<D extends ResourceDeclaration>(
        context: C,
        query: Query<P, D, [], 'id'>,
        pointer: Pointer,
        operation: boolean,
        errorFormatter: ErrorFormatter,
    ): Promise<Result<void, ErrorSet<CommonError>>> {
        const location = operation ? pointer : 'query';
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet =
            location === 'query'
                ? this.#checker.checkQuery('remove', query, true, errorFormatter)
                : this.#checker.checkResourceMethod('remove', query.ref, location, true, errorFormatter);
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }
        const status = await this.#checkResourceStatus(context, query.ref.type, query.ref.id, errorFormatter);
        if (status.type === 'not-found') {
            errorSet.add(ErrorFactory.makeNotFoundError(errorFormatter, location));
        } else if (status.type === 'forbidden') {
            errorSet.add(ErrorFactory.makeForbiddenError(errorFormatter, location));
        }
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }

        return resourceKeeper.remove(context, query.ref.id, { location, errorFormatter });
    }

    async remove<D extends ResourceDeclaration>(
        context: C,
        query: Query<P, D, [], 'id'>,
        pointer: Pointer = new Pointer(''),
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<{
        result: Result<void, ErrorSet<CommonError>>;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        return this.#callWithErrorBoundary(
            context,
            async (eventStore) => {
                const oldResourceResult = await this.#get(context, { ref: query.ref }, 'query', errorFormatter);
                if (!oldResourceResult.ok) {
                    return oldResourceResult;
                }
                const result = await this.#remove(context, query, pointer, false, errorFormatter);
                if (!result.ok) {
                    return result;
                }

                eventStore.add('remove', context, query, 'api');
                eventStore.add('change', context, query, oldResourceResult.value.resource, null, 'api');

                return result as Result<void, ErrorSet<CommonError>>;
            },
            {
                method: 'remove',
                query,
            },
        );
    }

    async #updateRelationship<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        resourceIdentifiers: NewRelationshipValue<D['relationships'][R], 'single'>,
        pointer: Pointer,
        operation: boolean,
        errorFormatter: ErrorFormatter,
    ): Promise<Result<void, ErrorSet<CommonError>>> {
        const location = operation ? pointer : 'query';
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet =
            location === 'query'
                ? this.#checker.checkQuery('update', query, true, errorFormatter)
                : this.#checker.checkResourceMethod('update', query.ref, location, true, errorFormatter);
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }
        const relationshipInfo = resourceKeeper.schema.relationships[query.ref.relationship];
        errorSet.append(
            this.#checker.checkResourceRelationshipValue(
                pointer,
                query.ref.type,
                query.ref.relationship as string,
                resourceIdentifiers,
                false,
                errorFormatter,
            ),
        );
        if (resourceIdentifiers !== null) {
            const statusErrors = await this.#checkResourceIdentifiers(
                context,
                resourceIdentifiers,
                pointer,
                false,
                errorFormatter,
            );
            errorSet.add(...statusErrors);
        }
        if (
            errorSet.errors.length ||
            (relationshipInfo.multiple && !Array.isArray(resourceIdentifiers)) ||
            (!relationshipInfo.multiple && Array.isArray(resourceIdentifiers)) ||
            relationshipInfo.mode === 'readonly' ||
            (!relationshipInfo.nullable && resourceIdentifiers === null)
        ) {
            return {
                ok: false,
                error: errorSet,
            };
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return relationshipInfo.update(context, query.ref.id, resourceIdentifiers, errorFormatter);
    }

    async updateRelationship<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        resourceIdentifiers: NewRelationshipValue<D['relationships'][R], 'single'>,
        pointer: Pointer = new Pointer(''),
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<{
        result: Result<
            {
                relationship: RelationshipValue<D['relationships'][R]>;
                included: IncludedResources<I>[];
            },
            ErrorSet<CommonError>
        >;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        return this.#callWithErrorBoundary(
            context,
            async (eventStore) => {
                const oldResourceResult = await this.#get(context, { ref: query.ref }, 'query', errorFormatter);
                if (!oldResourceResult.ok) {
                    return oldResourceResult;
                }
                const result = await this.#updateRelationship(
                    context,
                    query,
                    resourceIdentifiers,
                    pointer,
                    false,
                    errorFormatter,
                );
                if (!result.ok) {
                    return result;
                }

                const newResourceResult = await this.#get(context, { ref: query.ref }, 'query', errorFormatter);
                if (!newResourceResult.ok) {
                    return newResourceResult;
                }
                const relationshipResult = await this.#relationship(context, query, 'query', errorFormatter);
                if (!relationshipResult.ok) {
                    return relationshipResult;
                }

                eventStore.add(
                    'update-relationship',
                    context,
                    query,
                    resourceIdentifiers,
                    relationshipResult.value.relationship,
                    relationshipResult.value.included,
                );
                eventStore.add(
                    'change',
                    context,
                    query,
                    oldResourceResult.value.resource,
                    newResourceResult.value.resource,
                    'api',
                );

                return relationshipResult;
            },
            {
                method: 'update-relationship',
                query,
                relationshipValue: resourceIdentifiers,
            },
        );
    }

    async #addRelationships<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        resourceIdentifiers: ResourceIdentifier<D['relationships'][R]['types']>[],
        pointer: Pointer,
        operation: boolean,
        errorFormatter: ErrorFormatter,
    ): Promise<Result<void, ErrorSet<CommonError>>> {
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const location = operation ? pointer : 'query';
        const errorSet =
            location === 'query'
                ? this.#checker.checkQuery('update', query, true, errorFormatter)
                : this.#checker.checkResourceMethod('update', query.ref, location, true, errorFormatter);
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }
        const relationshipInfo = resourceKeeper.schema.relationships[query.ref.relationship];
        errorSet.append(
            this.#checker.checkResourceRelationshipValue(
                pointer,
                query.ref.type,
                query.ref.relationship as string,
                resourceIdentifiers,
                false,
                errorFormatter,
            ),
        );
        const statusErrors = await this.#checkResourceIdentifiersStatus(
            context,
            resourceIdentifiers,
            pointer,
            false,
            errorFormatter,
        );
        errorSet.add(...statusErrors);
        if (errorSet.errors.length || !relationshipInfo.multiple || relationshipInfo.mode === 'readonly') {
            return {
                ok: false,
                error: errorSet,
            };
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return relationshipInfo.add(context, query.ref.id, resourceIdentifiers, errorFormatter);
    }

    async addRelationships<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        resourceIdentifiers: ResourceIdentifier<D['relationships'][R]['types']>[],
        pointer: Pointer = new Pointer(''),
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<{
        result: Result<
            {
                relationship: RelationshipValue<D['relationships'][R]>;
                included: IncludedResources<I>[];
            },
            ErrorSet<CommonError>
        >;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        return this.#callWithErrorBoundary(
            context,
            async (eventStore) => {
                const oldResourceResult = await this.#get(context, { ref: query.ref }, 'query', errorFormatter);
                if (!oldResourceResult.ok) {
                    return oldResourceResult;
                }
                const result = await this.#addRelationships(
                    context,
                    query,
                    resourceIdentifiers,
                    pointer,
                    false,
                    errorFormatter,
                );
                if (!result.ok) {
                    return result;
                }

                const newResourceResult = await this.#get(context, { ref: query.ref }, 'query', errorFormatter);
                if (!newResourceResult.ok) {
                    return newResourceResult;
                }
                const relationshipResult = await this.#relationship(context, query, 'query', errorFormatter);
                if (!relationshipResult.ok) {
                    return relationshipResult;
                }

                eventStore.add(
                    'add-relationship',
                    context,
                    query,
                    resourceIdentifiers,
                    relationshipResult.value.relationship as DataList<ResourceIdentifier<string>>,
                    relationshipResult.value.included,
                );
                eventStore.add(
                    'change',
                    context,
                    query,
                    oldResourceResult.value.resource,
                    newResourceResult.value.resource,
                    'api',
                );

                return relationshipResult;
            },
            {
                method: 'add-relationship',
                query,
                relationshipValue: resourceIdentifiers,
            },
        );
    }

    async #removeRelationships<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        resourceIdentifiers: ResourceIdentifier<D['relationships'][R]['types']>[],
        pointer: Pointer,
        operation: boolean,
        errorFormatter: ErrorFormatter,
    ): Promise<Result<void, ErrorSet<CommonError>>> {
        const location = operation ? pointer : 'query';
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet =
            location === 'query'
                ? this.#checker.checkQuery('update', query, true, errorFormatter)
                : this.#checker.checkResourceMethod('update', query.ref, location, true, errorFormatter);
        const relationshipInfo = resourceKeeper.schema.relationships[query.ref.relationship];
        errorSet.append(
            this.#checker.checkResourceRelationshipValue(
                pointer,
                query.ref.type,
                query.ref.relationship as string,
                resourceIdentifiers,
                false,
                errorFormatter,
            ),
        );
        const existingErrors = await this.#checkResourceIdentifiersStatus(
            context,
            resourceIdentifiers,
            pointer,
            true,
            errorFormatter,
        );
        errorSet.add(...existingErrors);
        if (errorSet.errors.length || !relationshipInfo.multiple || relationshipInfo.mode === 'readonly') {
            return {
                ok: false,
                error: errorSet,
            };
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return relationshipInfo.remove(context, query.ref.id, resourceIdentifiers, errorFormatter);
    }

    async removeRelationships<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        resourceIdentifiers: ResourceIdentifier<D['relationships'][R]['types']>[],
        pointer: Pointer = new Pointer(''),
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<{
        result: Result<
            {
                relationship: RelationshipValue<D['relationships'][R]>;
                included: IncludedResources<I>[];
            },
            ErrorSet<CommonError>
        >;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        return this.#callWithErrorBoundary(
            context,
            async (eventStore) => {
                const oldResourceResult = await this.#get(context, { ref: query.ref }, 'query', errorFormatter);
                if (!oldResourceResult.ok) {
                    return oldResourceResult;
                }
                const result = await this.#removeRelationships(
                    context,
                    query,
                    resourceIdentifiers,
                    pointer,
                    false,
                    errorFormatter,
                );
                if (!result.ok) {
                    return result;
                }

                const newResourceResult = await this.#get(context, { ref: query.ref }, 'query', errorFormatter);
                if (!newResourceResult.ok) {
                    return newResourceResult;
                }
                const relationshipResult = await this.#relationship(context, query, 'query', errorFormatter);
                if (!relationshipResult.ok) {
                    return relationshipResult;
                }

                eventStore.add(
                    'remove-relationship',
                    context,
                    query,
                    resourceIdentifiers,
                    relationshipResult.value.relationship as DataList<ResourceIdentifier<string>>,
                    relationshipResult.value.included,
                );
                eventStore.add(
                    'change',
                    context,
                    query,
                    oldResourceResult.value.resource,
                    newResourceResult.value.resource,
                    'api',
                );

                return relationshipResult;
            },
            {
                method: 'remove-relationship',
                query,
                relationshipValue: resourceIdentifiers,
            },
        );
    }

    #setIdByLid<V extends OperationRelationshipValue<ResourceDeclaration>>(
        value: V,
        lidMap: Map<string, string>,
    ): V extends null
        ? null
        : V extends unknown[]
        ? ResourceIdentifier<MultipleRelationshipTypes<ResourceDeclaration>>[]
        : ResourceIdentifier<SingleRelationshipTypes<ResourceDeclaration>> {
        if (Array.isArray(value)) {
            return value.map((item) => ({
                type: item.type,
                id: 'lid' in item ? lidMap.get(item.lid)! : item.id,
            })) as V extends null
                ? null
                : V extends unknown[]
                ? ResourceIdentifier<MultipleRelationshipTypes<ResourceDeclaration>>[]
                : ResourceIdentifier<SingleRelationshipTypes<ResourceDeclaration>>;
        } else if (value !== null) {
            return {
                type: value.type,
                id: 'lid' in value ? lidMap.get(value.lid)! : value.id,
            } as V extends null
                ? null
                : V extends unknown[]
                ? ResourceIdentifier<MultipleRelationshipTypes<ResourceDeclaration>>[]
                : ResourceIdentifier<SingleRelationshipTypes<ResourceDeclaration>>;
        }

        return null as V extends null
            ? null
            : V extends unknown[]
            ? ResourceIdentifier<MultipleRelationshipTypes<ResourceDeclaration>>[]
            : ResourceIdentifier<SingleRelationshipTypes<ResourceDeclaration>>;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async operations<const OA extends Operation<any, any>[]>(
        context: C,
        operations: OA,
        pointer: Pointer = new Pointer(''),
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<{
        result: Result<OperationResults<OA>, ErrorSet<CommonError>>;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const lidMap = new Map<string, string>();
        const errorSet = new ErrorSet<CommonError>();
        for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            if (operation.op === 'add' && 'lid' in operation.data && operation.data.lid) {
                lidMap.set(operation.data.lid, '');
            }
            if (operation.op === 'add' || operation.op === 'update') {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                Object.entries<OperationRelationshipValue<ResourceDeclaration>>(operation.data.relationships).forEach(
                    ([relationship, value]) => {
                        errorSet.append(
                            this.#checker.checkOperationResourceIdentifier(
                                value,
                                lidMap,
                                pointer.concat(i, 'data', 'relationships', relationship),
                                errorFormatter,
                            ),
                        );
                    },
                );
            }
            if (
                operation.op === 'add-relationships' ||
                operation.op === 'update-relationships' ||
                operation.op === 'remove-relationships'
            ) {
                errorSet.append(
                    this.#checker.checkOperationResourceIdentifier(
                        operation.data as OperationRelationshipValue<ResourceDeclaration>,
                        lidMap,
                        pointer.concat(i, 'data'),
                        errorFormatter,
                    ),
                );
                if ('lid' in operation.ref && !lidMap.has(operation.ref.lid)) {
                    errorSet.add(
                        ErrorFactory.makeInvalidResourceLidError(errorFormatter, pointer.concat(i, 'ref', 'lid')),
                    );
                }
            }
            if (operation.op === 'remove') {
                if ('lid' in operation.ref && !lidMap.has(operation.ref.lid)) {
                    errorSet.add(
                        ErrorFactory.makeInvalidResourceLidError(errorFormatter, pointer.concat(i, 'ref', 'lid')),
                    );
                }
            }
            if (operation.op === 'update') {
                if ('lid' in operation.data && !lidMap.has(operation.data.lid)) {
                    errorSet.add(
                        ErrorFactory.makeInvalidResourceLidError(errorFormatter, pointer.concat(i, 'data', 'lid')),
                    );
                }
            }
        }
        if (errorSet.errors.length) {
            return {
                result: {
                    ok: false,
                    error: errorSet,
                },
                eventStore: this.#eventEmitter.makeStore(),
            };
        }

        const results: OperationResults<OA> = [] as OperationResults<OA>;
        return this.#callWithErrorBoundary(
            context,
            async (eventStore) => {
                for (let i = 0; i < operations.length; i++) {
                    const operation = operations[i];
                    if (operation.op === 'add') {
                        const newResource: NewResource<ResourceDeclaration> = {
                            type: operation.data.type,
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-expect-error
                            attributes: operation.data.attributes,
                            relationships: Object.fromEntries(
                                Object.entries<OperationRelationshipValue<ResourceDeclaration>>(
                                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                    // @ts-expect-error
                                    operation.data.relationships,
                                ).map(([key, value]) => [key, this.#setIdByLid(value, lidMap)]),
                            ) as Record<string, never>,
                        };
                        const query: Query<P, ResourceDeclaration, [], 'list'> = {
                            ref: {
                                type: operation.data.type,
                            },
                        };
                        const addResult = await this.#add(
                            context,
                            query,
                            newResource,
                            pointer.concat(i),
                            true,
                            errorFormatter,
                        );
                        if (!addResult.ok) {
                            return addResult;
                        }

                        if ('lid' in operation.data && operation.data.lid) {
                            lidMap.set(operation.data.lid, addResult.value);
                        }

                        const getResult = await this.#get(
                            context,
                            {
                                ref: {
                                    type: operation.data.type,
                                    id: addResult.value,
                                },
                            },
                            pointer.concat(i),
                            errorFormatter,
                        );

                        if (!getResult.ok) {
                            return getResult;
                        }

                        results.push(getResult.value.resource!);

                        eventStore.add('add', context, query, newResource, getResult.value.resource!, [], 'api');
                        eventStore.add('change', context, query, null, getResult.value.resource, 'api');
                    } else if (operation.op === 'update') {
                        const editableResource: EditableResource<ResourceDeclaration> = {
                            type: operation.data.type,
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-expect-error
                            attributes: operation.data.attributes,
                            relationships: Object.fromEntries(
                                Object.entries<OperationRelationshipValue<ResourceDeclaration>>(
                                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                    // @ts-expect-error
                                    operation.data.relationships,
                                ).map(([key, value]) => [key, this.#setIdByLid(value, lidMap)]),
                            ) as Record<string, never>,
                        };
                        const query: Query<P, ResourceDeclaration, [], 'id'> = {
                            ref: {
                                type: operation.data.type,
                                id: 'lid' in operation.data ? lidMap.get(operation.data.lid)! : operation.data.id,
                            },
                        };
                        const getResultOld = await this.#get(context, query, pointer.concat(i), errorFormatter);
                        if (!getResultOld.ok) {
                            return getResultOld;
                        }

                        const result = await this.#update(
                            context,
                            query,
                            editableResource,
                            pointer.concat(i),
                            true,
                            errorFormatter,
                        );
                        if (!result.ok) {
                            return result;
                        }

                        const getResult = await this.#get(context, query, pointer.concat(i), errorFormatter);
                        if (!getResult.ok) {
                            return getResult;
                        }

                        results.push(getResult.value.resource!);

                        eventStore.add(
                            'update',
                            context,
                            query,
                            editableResource,
                            getResult.value.resource!,
                            [],
                            'api',
                        );
                        eventStore.add(
                            'change',
                            context,
                            query,
                            getResultOld.value.resource,
                            getResult.value.resource,
                            'api',
                        );
                    } else if (operation.op === 'remove') {
                        const query: Query<P, ResourceDeclaration, [], 'id'> = {
                            ref: {
                                type: operation.ref.type,
                                id: 'lid' in operation.ref ? lidMap.get(operation.ref.lid)! : operation.ref.id,
                            },
                        };
                        const getResultOld = await this.#get(context, query, pointer.concat(i), errorFormatter);
                        if (!getResultOld.ok) {
                            return getResultOld;
                        }

                        const result = await this.#remove(context, query, pointer.concat(i), true, errorFormatter);
                        if (!result.ok) {
                            return result;
                        }

                        results.push(query.ref.id);

                        eventStore.add('remove', context, query, 'api');
                        eventStore.add('change', context, query, getResultOld.value.resource, null, 'api');
                    } else if (operation.op === 'add-relationships') {
                        const query: Query<P, ResourceDeclaration, [], 'relationship'> = {
                            ref: {
                                type: operation.ref.type,
                                id: 'lid' in operation.ref ? lidMap.get(operation.ref.lid)! : operation.ref.id,
                                relationship: operation.ref.relationship,
                            },
                        };
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        const resourceIdentifiers = this.#setIdByLid(operation.data, lidMap) as ResourceIdentifier<
                            MultipleRelationshipTypes<ResourceDeclaration>
                        >[];
                        const result = await this.#addRelationships(
                            context,
                            query,
                            resourceIdentifiers,
                            pointer.concat(i),
                            true,
                            errorFormatter,
                        );
                        if (!result.ok) {
                            return result;
                        }

                        const relationshipResult = await this.#relationship(
                            context,
                            query,
                            pointer.concat(i),
                            errorFormatter,
                        );
                        if (!relationshipResult.ok) {
                            return relationshipResult;
                        }

                        results.push([query.ref.id, relationshipResult.value.relationship]);

                        eventStore.add(
                            'add-relationship',
                            context,
                            query,
                            resourceIdentifiers,
                            relationshipResult.value.relationship as DataList<ResourceIdentifier<string>>,
                            [],
                        );
                    } else if (operation.op === 'update-relationships') {
                        const query: Query<P, ResourceDeclaration, [], 'relationship'> = {
                            ref: {
                                type: operation.ref.type,
                                id: 'lid' in operation.ref ? lidMap.get(operation.ref.lid)! : operation.ref.id,
                                relationship: operation.ref.relationship,
                            },
                        };
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        const resourceIdentifiers = this.#setIdByLid(operation.data, lidMap);
                        const result = await this.#updateRelationship(
                            context,
                            query,
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-expect-error
                            resourceIdentifiers,
                            pointer.concat(i),
                            true,
                            errorFormatter,
                        );
                        if (!result.ok) {
                            return result;
                        }

                        const relationshipResult = await this.#relationship(
                            context,
                            query,
                            pointer.concat(i),
                            errorFormatter,
                        );
                        if (!relationshipResult.ok) {
                            return relationshipResult;
                        }

                        results.push([query.ref.id, relationshipResult.value.relationship]);

                        eventStore.add(
                            'update-relationship',
                            context,
                            query,
                            resourceIdentifiers,
                            relationshipResult.value.relationship,
                            [],
                        );
                    } else if (operation.op === 'remove-relationships') {
                        const query: Query<P, ResourceDeclaration, [], 'relationship'> = {
                            ref: {
                                type: operation.ref.type,
                                id: 'lid' in operation.ref ? lidMap.get(operation.ref.lid)! : operation.ref.id,
                                relationship: operation.ref.relationship,
                            },
                        };
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        const resourceIdentifiers = this.#setIdByLid(operation.data, lidMap) as ResourceIdentifier<
                            MultipleRelationshipTypes<ResourceDeclaration>
                        >[];
                        const result = await this.#removeRelationships(
                            context,
                            query,
                            resourceIdentifiers,
                            pointer.concat(i),
                            true,
                            errorFormatter,
                        );
                        if (!result.ok) {
                            return result;
                        }

                        const relationshipResult = await this.#relationship(
                            context,
                            query,
                            pointer.concat(i),
                            errorFormatter,
                        );
                        if (!relationshipResult.ok) {
                            return relationshipResult;
                        }

                        results.push([query.ref.id, relationshipResult.value.relationship]);

                        eventStore.add(
                            'remove-relationship',
                            context,
                            query,
                            resourceIdentifiers,
                            relationshipResult.value.relationship as DataList<ResourceIdentifier<string>>,
                            [],
                        );
                    }
                }

                eventStore.add(
                    'operations',
                    context,
                    operations as Operation<ResourceDeclaration>[],
                    results as OperationResults<Operation<ResourceDeclaration>[]>,
                );

                return {
                    ok: true,
                    value: results,
                };
            },
            {
                method: 'operations',
                operations: operations as Operation<ResourceDeclaration>[],
                lidMap,
                finished: results.length,
                finishedResults: results as OperationResults<Operation<ResourceDeclaration>[]>,
            },
        );
    }

    // test it
    collectEvents(context: C, outerEvents: OuterEvent[]): EventStore<EventMap<C, P>> {
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();

        for (const outerEvent of outerEvents) {
            if (outerEvent.type === 'add') {
                eventStore.add(
                    'add',
                    context,
                    {
                        ref: {
                            type: outerEvent.resourceIdentifier.type,
                        },
                    },
                    outerEvent.newResource,
                    outerEvent.resource,
                    [],
                    'outer',
                );
                eventStore.add(
                    'change',
                    context,
                    {
                        ref: {
                            type: outerEvent.resourceIdentifier.type,
                        },
                    },
                    null,
                    outerEvent.resource,
                    'outer',
                );
            } else if (outerEvent.type === 'update') {
                eventStore.add(
                    'update',
                    context,
                    {
                        ref: {
                            type: outerEvent.resourceIdentifier.type,
                            id: outerEvent.resourceIdentifier.id,
                        },
                    },
                    outerEvent.editableResource,
                    outerEvent.resource,
                    [],
                    'outer',
                );
                eventStore.add(
                    'change',
                    context,
                    {
                        ref: {
                            type: outerEvent.resourceIdentifier.type,
                            id: outerEvent.resourceIdentifier.id,
                        },
                    },
                    outerEvent.previousResource ?? null,
                    outerEvent.resource,
                    'outer',
                );
            } else if (outerEvent.type === 'remove') {
                eventStore.add(
                    'remove',
                    context,
                    {
                        ref: {
                            type: outerEvent.resourceIdentifier.type,
                            id: outerEvent.resourceIdentifier.id,
                        },
                    },
                    'outer',
                );
                eventStore.add(
                    'change',
                    context,
                    {
                        ref: {
                            type: outerEvent.resourceIdentifier.type,
                            id: outerEvent.resourceIdentifier.id,
                        },
                    },
                    null,
                    null,
                    'outer',
                );
            }
        }

        return eventStore;
    }

    #checkResourceStatus(
        context: C,
        type: string,
        id: string,
        errorFormatter: ErrorFormatter,
    ): Promise<ResourceStatus> {
        const resourceKeeper = this.#resourceKeepers[type];
        if (!resourceKeeper) {
            return Promise.reject(
                new ErrorSet<CommonError>().add(
                    ErrorFactory.makeInvalidResourceTypeError(errorFormatter, type, 'query'),
                ),
            );
        }

        return resourceKeeper.status(context, [id], errorFormatter).then((result) => result[id]);
    }

    async #checkResourceIdentifierStatus(
        context: C,
        resourceIdentifier: ResourceIdentifier<string>,
        pointer: Pointer,
        ignoreNotFound: boolean,
        errorFormatter: ErrorFormatter,
    ): Promise<CommonError[]> {
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const errors: CommonError[] = [];
        const status = await this.#checkResourceStatus(
            context,
            resourceIdentifier.type,
            resourceIdentifier.id,
            errorFormatter,
        );
        if (!ignoreNotFound && status.type === 'not-found') {
            errors.push(
                ErrorFactory.makeNotFoundError(
                    errorFormatter,
                    pointer.concat('id'),
                    `Resource with id "${resourceIdentifier.id}" doesn't exist.`,
                ),
            );
        }
        if (status.type === 'forbidden') {
            errors.push(
                ErrorFactory.makeForbiddenError(
                    errorFormatter,
                    pointer.concat('id'),
                    `Resource with id "${resourceIdentifier.id}" is forbidden.`,
                ),
            );
        }
        return errors;
    }

    async #checkResourceIdentifiersStatus(
        context: C,
        resourceIdentifiers: ResourceIdentifier<string>[],
        pointer: Pointer,
        ignoreNotFound: boolean,
        errorFormatter: ErrorFormatter,
    ): Promise<CommonError[]> {
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const errors: CommonError[] = [];
        for (let i = 0; i < resourceIdentifiers.length; i++) {
            const existingErrors = await this.#checkResourceIdentifierStatus(
                context,
                resourceIdentifiers[i],
                pointer.concat(i),
                ignoreNotFound,
                errorFormatter,
            );
            errors.push(...existingErrors);
        }
        return errors;
    }

    async #checkResourceIdentifiers<D extends ResourceDeclaration, R extends keyof D['relationships']>(
        context: C,
        resourceIdentifiers: NewRelationshipValue<D['relationships'][R], 'single'>,
        pointer: Pointer,
        ignoreNotFound: boolean,
        errorFormatter: ErrorFormatter,
    ): Promise<CommonError[]> {
        const errors: CommonError[] = [];
        if (Array.isArray(resourceIdentifiers)) {
            for (let i = 0; i < resourceIdentifiers.length; i++) {
                const existingErrors = await this.#checkResourceIdentifierStatus(
                    context,
                    resourceIdentifiers[i],
                    pointer.concat(i),
                    ignoreNotFound,
                    errorFormatter,
                );
                errors.push(...existingErrors);
            }
        } else if (resourceIdentifiers !== null) {
            const existingErrors = await this.#checkResourceIdentifierStatus(
                context,
                resourceIdentifiers,
                pointer,
                ignoreNotFound,
                errorFormatter,
            );
            errors.push(...existingErrors);
        }
        return errors;
    }

    makeStore(): EventStore<EventMap<C, P>> {
        return this.#eventEmitter.makeStore();
    }

    // think about create new
    init(): this {
        Object.keys(this.#resourceKeepers).forEach((name) => {
            const resourceKeeper = this.#resourceKeepers[name];
            Object.keys(resourceKeeper.schema.relationships).forEach((field) => {
                const relationshipTypes = resourceKeeper.schema.relationships[field].types;
                relationshipTypes.forEach((relationshipType) => {
                    if (!this.#resourceKeepers[relationshipType]) {
                        throw new Error(
                            `Could not find type '${relationshipType}' in resource keepers from resource '${resourceKeeper.schema.type}' and relationship '${field}'.`,
                        );
                    }
                });
            });
        });

        this.#initialized = true;

        return this;
    }
}
