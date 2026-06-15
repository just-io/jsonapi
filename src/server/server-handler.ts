import { ErrorSet, Pointer, schemas } from '@just-io/schema';
import { EventMap, ResourceManager } from './resource-manager';
import {
    CommonQuery,
    DataList,
    OperationQueryRef,
    OperationResourceIdentifier,
    Query,
    ResourceIdentifier,
} from '../types/common';
import { ErrorFactory } from './errors';
import { Formatter } from './formatter';
import { QueryConverter } from './query-converter';
import {
    CommonEditableResource,
    EditableResource,
    NewResource,
    OperationEditableResource,
    OperationNewResource,
    Resource,
    ResourceDeclaration,
} from '../types/resource-declaration';
import { EventStore } from '@just-io/utils';
import { CommonError, FetchResponse, FetchResponseError } from '../types/formats';
import { defaultErrorFormatter, ErrorFormatter } from './error-formatter';
import { MetaProvider, PageProvider } from './types';

export type Response<C, P, M> = {
    status: number;
    body: FetchResponse<M> | FetchResponseError;
    eventStore: EventStore<EventMap<C, P>>;
};

const relationshipSchema = schemas.union<ResourceIdentifier<string> | ResourceIdentifier<string>[] | null>(
    schemas.array(
        schemas.structure({
            id: schemas.string(),
            type: schemas.string(),
        }),
    ),
    schemas.structure({
        id: schemas.string(),
        type: schemas.string(),
    }),
    schemas.null(),
);

type NewResourceBody = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: NewResource<any>;
};

const newResourceBodySchema = schemas.structure<NewResourceBody>({
    data: schemas.structure({
        id: schemas.optional(schemas.string()),
        type: schemas.string(),
        attributes: schemas.record(schemas.any()),
        relationships: schemas.record(relationshipSchema),
    }),
});

type CommonResourceBody = {
    data: CommonEditableResource;
};

const commonResourceBodySchema = schemas.structure<CommonResourceBody>({
    data: schemas.structure({
        id: schemas.string(),
        type: schemas.string(),
        attributes: schemas.record(schemas.any()),
        relationships: schemas.record(relationshipSchema),
    }),
});

type ResourceIdentifiersBody = {
    data: ResourceIdentifier<string>[];
};

const resourceIdentifiersBodySchema = schemas.structure<ResourceIdentifiersBody>({
    data: schemas.array(
        schemas.structure({
            id: schemas.string(),
            type: schemas.string(),
        }),
    ),
});

type RelationshipBody = {
    data: ResourceIdentifier<string> | ResourceIdentifier<string>[] | null;
};

const relationshipBodySchema = schemas.structure<RelationshipBody>({
    data: schemas.union<RelationshipBody['data']>(
        schemas.array(
            schemas.structure({
                id: schemas.string(),
                type: schemas.string(),
            }),
        ),
        schemas.structure({
            id: schemas.string(),
            type: schemas.string(),
        }),
        schemas.null(),
    ),
});

type AddResourceOperation = {
    op: 'add';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: OperationNewResource<any>;
};

type UpdateResourceOperation = {
    op: 'update';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: OperationEditableResource<any>;
};

type RemoveResourceOperation = {
    op: 'remove';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref: OperationQueryRef<any, 'id'>;
};

type AddRelationshipsOperation = {
    op: 'add';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref: OperationQueryRef<any, 'relationship'>;
    data: OperationResourceIdentifier<string>[];
};

type UpdateRelationshipsOperation = {
    op: 'update';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref: OperationQueryRef<any, 'relationship'>;
    data: OperationResourceIdentifier<string> | OperationResourceIdentifier<string>[] | null;
};

type RemoveRelationshipsOperation = {
    op: 'remove';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref: OperationQueryRef<any, 'relationship'>;
    data: OperationResourceIdentifier<string>[];
};

type OperationsBody = {
    'atomic:operations': (
        | AddResourceOperation
        | UpdateResourceOperation
        | RemoveResourceOperation
        | AddRelationshipsOperation
        | UpdateRelationshipsOperation
        | RemoveRelationshipsOperation
    )[];
};

const operationRelationshipSchema = schemas.union<
    OperationResourceIdentifier<string> | OperationResourceIdentifier<string>[] | null
>(
    schemas.array(
        schemas.union<OperationResourceIdentifier<string>>(
            schemas.structure({
                id: schemas.string(),
                type: schemas.string(),
            }),
            schemas.structure({
                lid: schemas.string(),
                type: schemas.string(),
            }),
        ),
    ),
    schemas.structure({
        id: schemas.string(),
        type: schemas.string(),
    }),
    schemas.structure({
        lid: schemas.string(),
        type: schemas.string(),
    }),
    schemas.null(),
);

const operationsSchema = schemas.structure<OperationsBody>({
    'atomic:operations': schemas.array(
        schemas.union<OperationsBody['atomic:operations'][number]>(
            schemas.structure({
                op: schemas.string<'add'>(['add']),
                data: schemas.union(
                    schemas.structure<AddResourceOperation['data']>({
                        id: schemas.optional(schemas.string()),
                        type: schemas.string(),
                        attributes: schemas.record(schemas.any()),
                        relationships: schemas.record(operationRelationshipSchema),
                    }),
                    schemas.structure<AddResourceOperation['data']>({
                        lid: schemas.optional(schemas.string()),
                        type: schemas.string(),
                        attributes: schemas.record(schemas.any()),
                        relationships: schemas.record(operationRelationshipSchema),
                    }),
                ),
            }),
            schemas.structure({
                op: schemas.string<'update'>(['update']),
                data: schemas.union(
                    schemas.structure<UpdateResourceOperation['data']>({
                        id: schemas.string(),
                        type: schemas.string(),
                        attributes: schemas.record(schemas.any()),
                        relationships: schemas.record(operationRelationshipSchema),
                    }),
                    schemas.structure<UpdateResourceOperation['data']>({
                        lid: schemas.string(),
                        type: schemas.string(),
                        attributes: schemas.record(schemas.any()),
                        relationships: schemas.record(operationRelationshipSchema),
                    }),
                ),
            }),
            schemas.structure({
                op: schemas.string<'remove'>(['remove']),
                ref: schemas.union<RemoveResourceOperation['ref']>(
                    schemas.structure({
                        id: schemas.string(),
                        type: schemas.string(),
                    }),
                    schemas.structure({
                        lid: schemas.string(),
                        type: schemas.string(),
                    }),
                ),
            }),
            schemas.structure({
                op: schemas.string<'add'>(['add']),
                ref: schemas.union<AddRelationshipsOperation['ref']>(
                    schemas.structure({
                        id: schemas.string(),
                        type: schemas.string(),
                        relationship: schemas.string(),
                    }),
                    schemas.structure({
                        lid: schemas.string(),
                        type: schemas.string(),
                        relationship: schemas.string(),
                    }),
                ),
                data: schemas.array(
                    schemas.structure({
                        id: schemas.string(),
                        type: schemas.string(),
                    }),
                ),
            }),
            schemas.structure({
                op: schemas.string<'update'>(['update']),
                ref: schemas.union<UpdateRelationshipsOperation['ref']>(
                    schemas.structure({
                        id: schemas.string(),
                        type: schemas.string(),
                        relationship: schemas.string(),
                    }),
                    schemas.structure({
                        lid: schemas.string(),
                        type: schemas.string(),
                        relationship: schemas.string(),
                    }),
                ),
                data: operationRelationshipSchema,
            }),
            schemas.structure({
                op: schemas.string<'remove'>(['remove']),
                ref: schemas.union<RemoveRelationshipsOperation['ref']>(
                    schemas.structure({
                        id: schemas.string(),
                        type: schemas.string(),
                        relationship: schemas.string(),
                    }),
                    schemas.structure({
                        lid: schemas.string(),
                        type: schemas.string(),
                        relationship: schemas.string(),
                    }),
                ),
                data: schemas.array(
                    schemas.structure({
                        id: schemas.string(),
                        type: schemas.string(),
                    }),
                ),
            }),
        ),
    ),
});

export class ServerHandler<C, P, M> {
    #resourceManager: ResourceManager<C, P>;

    #domain = '';

    #prefix = '';

    #pageProvider: PageProvider<P>;

    #metaProvider: MetaProvider<M>;

    #queryConverter: QueryConverter<P>;

    #formatter: Formatter<P, M>;

    constructor(resourceManager: ResourceManager<C, P>, pageProvider: PageProvider<P>, metaProvider: MetaProvider<M>) {
        this.#resourceManager = resourceManager;
        this.#metaProvider = metaProvider;
        this.#pageProvider = pageProvider;
        this.#queryConverter = new QueryConverter<P>(this.#pageProvider);
        this.#formatter = new Formatter<P, M>(this.#pageProvider, this.#metaProvider, this.#queryConverter);
    }

    get metaProvider(): MetaProvider<M> {
        return this.#metaProvider;
    }

    get queryConverter(): QueryConverter<P> {
        return this.#queryConverter;
    }

    get formatter(): Formatter<P, M> {
        return this.#formatter;
    }

    setPrefix(prefix: string): this {
        this.#prefix = prefix;
        this.#queryConverter.setPrefix(this.#prefix);
        return this;
    }

    setDomain(domain: string): this {
        this.#domain = domain;
        this.#queryConverter.setDomain(this.#domain);
        return this;
    }

    async #handleGet(context: C, query: CommonQuery<P>, errorFormatter: ErrorFormatter): Promise<Response<C, P, M>> {
        if ('id' in query.ref && 'relationship' in query.ref) {
            const { result, eventStore } = await this.#resourceManager.relationship(
                context,
                query as Query<P, ResourceDeclaration, [], 'relationship'>,
                errorFormatter,
            );

            if (!result.ok) {
                return {
                    status: result.error.errors[0].status ?? 422,
                    body: {
                        errors: result.error.toJSON(),
                    },
                    eventStore,
                };
            }

            const { relationship, included } = result.value;

            if (relationship === null) {
                return {
                    status: 200,
                    body: this.formatter.formatRelationship(
                        query as Query<P, ResourceDeclaration, [], 'relationship'>,
                        relationship,
                        included,
                    ),
                    eventStore,
                };
            } else if ('items' in relationship) {
                return {
                    status: 200,
                    body: this.formatter.formatRelationships(
                        query as Query<P, ResourceDeclaration, [], 'relationship'>,
                        relationship,
                        included,
                    ),
                    eventStore,
                };
            } else {
                return {
                    status: 200,
                    body: this.formatter.formatRelationship(
                        query as Query<P, ResourceDeclaration, [], 'relationship'>,
                        relationship,
                        included,
                    ),
                    eventStore,
                };
            }
        }

        if ('id' in query.ref) {
            const { result, eventStore } = await this.#resourceManager.get(
                context,
                query as Query<P, ResourceDeclaration, [], 'id'>,
                errorFormatter,
            );

            if (!result.ok) {
                return {
                    status: result.error.errors[0].status ?? 422,
                    body: {
                        errors: result.error.toJSON(),
                    },
                    eventStore,
                };
            }

            const { resource, included } = result.value;

            return {
                status: resource === null ? 404 : 200,
                body: this.formatter.formatResource(
                    query as Query<P, ResourceDeclaration, [], 'id'>,
                    resource,
                    included,
                ),
                eventStore,
            };
        }

        const { result, eventStore } = await this.#resourceManager.list(context, query, errorFormatter);

        if (!result.ok) {
            return {
                status: result.error.errors[0].status ?? 422,
                body: {
                    errors: result.error.toJSON(),
                },
                eventStore,
            };
        }

        const { resources, included } = result.value;

        return {
            status: 200,
            body: this.formatter.formatResources(
                query as Query<P, ResourceDeclaration, [], 'list'>,
                resources,
                included,
            ),
            eventStore,
        };
    }

    async #handlePost(
        context: C,
        query: CommonQuery<P>,
        body: unknown,
        errorFormatter: ErrorFormatter,
    ): Promise<Response<C, P, M>> {
        if ('id' in query.ref && !('relationship' in query.ref)) {
            throw new ErrorSet().add(ErrorFactory.makeQueryError(errorFormatter.query.invalidId()));
        }
        if (query.ref.type === 'operations') {
            return this.#handleOperations(context, body, errorFormatter);
        }
        if ('relationship' in query.ref) {
            const validateResult = resourceIdentifiersBodySchema.validate(
                body,
                new Pointer(''),
                errorFormatter.schema,
                true,
            );
            if (!validateResult.ok) {
                throw new ErrorSet(
                    validateResult.error.errors.map((error) =>
                        ErrorFactory.makeFieldErrorByValidationError(errorFormatter, error),
                    ),
                );
            }

            const { result, eventStore } = await this.#resourceManager.addRelationships(
                context,
                query as Query<P, ResourceDeclaration, [], 'relationship'>,
                validateResult.value.data,
                new Pointer('', 'data'),
                errorFormatter,
            );

            if (!result.ok) {
                return {
                    status: result.error.errors[0].status ?? 422,
                    body: {
                        errors: result.error.toJSON(),
                    },
                    eventStore,
                };
            }

            const { relationship, included } = result.value;

            return {
                status: 200,
                body: this.formatter.formatRelationships(
                    query as Query<P, ResourceDeclaration, [], 'relationship'>,
                    relationship as DataList<ResourceIdentifier<string>>,
                    included,
                ),
                eventStore,
            };
        } else {
            const validateResult = newResourceBodySchema.validate(body, new Pointer(''), errorFormatter.schema, true);
            if (!validateResult.ok) {
                throw new ErrorSet(
                    validateResult.error.errors.map((error) =>
                        ErrorFactory.makeFieldErrorByValidationError(errorFormatter, error),
                    ),
                );
            }

            const { result, eventStore } = await this.#resourceManager.add(
                context,
                query,
                validateResult.value.data,
                new Pointer('', 'data'),
                errorFormatter,
            );

            if (!result.ok) {
                return {
                    status: result.error.errors[0].status ?? 422,
                    body: {
                        errors: result.error.toJSON(),
                    },
                    eventStore,
                };
            }

            const { resource, included } = result.value;

            return {
                status: 201,
                body: this.formatter.formatResource(
                    { ref: { ...query.ref, id: resource.id }, params: query.params },
                    resource,
                    included,
                ),
                eventStore,
            };
        }
    }

    async #handleOperations(context: C, body: unknown, errorFormatter: ErrorFormatter): Promise<Response<C, P, M>> {
        const validateResult = operationsSchema.validate(body, new Pointer(''), errorFormatter.schema, true);
        if (!validateResult.ok) {
            throw new ErrorSet(
                validateResult.error.errors.map((error) =>
                    ErrorFactory.makeFieldErrorByValidationError(errorFormatter, error),
                ),
            );
        }

        const { result, eventStore } = await this.#resourceManager.operations(
            context,
            validateResult.value['atomic:operations'].map((operation) => {
                if (operation.op === 'add' && !('ref' in operation)) {
                    return {
                        op: 'add',
                        data: operation.data,
                    };
                }
                if (operation.op === 'update' && !('ref' in operation)) {
                    return {
                        op: 'update',
                        data: operation.data,
                    };
                }
                if (operation.op === 'remove' && !('data' in operation)) {
                    return {
                        op: 'remove',
                        ref: operation.ref,
                    };
                }
                if (operation.op === 'add' && 'data' in operation) {
                    return {
                        op: 'add-relationships',
                        ref: operation.ref,
                        data: operation.data,
                    };
                }
                if (operation.op === 'update' && 'ref' in operation) {
                    return {
                        op: 'update-relationships',
                        ref: operation.ref,
                        data: operation.data,
                    };
                }
                if (operation.op === 'remove' && 'data' in operation) {
                    return {
                        op: 'remove-relationships',
                        ref: operation.ref,
                        data: operation.data,
                    };
                }
                throw new Error('Invalid');
            }),
            new Pointer('', 'atomic:operations'),
            errorFormatter,
        );

        if (!result.ok) {
            return {
                status: result.error.errors[0].status ?? 422,
                body: {
                    errors: result.error.toJSON(),
                },
                eventStore,
            };
        }

        return {
            status: 200,
            body: {
                'atomic:results': result.value.map((value, i) => {
                    const operation = validateResult.value['atomic:operations'][i];
                    if (operation.op === 'add' && !('ref' in operation)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const resource = value as Resource<any>;
                        return this.#formatter.formatResource(
                            { ref: { type: operation.data.type, id: resource.id } },
                            resource,
                            [],
                        );
                    }
                    if (operation.op === 'update' && !('ref' in operation)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const resource = value as Resource<any>;
                        return this.#formatter.formatResource(
                            { ref: { type: operation.data.type, id: resource.id } },
                            resource,
                            [],
                        );
                    }
                    if (operation.op === 'remove' && !('data' in operation)) {
                        const id = value as string;
                        return this.#formatter.formatResource({ ref: { type: operation.ref.type, id } }, null, []);
                    }
                    if (operation.op === 'add' && 'data' in operation) {
                        const [id, relationship] = value as [string, DataList<ResourceIdentifier<string>>];
                        return this.formatter.formatRelationships(
                            {
                                ref: {
                                    type: operation.ref.type,
                                    id,
                                    relationship: operation.ref.relationship as string,
                                },
                            },
                            relationship,
                            [],
                        );
                    }
                    if (operation.op === 'update' && 'ref' in operation) {
                        const [id, relationship] = value as [
                            string,
                            DataList<ResourceIdentifier<string>> | ResourceIdentifier<string> | null,
                        ];
                        if (relationship === null) {
                            return this.formatter.formatRelationship(
                                {
                                    ref: {
                                        type: operation.ref.type,
                                        id,
                                        relationship: operation.ref.relationship as string,
                                    },
                                },
                                relationship,
                                [],
                            );
                        } else if ('items' in relationship) {
                            return this.formatter.formatRelationships(
                                {
                                    ref: {
                                        type: operation.ref.type,
                                        id,
                                        relationship: operation.ref.relationship as string,
                                    },
                                },
                                relationship,
                                [],
                            );
                        } else {
                            return this.formatter.formatRelationship(
                                {
                                    ref: {
                                        type: operation.ref.type,
                                        id,
                                        relationship: operation.ref.relationship as string,
                                    },
                                },
                                relationship,
                                [],
                            );
                        }
                    }
                    if (operation.op === 'remove' && 'data' in operation) {
                        const [id, relationship] = value as [string, DataList<ResourceIdentifier<string>>];
                        return this.formatter.formatRelationships(
                            {
                                ref: {
                                    type: operation.ref.type,
                                    id,
                                    relationship: operation.ref.relationship as string,
                                },
                            },
                            relationship,
                            [],
                        );
                    }
                    throw new Error('Invalid');
                }),
            },
            eventStore,
        };
    }

    async #handlePatch(
        context: C,
        query: CommonQuery<P>,
        body: unknown,
        errorFormatter: ErrorFormatter,
    ): Promise<Response<C, P, M>> {
        if (!('id' in query.ref)) {
            throw new ErrorSet().add(ErrorFactory.makeQueryError(errorFormatter.query.invalidId()));
        }
        if ('relationship' in query.ref) {
            const validateResult = relationshipBodySchema.validate(body, new Pointer(''), errorFormatter.schema, true);
            if (!validateResult.ok) {
                throw new ErrorSet(
                    validateResult.error.errors.map((error) =>
                        ErrorFactory.makeFieldErrorByValidationError(errorFormatter, error),
                    ),
                );
            }
            const { result, eventStore } = await this.#resourceManager.updateRelationship(
                context,
                query as Query<P, ResourceDeclaration, [], 'relationship'>,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                validateResult.value.data,
                new Pointer('', 'data'),
                errorFormatter,
            );

            if (!result.ok) {
                return {
                    status: result.error.errors[0].status ?? 422,
                    body: {
                        errors: result.error.toJSON(),
                    },
                    eventStore,
                };
            }

            const { relationship, included } = result.value;

            if ('items' in relationship) {
                return {
                    status: 200,
                    body: this.formatter.formatRelationships(
                        query as Query<P, ResourceDeclaration, [], 'relationship'>,
                        relationship,
                        included,
                    ),
                    eventStore,
                };
            }

            return {
                status: 200,
                body: this.formatter.formatRelationship(
                    query as Query<P, ResourceDeclaration, [], 'relationship'>,
                    relationship,
                    included,
                ),
                eventStore,
            };
        } else {
            const validateResult = commonResourceBodySchema.validate(
                body,
                new Pointer(''),
                errorFormatter.schema,
                true,
            );
            if (!validateResult.ok) {
                throw new ErrorSet(
                    validateResult.error.errors.map((error) =>
                        ErrorFactory.makeFieldErrorByValidationError(errorFormatter, error),
                    ),
                );
            }
            const { result, eventStore } = await this.#resourceManager.update(
                context,
                query as Query<P, ResourceDeclaration, [], 'id'>,
                validateResult.value.data as EditableResource<ResourceDeclaration>,
                new Pointer('', 'data'),
                errorFormatter,
            );

            if (!result.ok) {
                return {
                    status: result.error.errors[0].status ?? 422,
                    body: {
                        errors: result.error.toJSON(),
                    },
                    eventStore,
                };
            }

            const { resource, included } = result.value;

            return {
                status: 200,
                body: this.formatter.formatResource(
                    query as Query<P, ResourceDeclaration, [], 'id'>,
                    resource,
                    included,
                ),
                eventStore,
            };
        }
    }

    async #handleDelete(
        context: C,
        query: CommonQuery<P>,
        body: unknown,
        errorFormatter: ErrorFormatter,
    ): Promise<Response<C, P, M>> {
        if (!('id' in query.ref)) {
            throw new ErrorSet().add(ErrorFactory.makeQueryError(errorFormatter.query.invalidId()));
        }
        if ('relationship' in query.ref) {
            const validateResult = resourceIdentifiersBodySchema.validate(
                body,
                new Pointer(''),
                errorFormatter.schema,
                true,
            );
            if (!validateResult.ok) {
                throw new ErrorSet(
                    validateResult.error.errors.map((error) =>
                        ErrorFactory.makeFieldErrorByValidationError(errorFormatter, error),
                    ),
                );
            }
            const { result, eventStore } = await this.#resourceManager.removeRelationships(
                context,
                query as Query<P, ResourceDeclaration, [], 'relationship'>,
                validateResult.value.data,
                new Pointer('', 'data'),
                errorFormatter,
            );

            if (!result.ok) {
                return {
                    status: result.error.errors[0].status ?? 422,
                    body: {
                        errors: result.error.toJSON(),
                    },
                    eventStore,
                };
            }

            const { relationship, included } = result.value;

            return {
                status: 200,
                body: this.formatter.formatRelationships(
                    query as Query<P, ResourceDeclaration, [], 'relationship'>,
                    relationship as DataList<ResourceIdentifier<string>>,
                    included,
                ),
                eventStore,
            };
        } else {
            const { result, eventStore } = await this.#resourceManager.remove(
                context,
                query as Query<P, ResourceDeclaration, [], 'id'>,
                new Pointer('', 'data'),
                errorFormatter,
            );

            if (!result.ok) {
                return {
                    status: result.error.errors[0].status ?? 422,
                    body: {
                        errors: result.error.toJSON(),
                    },
                    eventStore,
                };
            }

            return {
                status: 200,
                body: this.formatter.formatResource(query as Query<P, ResourceDeclaration, [], 'id'>, null, []),
                eventStore,
            };
        }
    }

    async handle(
        context: C,
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | string,
        url: string,
        body: unknown,
        errorFormatter: ErrorFormatter = defaultErrorFormatter,
    ): Promise<Response<C, P, M>> {
        try {
            const result = this.queryConverter.parse(url, errorFormatter);
            if (!result.ok) {
                throw result.error;
            }
            if (method.toUpperCase() === 'GET') {
                return await this.#handleGet(context, result.value, errorFormatter);
            } else if (method.toUpperCase() === 'POST') {
                return await this.#handlePost(context, result.value, body, errorFormatter);
            } else if (method.toUpperCase() === 'PATCH') {
                return await this.#handlePatch(context, result.value, body, errorFormatter);
            } else if (method.toUpperCase() === 'DELETE') {
                return await this.#handleDelete(context, result.value, body, errorFormatter);
            }
            throw new ErrorSet().add(ErrorFactory.makeInvalidMethodError(errorFormatter, method));
        } catch (err) {
            if (err instanceof ErrorSet) {
                return {
                    status: (err as ErrorSet<CommonError>).errors[0].status ?? 422,
                    body: {
                        errors: err.toJSON(),
                    },
                    eventStore: this.#resourceManager.makeStore(),
                };
            }
            return {
                status: 500,
                body: { errors: [ErrorFactory.makeInternalError(errorFormatter)] },
                eventStore: this.#resourceManager.makeStore(),
            };
        }
    }
}
