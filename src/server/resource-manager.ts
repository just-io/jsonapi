import { ErrorFactory } from './errors';
import { ResourceStatus, ResourceKeeper, ResourceOptions } from './resource-keeper';
import {
    PageProvider,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommonResourceKeeper<C, P> = ResourceKeeper<any, C, P>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommonResourceOptions<P> = ResourceOptions<any, P>;

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
    add: [
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'list'>,
        newResource: NewResource<ResourceDeclaration>,
        resource: CommonResource,
        included: CommonResource[],
    ];
    update: [
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>,
        editableResource: EditableResource<ResourceDeclaration>,
        resource: CommonResource,
        included: CommonResource[],
    ];
    remove: [context: C, query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>];
    change: [
        context: C,
        query:
            | Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>
            | Query<P, ResourceDeclaration, ResourceDeclaration[], 'list'>,
        oldResource: CommonResource | null,
        newResource: CommonResource | null,
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

    addResourceKeeper<D extends ResourceDeclaration>(resourceKeeper: ResourceKeeper<D, C, P>): this {
        this.#resourceKeepers[resourceKeeper.schema.type] = resourceKeeper;
        this.#checker.addResourceKeeper(resourceKeeper);
        return this;
    }

    hasResourceKeeper(type: string): boolean {
        return Boolean(this.#resourceKeepers[type]);
    }

    #composeFilter(
        resourceKeeper: CommonResourceKeeper<C, P>,
        filter: FilterFields,
    ): CommonResourceOptions<P>['filter'] {
        const newFilter: CommonResourceOptions<P>['filter'] = {};
        if (resourceKeeper.schema.listable) {
            for (const key in filter) {
                const filterSchema = resourceKeeper.schema.filter[key];
                if (filterSchema.multiple) {
                    newFilter[key] = filterSchema.transformer(filter[key]);
                } else {
                    newFilter[key] = filterSchema.transformer(filter[key][0]);
                }
            }
        }

        return newFilter;
    }

    async #listIncludes<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        context: C,
        query: Query<P, D, I, 'list' | 'id' | 'relationship'>,
        type: string,
        mainResources: CommonResource[],
        include: string[],
    ): Promise<CommonResource[]> {
        const resources: CommonResource[] = [];
        const [name, ...rest] = include;
        if (!name) {
            return [];
        }

        if (!this.#resourceKeepers[type].schema.relationships[name]) {
            throw new ErrorSet<CommonError>().add(
                ErrorFactory.makeInvalidQueryParameterError(
                    'include',
                    `The resource type '${type}' does not have field '${name}'.`,
                ),
            );
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
            const statuses = await resourceKeeper.status(context, groups[key]);
            for (const status of Object.values(statuses)) {
                if (status.type === 'forbidden') {
                    errorSet.add(ErrorFactory.makeForbiddenError('include', status.reason));
                    continue;
                }
                if (!status || status.type === 'not-found') {
                    errorSet.add(ErrorFactory.makeNotFoundError('include', name));
                    continue;
                }
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

            const subResources = await this.#listIncludes(context, query, key, includedResources, rest);

            for (const subResource of subResources) {
                if (
                    !resources.some((resource) => resource.id === subResource.id && resource.type === subResource.type)
                ) {
                    resources.push(subResource);
                }
            }
        }

        if (errorSet.errors.length) {
            throw errorSet;
        }

        return resources.map((resource) => filterResourceFields(resource, query.params?.fields?.[resource.type]));
    }

    async #get<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'id'>,
        location: Pointer | 'query' = 'query',
    ): Promise<{ resource: Resource<D> | null; included: IncludedResources<I>[] }> {
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet = this.#checker.checkQuery('get', query, location, true);
        if (errorSet.errors.length) {
            throw errorSet;
        }
        const status = (await resourceKeeper.status(context, [query.ref.id]))[query.ref.id];
        if (!status || status.type === 'not-found') {
            return {
                resource: null,
                included: [],
            };
        }
        if (status.type === 'forbidden') {
            throw new ErrorSet<CommonError>().add(ErrorFactory.makeForbiddenError('query', status.reason));
        }
        const [resource] = await resourceKeeper.get(context, [query.ref.id], {
            page: query.params?.page,
        });
        const included: CommonResource[] = [];
        if (query.params?.include) {
            for (const relationshipInclude of query.params.include) {
                const includedResources = await this.#listIncludes(
                    context,
                    query,
                    resource.type,
                    [resource],
                    relationshipInclude,
                );
                included.push(...includedResources);
            }
        }

        return {
            resource: filterResourceFields(resource, query.params?.fields?.[resource.type]) as Resource<D>,
            included: included as IncludedResources<I>[],
        };
    }

    async get<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'id'>,
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
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();
        try {
            const { resource, included } = await this.#get(context, query, 'query');
            eventStore.add('get', context, query, resource, included);

            return {
                result: {
                    ok: true,
                    value: {
                        resource,
                        included,
                    },
                },
                eventStore,
            };
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add(
                    'error',
                    context,
                    {
                        method: 'get',
                        query,
                    },
                    error,
                );

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

    async #relationship<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        location: Pointer | 'query' = 'query',
    ): Promise<{ relationship: RelationshipValue<D['relationships'][R]>; included: IncludedResources<I>[] }> {
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet = this.#checker.checkQuery('get', query, location, true);
        if (errorSet.errors.length) {
            throw errorSet;
        }
        const status = (await resourceKeeper.status(context, [query.ref.id]))[query.ref.id];
        if (status.type === 'forbidden') {
            throw new ErrorSet<CommonError>().add(ErrorFactory.makeForbiddenError('query', status.reason));
        }
        if (status.type === 'not-found') {
            throw new ErrorSet<CommonError>().add(ErrorFactory.makeNotFoundError('query'));
        }

        const relationshipInfo = resourceKeeper.schema.relationships[query.ref.relationship];
        if (!relationshipInfo) {
            throw new ErrorSet<CommonError>().add(ErrorFactory.makeNotFoundError('query'));
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
                const includedResources = await this.#listIncludes(
                    context,
                    query,
                    resource.type,
                    [resource],
                    relationshipInclude,
                );
                included.push(...includedResources);
            }
        }

        return {
            relationship,
            included: included as IncludedResources<I>[],
        };
    }

    async relationship<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
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
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();
        try {
            const { relationship, included } = await this.#relationship(context, query, 'query');
            eventStore.add('relationship', context, query, relationship, included);

            return {
                result: {
                    ok: true,
                    value: {
                        relationship,
                        included,
                    },
                },
                eventStore,
            };
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add(
                    'error',
                    context,
                    {
                        method: 'relationship',
                        query,
                    },
                    error,
                );
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

    async #list<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'list'>,
        location: Pointer | 'query' = 'query',
    ): Promise<{ resources: DataList<Resource<D>>; included: IncludedResources<I>[] }> {
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet = this.#checker.checkQuery('list', query, location, true);
        if (errorSet.errors.length) {
            throw errorSet;
        }
        const list = await resourceKeeper.list(context, {
            filter: this.#composeFilter(resourceKeeper, query.params?.filter as FilterFields),
            page: query.params?.page,
            sort: query.params?.sort,
            // fields: query.params?.fields?.[query.ref.type],
        });
        const included: CommonResource[] = [];
        if (query.params?.include) {
            for (const relationshipInclude of query.params.include) {
                const includedResources = await this.#listIncludes(
                    context,
                    query,
                    query.ref.type,
                    list.items,
                    relationshipInclude,
                );
                included.push(...includedResources);
            }
        }

        return {
            resources: list as DataList<Resource<D>>,
            included: included as IncludedResources<I>[],
        };
    }

    async list<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'list'>,
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
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();
        try {
            const { resources, included } = await this.#list(context, query, 'query');
            eventStore.add('list', context, query, resources, included);

            resources.items = resources.items.map(
                (resource) => filterResourceFields(resource, query.params?.fields?.[resource.type]) as Resource<D>,
            );

            return {
                result: {
                    ok: true,
                    value: {
                        resources,
                        included,
                    },
                },
                eventStore,
            };
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add(
                    'error',
                    context,
                    {
                        method: 'list',
                        query,
                    },
                    error,
                );
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

    async #checkResourceRelationshipFields(
        context: C,
        type: string,
        resource: Omit<CommonNewResource | CommonEditableResource, 'id'>,
        pointer: Pointer,
    ): Promise<ErrorSet<CommonError>> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];

        if (!resourceKeeper) {
            throw new ErrorSet<CommonError>().add(ErrorFactory.makeInvalidResourceTypeError(resource.type, 'query'));
        }

        for (const [name, relationshipResource] of Object.entries(resource.relationships)) {
            if (Array.isArray(relationshipResource)) {
                for (let i = 0; i < relationshipResource.length; i++) {
                    const status = await this.#checkResourceStatus(
                        context,
                        relationshipResource[i].type,
                        relationshipResource[i].id,
                    );
                    if (status.type === 'not-found') {
                        errorSet.add(ErrorFactory.makeNotFoundError(pointer.concat('relationships', name, i, 'id')));
                    } else if (status.type === 'forbidden') {
                        errorSet.add(ErrorFactory.makeForbiddenError(pointer.concat('relationships', name, i, 'id')));
                    }
                }
            } else if (relationshipResource) {
                const status = await this.#checkResourceStatus(
                    context,
                    relationshipResource.type,
                    relationshipResource.id,
                );
                if (status.type === 'not-found') {
                    errorSet.add(ErrorFactory.makeNotFoundError(pointer.concat('relationships', name, 'id')));
                } else if (status.type === 'forbidden') {
                    errorSet.add(ErrorFactory.makeForbiddenError(pointer.concat('relationships', name, 'id')));
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
    ): Promise<string> {
        const location = operation ? pointer : 'query';
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        if (query.ref.type !== newResource.type) {
            throw new ErrorSet<CommonError>().add(
                ErrorFactory.makeInvalidResourceTypeError(newResource.type, location),
            );
        }
        const errorSet = this.#checker.checkQuery('add', query, location, true);
        if (errorSet.errors.length) {
            throw errorSet;
        }
        errorSet.append(this.#checker.checkResourceFields(pointer, newResource.type, newResource, true));
        errorSet.append(this.#checker.checkResourceFieldsForExisting(pointer, newResource.type, newResource));
        errorSet.append(await this.#checkResourceRelationshipFields(context, newResource.type, newResource, pointer));
        // think about it
        if (newResource.id) {
            const status = await this.#checkResourceStatus(context, newResource.type, newResource.id);
            if (status.type !== 'not-found') {
                errorSet.add(ErrorFactory.makeNotFoundError(location));
            }
        }
        if (errorSet.errors.length) {
            throw errorSet;
        }

        return resourceKeeper.add(context, newResource);
    }

    async add<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'list'>,
        newResource: NewResource<D>,
        pointer = new Pointer(''),
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
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();
        try {
            const resourceId = await this.#add(context, query, newResource, pointer, false);

            const { resource, included } = await this.#get(context, {
                ref: { ...query.ref, id: resourceId },
                params: query.params,
            });

            eventStore.add(
                'add',
                context,
                query,
                newResource as unknown as NewResource<ResourceDeclaration>,
                resource!,
                included,
            );
            eventStore.add('change', context, query, null, resource);

            return {
                result: {
                    ok: true,
                    value: {
                        resource: resource!,
                        included,
                    },
                },
                eventStore,
            };
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add(
                    'error',
                    context,
                    {
                        method: 'add',
                        query,
                        newResource: newResource as unknown as NewResource<ResourceDeclaration>,
                    },
                    error,
                );
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

    async #update<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'id'>,
        editableResource: EditableResource<D>,
        pointer: Pointer,
        operation: boolean,
    ): Promise<void> {
        const location = operation ? pointer : 'query';
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        if (query.ref.type !== editableResource.type) {
            throw new ErrorSet<CommonError>().add(
                ErrorFactory.makeInvalidResourceTypeError(editableResource.type, location),
            );
        }
        if (query.ref.id !== editableResource.id) {
            throw new ErrorSet<CommonError>().add(ErrorFactory.makeInvalidResourceIdError(pointer.concat('id')));
        }
        const errorSet = this.#checker.checkQuery('update', query, location, true);
        if (errorSet.errors.length) {
            throw errorSet;
        }
        errorSet.append(this.#checker.checkResourceFields(pointer, editableResource.type, editableResource, false));
        errorSet.append(
            await this.#checkResourceRelationshipFields(context, editableResource.type, editableResource, pointer),
        );
        const status = await this.#checkResourceStatus(context, editableResource.type, editableResource.id);
        if (status.type === 'not-found') {
            errorSet.add(ErrorFactory.makeNotFoundError(location));
        } else if (status.type === 'forbidden') {
            errorSet.add(ErrorFactory.makeForbiddenError(location));
        }
        if (errorSet.errors.length) {
            throw errorSet;
        }

        await resourceKeeper.update(context, editableResource);
    }

    async update<D extends ResourceDeclaration, I extends ResourceDeclaration[] = []>(
        context: C,
        query: Query<P, D, I, 'id'>,
        editableResource: EditableResource<D>,
        pointer = new Pointer(''),
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
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();
        try {
            const { resource: oldResource } = await this.#get(context, { ref: query.ref });
            await this.#update(context, query, editableResource, pointer, false);

            const { resource, included } = await this.#get(context, query);
            const { resource: newResource } = await this.#get(context, { ref: query.ref });

            eventStore.add(
                'update',
                context,
                query,
                editableResource as unknown as EditableResource<ResourceDeclaration>,
                resource!,
                included,
            );
            eventStore.add('change', context, query, oldResource, newResource);

            return {
                result: {
                    ok: true,
                    value: {
                        resource: resource!,
                        included,
                    },
                },
                eventStore,
            };
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add(
                    'error',
                    context,
                    {
                        method: 'update',
                        query,
                        editableResource: editableResource as unknown as EditableResource<ResourceDeclaration>,
                    },
                    error,
                );
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

    async #remove<D extends ResourceDeclaration>(
        context: C,
        query: Query<P, D, [], 'id'>,
        pointer: Pointer,
        operation: boolean,
    ): Promise<void> {
        const location = operation ? pointer : 'query';
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet = this.#checker.checkQuery('remove', query, location, true);
        if (errorSet.errors.length) {
            throw errorSet;
        }
        const status = await this.#checkResourceStatus(context, query.ref.type, query.ref.id);
        if (status.type === 'not-found') {
            errorSet.add(ErrorFactory.makeNotFoundError(location));
        } else if (status.type === 'forbidden') {
            errorSet.add(ErrorFactory.makeForbiddenError(location));
        }
        if (errorSet.errors.length) {
            throw errorSet;
        }

        await resourceKeeper.remove(context, query.ref.id);
    }

    async remove<D extends ResourceDeclaration>(
        context: C,
        query: Query<P, D, [], 'id'>,
        pointer = new Pointer(''),
    ): Promise<{
        result: Result<void, ErrorSet<CommonError>>;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();
        try {
            const { resource: oldResource } = await this.#get(context, { ref: query.ref });
            await this.#remove(context, query, pointer, false);

            eventStore.add('remove', context, query);
            eventStore.add('change', context, query, oldResource, null);

            return {
                result: {
                    ok: true,
                    value: undefined,
                },
                eventStore,
            };
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add(
                    'error',
                    context,
                    {
                        method: 'remove',
                        query,
                    },
                    error,
                );
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
    ): Promise<void> {
        const location = operation ? pointer : 'query';
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet = this.#checker.checkQuery('update', query, location, false);
        if (errorSet.errors.length) {
            throw errorSet;
        }
        const relationshipInfo = resourceKeeper.schema.relationships[query.ref.relationship];
        errorSet.append(
            this.#checker.checkResourceRelationshipValue(
                pointer,
                query.ref.type,
                query.ref.relationship as string,
                resourceIdentifiers,
                false,
            ),
        );
        if (resourceIdentifiers !== null) {
            const statusErrors = await this.#checkResourceIdentifiers(context, resourceIdentifiers, pointer);
            errorSet.add(...statusErrors);
        }
        if (
            errorSet.errors.length ||
            (relationshipInfo.multiple && !Array.isArray(resourceIdentifiers)) ||
            (!relationshipInfo.multiple && Array.isArray(resourceIdentifiers)) ||
            relationshipInfo.mode === 'readonly' ||
            (!relationshipInfo.nullable && resourceIdentifiers === null)
        ) {
            throw errorSet;
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await relationshipInfo.update(context, query.ref.id, resourceIdentifiers);
    }

    async updateRelationship<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        resourceIdentifiers: NewRelationshipValue<D['relationships'][R], 'single'>,
        pointer = new Pointer(''),
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
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();
        try {
            await this.#updateRelationship(context, query, resourceIdentifiers, pointer, false);

            const { relationship, included } = await this.#relationship(context, query);

            eventStore.add('update-relationship', context, query, resourceIdentifiers, relationship, included);

            return {
                result: {
                    ok: true,
                    value: {
                        relationship,
                        included,
                    },
                },
                eventStore,
            };
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add(
                    'error',
                    context,
                    {
                        method: 'update-relationship',
                        query,
                        relationshipValue: resourceIdentifiers,
                    },
                    error,
                );
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
    ): Promise<void> {
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const location = operation ? pointer : 'query';
        const errorSet = this.#checker.checkQuery('update', query, location, false);
        if (errorSet.errors.length) {
            throw errorSet;
        }
        const relationshipInfo = resourceKeeper.schema.relationships[query.ref.relationship];
        errorSet.append(
            this.#checker.checkResourceRelationshipValue(
                pointer,
                query.ref.type,
                query.ref.relationship as string,
                resourceIdentifiers,
                false,
            ),
        );
        const statusErrors = await this.#checkResourceIdentifiersStatus(context, resourceIdentifiers, pointer);
        errorSet.add(...statusErrors);
        if (errorSet.errors.length || !relationshipInfo.multiple || relationshipInfo.mode === 'readonly') {
            throw errorSet;
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await relationshipInfo.add(context, query.ref.id, resourceIdentifiers);
    }

    async addRelationships<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        resourceIdentifiers: ResourceIdentifier<D['relationships'][R]['types']>[],
        pointer = new Pointer(''),
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
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();
        try {
            await this.#addRelationships(context, query, resourceIdentifiers, pointer, false);

            const { relationship, included } = await this.#relationship(context, query);

            eventStore.add(
                'add-relationship',
                context,
                query,
                resourceIdentifiers,
                relationship as DataList<ResourceIdentifier<string>>,
                included,
            );

            return {
                result: {
                    ok: true,
                    value: {
                        relationship,
                        included,
                    },
                },
                eventStore,
            };
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add(
                    'error',
                    context,
                    {
                        method: 'add-relationship',
                        query,
                        relationshipValue: resourceIdentifiers,
                    },
                    error,
                );
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
    ): Promise<void> {
        const location = operation ? pointer : 'query';
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        const errorSet = this.#checker.checkQuery('update', query, location, false);
        const relationshipInfo = resourceKeeper.schema.relationships[query.ref.relationship];
        errorSet.append(
            this.#checker.checkResourceRelationshipValue(
                pointer,
                query.ref.type,
                query.ref.relationship as string,
                resourceIdentifiers,
                false,
            ),
        );
        const existingErrors = await this.#checkResourceIdentifiersStatus(context, resourceIdentifiers, pointer, true);
        errorSet.add(...existingErrors);
        if (errorSet.errors.length || !relationshipInfo.multiple || relationshipInfo.mode === 'readonly') {
            throw errorSet;
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await relationshipInfo.remove(context, query.ref.id, resourceIdentifiers);
    }

    async removeRelationships<
        D extends ResourceDeclaration,
        R extends keyof D['relationships'],
        I extends ResourceDeclaration[] = [],
    >(
        context: C,
        query: Query<P, D, I, 'relationship', R>,
        resourceIdentifiers: ResourceIdentifier<D['relationships'][R]['types']>[],
        pointer = new Pointer(''),
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
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const eventStore = this.#eventEmitter.makeStore();
        try {
            await this.#removeRelationships(context, query, resourceIdentifiers, pointer, false);

            const { relationship, included } = await this.#relationship(context, query);

            eventStore.add(
                'remove-relationship',
                context,
                query,
                resourceIdentifiers,
                relationship as DataList<ResourceIdentifier<string>>,
                included,
            );

            return {
                result: {
                    ok: true,
                    value: {
                        relationship,
                        included,
                    },
                },
                eventStore,
            };
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add(
                    'error',
                    context,
                    {
                        method: 'remove-relationship',
                        query,
                        relationshipValue: resourceIdentifiers,
                    },
                    error,
                );
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
        pointer = new Pointer(''),
    ): Promise<{
        result: Result<OperationResults<OA>, ErrorSet<CommonError>>;
        eventStore: EventStore<EventMap<C, P>>;
    }> {
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const lidMap = new Map<string, string>();
        const errorSet = new ErrorSet<CommonError>();
        const eventStore = this.#eventEmitter.makeStore();
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
                    ),
                );
                if ('lid' in operation.ref && !lidMap.has(operation.ref.lid)) {
                    errorSet.add(ErrorFactory.makeInvalidResourceLidError(pointer.concat(i, 'ref', 'lid')));
                }
            }
            if (operation.op === 'remove') {
                if ('lid' in operation.ref && !lidMap.has(operation.ref.lid)) {
                    errorSet.add(ErrorFactory.makeInvalidResourceLidError(pointer.concat(i, 'ref', 'lid')));
                }
            }
            if (operation.op === 'update') {
                if ('lid' in operation.data && !lidMap.has(operation.data.lid)) {
                    errorSet.add(ErrorFactory.makeInvalidResourceLidError(pointer.concat(i, 'data', 'lid')));
                }
            }
        }
        if (errorSet.errors.length) {
            return {
                result: {
                    ok: false,
                    error: errorSet,
                },
                eventStore,
            };
        }

        const results: OperationResults<OA> = [] as OperationResults<OA>;
        try {
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
                    const id = await this.#add(context, query, newResource, pointer.concat(i), true);

                    if ('lid' in operation.data && operation.data.lid) {
                        lidMap.set(operation.data.lid, id);
                    }

                    const { resource } = await this.#get(context, {
                        ref: {
                            type: operation.data.type,
                            id,
                        },
                    });

                    results.push(resource!);

                    eventStore.add('add', context, query, newResource, resource!, []);
                    eventStore.add('change', context, query, null, resource);
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
                    const { resource: oldResource } = await this.#get(context, query);
                    await this.#update(context, query, editableResource, pointer.concat(i), true);

                    const { resource } = await this.#get(context, query);

                    results.push(resource!);

                    eventStore.add('update', context, query, editableResource, resource!, []);
                    eventStore.add('change', context, query, oldResource, resource);
                } else if (operation.op === 'remove') {
                    const query: Query<P, ResourceDeclaration, [], 'id'> = {
                        ref: {
                            type: operation.ref.type,
                            id: 'lid' in operation.ref ? lidMap.get(operation.ref.lid)! : operation.ref.id,
                        },
                    };
                    const { resource: oldResource } = await this.#get(context, query);
                    await this.#remove(context, query, pointer.concat(i), true);

                    results.push(query.ref.id);

                    eventStore.add('remove', context, query);
                    eventStore.add('change', context, query, oldResource, null);
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
                    await this.#addRelationships(context, query, resourceIdentifiers, pointer.concat(i), true);

                    const { relationship } = await this.#relationship(context, query);

                    results.push([query.ref.id, relationship]);

                    eventStore.add(
                        'add-relationship',
                        context,
                        query,
                        resourceIdentifiers,
                        relationship as DataList<ResourceIdentifier<string>>,
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
                    await this.#updateRelationship(
                        context,
                        query,
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        resourceIdentifiers,
                        pointer.concat(i),
                        true,
                    );

                    const { relationship } = await this.#relationship(context, query);

                    results.push([query.ref.id, relationship]);

                    eventStore.add('update-relationship', context, query, resourceIdentifiers, relationship, []);
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
                    await this.#removeRelationships(context, query, resourceIdentifiers, pointer.concat(i), true);

                    const { relationship } = await this.#relationship(context, query);

                    results.push([query.ref.id, relationship]);

                    eventStore.add(
                        'remove-relationship',
                        context,
                        query,
                        resourceIdentifiers,
                        relationship as DataList<ResourceIdentifier<string>>,
                        [],
                    );
                }
            }
        } catch (error) {
            if (error instanceof ErrorSet) {
                eventStore.add(
                    'error',
                    context,
                    {
                        method: 'operations',
                        operations: operations as Operation<ResourceDeclaration>[],
                        lidMap,
                        finished: results.length,
                        finishedResults: results as OperationResults<Operation<ResourceDeclaration>[]>,
                    },
                    error,
                );
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

        eventStore.add(
            'operations',
            context,
            operations as Operation<ResourceDeclaration>[],
            results as OperationResults<Operation<ResourceDeclaration>[]>,
        );

        return {
            result: {
                ok: true,
                value: results,
            },
            eventStore,
        };
    }

    #checkResourceStatus(context: C, type: string, id: string): Promise<ResourceStatus> {
        const resourceKeeper = this.#resourceKeepers[type];
        if (!resourceKeeper) {
            return Promise.reject(
                new ErrorSet<CommonError>().add(ErrorFactory.makeInvalidResourceTypeError(type, 'query')),
            );
        }

        return resourceKeeper.status(context, [id]).then((result) => result[id]);
    }

    async #checkResourceIdentifierStatus(
        context: C,
        resourceIdentifier: ResourceIdentifier<string>,
        pointer: Pointer,
        ignoreNotFound: boolean = false,
    ): Promise<CommonError[]> {
        if (!this.#initialized) {
            throw new Error('Should be initialized');
        }
        const errors: CommonError[] = [];
        const status = await this.#checkResourceStatus(context, resourceIdentifier.type, resourceIdentifier.id);
        if (!ignoreNotFound && status.type === 'not-found') {
            errors.push(
                ErrorFactory.makeNotFoundError(
                    pointer.concat('id'),
                    `Resource with id "${resourceIdentifier.id}" doesn't exist.`,
                ),
            );
        }
        if (status.type === 'forbidden') {
            errors.push(
                ErrorFactory.makeForbiddenError(
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
        ignoreNotFound: boolean = false,
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
            );
            errors.push(...existingErrors);
        }
        return errors;
    }

    async #checkResourceIdentifiers<D extends ResourceDeclaration, R extends keyof D['relationships']>(
        context: C,
        resourceIdentifiers: NewRelationshipValue<D['relationships'][R], 'single'>,
        pointer: Pointer,
        ignoreNotFound: boolean = false,
    ): Promise<CommonError[]> {
        const errors: CommonError[] = [];
        if (Array.isArray(resourceIdentifiers)) {
            for (let i = 0; i < resourceIdentifiers.length; i++) {
                const existingErrors = await this.#checkResourceIdentifierStatus(
                    context,
                    resourceIdentifiers[i],
                    pointer.concat(i),
                    ignoreNotFound,
                );
                errors.push(...existingErrors);
            }
        } else if (resourceIdentifiers !== null) {
            const existingErrors = await this.#checkResourceIdentifierStatus(
                context,
                resourceIdentifiers,
                pointer,
                ignoreNotFound,
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
