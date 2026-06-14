import { ErrorSet, Result } from '@just-io/schema';
import { DataList, ResourceIdentifier, ResourceKey } from '../types/common';
import { CommonError } from '../types/formats';
import { Resource, ResourceDeclaration } from '../types/resource-declaration';
import { makeResourceIdentifierByResourceKey, makeResourceKey } from './utils';
import { ObservationEvent, ObservationQuery, ObservationQueryResourceOptions } from '../types/observer';

export type IncomingEvent = {
    type: 'add' | 'update' | 'remove';
    resourceIdentifier: ResourceIdentifier<string>;
};

type ObserverId = string;

export type ResourceInformer<C> = {
    checkObservationQuery(observationQuery: ObservationQuery): ErrorSet<CommonError>;
    get(context: C, type: string, id: string): Promise<Resource<ResourceDeclaration> | null>;
    relationship(
        context: C,
        type: string,
        id: string,
        relationship: string,
        offset: number,
    ): Promise<DataList<ResourceIdentifier<string>>>;
    isAvailable(context: C, type: string, id: string): Promise<boolean>;
};

const eventMap = {
    add: 'addingResourceTypes',
    update: 'updatingResourceTypes',
} as const;

export class ResourceObserver<C> {
    #resourceInformer: ResourceInformer<C>;

    constructor(resourceInformer: ResourceInformer<C>) {
        this.#resourceInformer = resourceInformer;
    }

    async #makeRelationshipResourceKeySet(
        context: C,
        resource: Resource<ResourceDeclaration>,
        relationships?: string[],
    ): Promise<Set<ResourceKey>> {
        const relationshipResourceKeySet = new Set<ResourceKey>();
        if (!relationships) {
            return relationshipResourceKeySet;
        }
        for (const relationship of relationships) {
            const relationshipValue = resource.relationships[
                relationship as keyof Resource<ResourceDeclaration>['relationships']
            ] as ResourceIdentifier<string> | null | DataList<ResourceIdentifier<string>>;
            if (relationshipValue && 'items' in relationshipValue) {
                let relationshipDataList = relationshipValue;
                let offset = relationshipDataList.offset;
                while (true) {
                    for (const resourceIdentifier of relationshipDataList.items) {
                        relationshipResourceKeySet.add(makeResourceKey(resourceIdentifier.type, resourceIdentifier.id));
                    }
                    if (relationshipDataList.items.length < relationshipDataList.limit) {
                        break;
                    }
                    offset = offset + relationshipDataList.limit;
                    const result = await this.#resourceInformer.relationship(
                        context,
                        resource.type,
                        resource.id,
                        relationship,
                        offset,
                    );
                    relationshipDataList = result;
                }
            } else if (relationshipValue) {
                relationshipResourceKeySet.add(makeResourceKey(relationshipValue.type, relationshipValue.id));
            }
        }

        return relationshipResourceKeySet;
    }

    #observerInfoes: Map<
        ObserverId,
        {
            context: C;
            observationEvents: ObservationEvent[];
            callback: (observationEvents: ObservationEvent[]) => void;
        }
    > = new Map();

    #eventObservers = {
        addingResourceTypes: new Map<string, Set<ObserverId>>(),
        updatingResourceTypes: new Map<string, Set<ObserverId>>(),
        resource: new Map<ResourceKey, Map<ObserverId, ObservationQueryResourceOptions>>(),
        // resource -> relationships
        resourceRelationships: new Map<ResourceKey, Map<ObserverId, Set<ResourceKey>>>(),
        // relationship -> resources
        relationshipLinks: new Map<ResourceKey, Map<ObserverId, Set<ResourceKey>>>(),
    };

    async #watchResource(
        context: C,
        type: string,
        id: string,
        observerId: ObserverId,
        options: ObservationQueryResourceOptions,
    ): Promise<boolean> {
        const resource = await this.#resourceInformer.get(context, type, id);
        if (!resource) {
            return false;
        }
        const resourceKey = makeResourceKey(type, id);
        const resourceMap =
            this.#eventObservers.resource.get(resourceKey) ?? new Map<ObserverId, ObservationQueryResourceOptions>();
        resourceMap.set(observerId, options);
        this.#eventObservers.resource.set(resourceKey, resourceMap);

        const relationshipResourceKeySet = await this.#makeRelationshipResourceKeySet(
            context,
            resource,
            !options.relationships
                ? undefined
                : Object.entries(options.relationships)
                      .filter(([, value]) => value)
                      .map(([relationship]) => relationship),
        );
        const resourceRelationships =
            this.#eventObservers.resourceRelationships.get(resourceKey) ?? new Map<ObserverId, Set<ResourceKey>>();
        resourceRelationships.set(observerId, relationshipResourceKeySet);
        this.#eventObservers.resourceRelationships.set(resourceKey, resourceRelationships);
        for (const key of relationshipResourceKeySet) {
            const relationshipLinks =
                this.#eventObservers.relationshipLinks.get(key) ?? new Map<ObserverId, Set<ResourceKey>>();
            this.#eventObservers.relationshipLinks.set(key, relationshipLinks);
            const relationshipLinkSet = relationshipLinks.get(observerId) ?? new Set<ResourceKey>();
            relationshipLinkSet.add(resourceKey);
            relationshipLinks.set(observerId, relationshipLinkSet);
        }

        return true;
    }

    #unwatchResource(type: string, id: string, observerId: ObserverId): void {
        const resourceKey = makeResourceKey(type, id);
        this.#eventObservers.resource.get(resourceKey)?.delete(observerId);
        if (this.#eventObservers.resource.get(resourceKey)?.size === 0) {
            this.#eventObservers.resource.delete(resourceKey);
        }
        const relationshipResourceKeySet = this.#eventObservers.resourceRelationships.get(resourceKey)?.get(observerId);
        if (relationshipResourceKeySet) {
            for (const key of relationshipResourceKeySet) {
                this.#eventObservers.relationshipLinks.get(key)?.get(observerId)?.delete(resourceKey);
                if (this.#eventObservers.relationshipLinks.get(key)?.get(observerId)?.size === 0) {
                    this.#eventObservers.relationshipLinks.get(key)?.delete(observerId);
                }
                if (this.#eventObservers.relationshipLinks.get(key)?.size === 0) {
                    this.#eventObservers.relationshipLinks.delete(key);
                }
            }
        }
        this.#eventObservers.resourceRelationships.get(resourceKey)?.delete(observerId);
        if (this.#eventObservers.resourceRelationships.get(resourceKey)?.size === 0) {
            this.#eventObservers.resourceRelationships.delete(resourceKey);
        }
    }

    async observe(
        context: C,
        observationQuery: ObservationQuery,
        callback: (observationEvents: ObservationEvent[]) => void,
        abortSignal: AbortSignal,
    ): Promise<Result<void, ErrorSet<CommonError>>> {
        const errorSet = this.#resourceInformer.checkObservationQuery(observationQuery);
        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }

        const observerId = crypto.randomUUID() as ObserverId;

        this.#observerInfoes.set(observerId, {
            context,
            observationEvents: [],
            callback,
        });

        if (observationQuery.types) {
            for (const type of Object.keys(observationQuery.types)) {
                if (observationQuery.types[type].adding) {
                    const resourceTypeSet = this.#eventObservers.addingResourceTypes.get(type) ?? new Set();
                    resourceTypeSet.add(observerId);
                    this.#eventObservers.addingResourceTypes.set(type, resourceTypeSet);
                }
                if (observationQuery.types[type].updating) {
                    const resourceTypeSet = this.#eventObservers.updatingResourceTypes.get(type) ?? new Set();
                    resourceTypeSet.add(observerId);
                    this.#eventObservers.updatingResourceTypes.set(type, resourceTypeSet);
                }
            }
        }
        if (observationQuery.resources) {
            for (const type of Object.keys(observationQuery.resources)) {
                for (const id of Object.keys(observationQuery.resources[type])) {
                    await this.#watchResource(context, type, id, observerId, observationQuery.resources[type][id]);
                }
            }
        }

        abortSignal.addEventListener('abort', () => {
            this.#observerInfoes.delete(observerId);

            if (observationQuery.types) {
                for (const type of Object.keys(observationQuery.types)) {
                    if (observationQuery.types[type].adding) {
                        this.#eventObservers.addingResourceTypes.get(type)?.delete(observerId);
                    }
                    if (observationQuery.types[type].updating) {
                        this.#eventObservers.updatingResourceTypes.get(type)?.delete(observerId);
                    }
                }
            }
            if (observationQuery.resources) {
                for (const type of Object.keys(observationQuery.resources)) {
                    for (const id of Object.keys(observationQuery.resources[type])) {
                        this.#unwatchResource(type, id, observerId);
                    }
                }
            }
        });

        return {
            ok: true,
            value: undefined,
        };
    }

    async handleEvent(event: IncomingEvent): Promise<void> {
        const id = crypto.randomUUID();
        const resourceKey = makeResourceKey(event.resourceIdentifier.type, event.resourceIdentifier.id);
        const handledResourceKeysForEvents = new Set<ResourceKey>();
        const observerIdsForNotify = new Set<ObserverId>();
        if (event.type === 'add' || event.type === 'update') {
            const typeObserverIds = this.#eventObservers[eventMap[event.type]].get(event.resourceIdentifier.type);
            if (typeObserverIds) {
                for (const observerId of typeObserverIds) {
                    const observerInfo = this.#observerInfoes.get(observerId);
                    if (observerInfo) {
                        const isAvailable = await this.#resourceInformer.isAvailable(
                            observerInfo.context,
                            event.resourceIdentifier.type,
                            event.resourceIdentifier.id,
                        );
                        if (isAvailable && !handledResourceKeysForEvents.has(resourceKey)) {
                            observerInfo.observationEvents.push({
                                id,
                                type: event.type,
                                resourceIdentifier: event.resourceIdentifier,
                            });
                            handledResourceKeysForEvents.add(resourceKey);
                            observerIdsForNotify.add(observerId);
                        }
                    }
                }
            }
            for (const [observerId, observerInfo] of this.#observerInfoes) {
                const isAvailable = await this.#resourceInformer.isAvailable(
                    observerInfo.context,
                    event.resourceIdentifier.type,
                    event.resourceIdentifier.id,
                );
                if (!isAvailable) {
                    continue;
                }
                const resource = await this.#resourceInformer.get(
                    observerInfo.context,
                    event.resourceIdentifier.type,
                    event.resourceIdentifier.id,
                );
                if (!resource) {
                    continue;
                }
                const relationshipResourceKeySet = await this.#makeRelationshipResourceKeySet(
                    observerInfo.context,
                    resource,
                    Object.keys(resource.relationships),
                );
                for (const relationshipResourceKey of relationshipResourceKeySet) {
                    if (this.#eventObservers.resource.get(relationshipResourceKey)?.get(observerId)?.outer) {
                        if (!handledResourceKeysForEvents.has(resourceKey)) {
                            observerInfo.observationEvents.push({
                                id,
                                type: 'outer-update',
                                resourceIdentifier: event.resourceIdentifier,
                            });
                            handledResourceKeysForEvents.add(resourceKey);
                            observerIdsForNotify.add(observerId);
                        }
                    }
                }
            }
        }
        const resourceObserverIds = this.#eventObservers.resource.get(resourceKey);
        if (resourceObserverIds) {
            for (const [observerId, options] of resourceObserverIds) {
                const observerInfo = this.#observerInfoes.get(observerId);
                if (observerInfo) {
                    if (!handledResourceKeysForEvents.has(resourceKey)) {
                        observerInfo.observationEvents.push({
                            id,
                            type: event.type,
                            resourceIdentifier: event.resourceIdentifier,
                        });
                        handledResourceKeysForEvents.add(resourceKey);
                        observerIdsForNotify.add(observerId);
                    }
                    this.#unwatchResource(event.resourceIdentifier.type, event.resourceIdentifier.id, observerId);
                    this.#watchResource(
                        observerInfo.context,
                        event.resourceIdentifier.type,
                        event.resourceIdentifier.id,
                        observerId,
                        options,
                    );
                }
            }
        }
        const relationshipObserverIds = this.#eventObservers.relationshipLinks.get(resourceKey);
        if (relationshipObserverIds) {
            for (const [observerId] of relationshipObserverIds) {
                const observerInfo = this.#observerInfoes.get(observerId);
                if (observerInfo) {
                    const resourceIdentifier = makeResourceIdentifierByResourceKey(resourceKey);
                    if (!handledResourceKeysForEvents.has(resourceKey)) {
                        observerInfo.observationEvents.push({
                            id,
                            type: event.type,
                            resourceIdentifier,
                        });
                        handledResourceKeysForEvents.add(resourceKey);
                        observerIdsForNotify.add(observerId);
                    }
                }
            }
        }
        for (const observerIdForNotify of observerIdsForNotify) {
            const observerInfo = this.#observerInfoes.get(observerIdForNotify);
            if (observerInfo) {
                observerInfo.callback(observerInfo.observationEvents);
                observerInfo.observationEvents.splice(0, observerInfo.observationEvents.length);
            }
        }
    }
}
