import { ErrorSet, Pointer, schemas } from '@just-io/schema';
import { DataList, Query, ResourceIdentifier } from '../types/common';
import {
    CommonResource,
    EditableResource,
    NewResource,
    Resource,
    ResourceDeclaration,
} from '../types/resource-declaration';
import { ResourceManager } from './resource-manager';
import { IncomingEvent, ResourceInformer } from './resource-observer';
import { CommonError } from '../types/formats';
import { ObservationQuery } from '../types/observer';
import { ErrorFormatter } from './error-formatter';

export function makeResourceInformer<C, P>(
    resourceManager: ResourceManager<C, P>,
    makePage: (offset: number, limit: number) => P,
    errorFormatter: ErrorFormatter,
    limit = 100,
): ResourceInformer<C> {
    return {
        checkObservationQuery(observationQuery: ObservationQuery): ErrorSet<CommonError> {
            return resourceManager.checker.checkObservationQuery(new Pointer(''), observationQuery, errorFormatter);
        },
        async get(context, type, id): Promise<Resource<ResourceDeclaration> | null> {
            const { result } = await resourceManager.get(context, { ref: { type, id } }, errorFormatter);
            if (result.ok && result.value) {
                return result.value.resource;
            }
            return null;
        },
        async relationship(context, type, id, relationship, offset): Promise<DataList<ResourceIdentifier<string>>> {
            const { result } = await resourceManager.relationship(
                context,
                {
                    ref: { type, id, relationship },
                    params: { page: makePage(offset, limit) },
                },
                errorFormatter,
            );
            if (result.ok && result.value && 'items' in result.value.relationship) {
                return result.value.relationship;
            }
            return {
                items: [],
                limit,
                offset: 0,
                total: 0,
            };
        },
        async isAvailable(context, type, id): Promise<boolean> {
            const status = await resourceManager.status(context, type, id, errorFormatter);

            return status.type === 'exist';
        },
    };
}

export function connectToResourceManager<C, P>(
    resourceManager: ResourceManager<C, P>,
    handleEvent: (event: IncomingEvent) => void,
): () => void {
    const handleAdd = (
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'list'>,
        newResource: NewResource<ResourceDeclaration> | undefined,
        resource: CommonResource,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        included: CommonResource[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        origin: 'api' | 'outer',
    ): void => {
        handleEvent({
            type: 'add',
            resourceIdentifier: {
                type: resource.type,
                id: resource.id,
            },
        });
    };
    const handleUpdate = (
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'list'>,
        editableResource: EditableResource<ResourceDeclaration> | undefined,
        resource: CommonResource,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        included: CommonResource[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        origin: 'api' | 'outer',
    ): void => {
        handleEvent({
            type: 'update',
            resourceIdentifier: {
                type: resource.type,
                id: resource.id,
            },
        });
    };
    const handleRemove = (context: C, query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'id'>): void => {
        handleEvent({
            type: 'remove',
            resourceIdentifier: {
                type: query.ref.type,
                id: query.ref.id,
            },
        });
    };
    const handleChangeRelationship = (
        context: C,
        query: Query<P, ResourceDeclaration, ResourceDeclaration[], 'relationship'>,
    ): void => {
        handleEvent({
            type: 'update',
            resourceIdentifier: {
                type: query.ref.type,
                id: query.ref.id,
            },
        });
    };

    resourceManager.on('add', handleAdd);
    resourceManager.on('update', handleUpdate);
    resourceManager.on('remove', handleRemove);
    resourceManager.on('add-relationship', handleChangeRelationship);
    resourceManager.on('update-relationship', handleChangeRelationship);
    resourceManager.on('remove-relationship', handleChangeRelationship);

    return () => {
        resourceManager.off('add', handleAdd);
        resourceManager.off('update', handleUpdate);
        resourceManager.off('remove', handleRemove);
        resourceManager.off('add-relationship', handleChangeRelationship);
        resourceManager.off('update-relationship', handleChangeRelationship);
        resourceManager.off('remove-relationship', handleChangeRelationship);
    };
}

export const observationQuerySchema = schemas.structure<ObservationQuery>({
    resources: schemas.optional(
        schemas.record(
            schemas.record(
                schemas.structure({
                    outer: schemas.optional(schemas.boolean()),
                    relationships: schemas.optional(schemas.record(schemas.boolean())),
                }),
            ),
        ),
    ),
    types: schemas.optional(
        schemas.record(
            schemas.structure({
                adding: schemas.optional(schemas.boolean()),
                updating: schemas.optional(schemas.boolean()),
            }),
        ),
    ),
});
