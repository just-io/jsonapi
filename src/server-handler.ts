import { defaultErrorFormatter, ErrorKeeper, ErrorSet, Pointer } from '@just-io/schema';
import { ResourceManager } from './resource-manager';
import {
    CommonQuery,
    DataList,
    MetaProvider,
    OperationQueryRef,
    OperationResourceIdentifier,
    PageProvider,
    Query,
    ResourceIdentifier,
} from './types';
import { CommonError, ErrorFactory } from './errors';
import { FetchResponse, FetchResponseError, Formatter } from './formatter';
import { QueryConverter } from './query-converter';
import {
    CommonEditableResource,
    EditableResource,
    NewResource,
    OperationEditableResource,
    OperationNewResource,
    Resource,
    ResourceDeclaration,
} from './resource-declaration';
import schemas from './schemas';

export type Response = {
    status: number;
    body: FetchResponse | FetchResponseError;
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

    async #handleGet(context: C, query: CommonQuery<P>): Promise<Response> {
        if ('id' in query.ref && 'relationship' in query.ref) {
            const { relationship, included } = await this.#resourceManager.relationship(
                context,
                query as Query<P, ResourceDeclaration, [], 'relationship'>,
            );

            if (relationship === null) {
                return {
                    status: 404,
                    body: this.formatter.formatRelationship(
                        query as Query<P, ResourceDeclaration, [], 'relationship'>,
                        relationship,
                        included,
                    ),
                };
            } else if ('items' in relationship) {
                return {
                    status: 200,
                    body: this.formatter.formatRelationships(
                        query as Query<P, ResourceDeclaration, [], 'relationship'>,
                        relationship,
                        included,
                    ),
                };
            } else {
                return {
                    status: 200,
                    body: this.formatter.formatRelationship(
                        query as Query<P, ResourceDeclaration, [], 'relationship'>,
                        relationship,
                        included,
                    ),
                };
            }
        }

        if ('id' in query.ref) {
            const { resource, included } = await this.#resourceManager.get(
                context,
                query as Query<P, ResourceDeclaration, [], 'id'>,
            );
            if (resource === null) {
                return {
                    status: 404,
                    body: this.formatter.formatResource(
                        query as Query<P, ResourceDeclaration, [], 'id'>,
                        resource,
                        included,
                    ),
                };
            } else {
                return {
                    status: 200,
                    body: this.formatter.formatResource(
                        query as Query<P, ResourceDeclaration, [], 'id'>,
                        resource,
                        included,
                    ),
                };
            }
        }

        const { resources, included } = await this.#resourceManager.list(context, query);

        return {
            status: 200,
            body: this.formatter.formatResources(
                query as Query<P, ResourceDeclaration, [], 'list'>,
                resources,
                included,
            ),
        };
    }

    async #handlePost(context: C, query: CommonQuery<P>, body: unknown): Promise<Response> {
        if ('id' in query.ref && !('relationship' in query.ref)) {
            throw new ErrorSet().add(ErrorFactory.makeQueryError('Should not contain resource id'));
        }
        if (query.ref.type === 'operations') {
            return this.#handleOperations(context, body);
        }
        if ('relationship' in query.ref) {
            const errorKeeper = new ErrorKeeper(new Pointer(''), 'default', defaultErrorFormatter);

            if (!resourceIdentifiersBodySchema.is(body, errorKeeper)) {
                throw errorKeeper.makeErrorSet();
            }
            const { relationship, included } = await this.#resourceManager.addRelationships(
                context,
                query as Query<P, ResourceDeclaration, [], 'relationship'>,
                body.data,
                new Pointer('', 'data'),
            );

            return {
                status: 200,
                body: this.formatter.formatRelationships(
                    query as Query<P, ResourceDeclaration, [], 'relationship'>,
                    relationship as DataList<ResourceIdentifier<string>>,
                    included,
                ),
            };
        } else {
            const errorKeeper = new ErrorKeeper(new Pointer(''), 'default', defaultErrorFormatter);

            if (!newResourceBodySchema.is(body, errorKeeper)) {
                throw errorKeeper.makeErrorSet();
            }
            const { resource, included } = await this.#resourceManager.add(
                context,
                query,
                body.data,
                new Pointer('', 'data'),
            );

            return {
                status: 200,
                body: this.formatter.formatResource(
                    { ref: { ...query.ref, id: resource.id }, params: query.params },
                    resource,
                    included,
                ),
            };
        }
    }

    async #handleOperations(context: C, body: unknown): Promise<Response> {
        const errorKeeper = new ErrorKeeper(new Pointer(''), 'default', defaultErrorFormatter);

        if (!operationsSchema.is(body, errorKeeper)) {
            throw errorKeeper.makeErrorSet();
        }

        const results = await this.#resourceManager.operations(
            context,
            body['atomic:operations'].map((operation) => {
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
        );

        return {
            status: 200,
            body: {
                'atomic:results': results.map((result, i) => {
                    const operation = body['atomic:operations'][i];
                    if (operation.op === 'add' && !('ref' in operation)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const resource = result as Resource<any>;
                        return this.#formatter.formatResource(
                            { ref: { type: operation.data.type, id: resource.id } },
                            resource,
                            [],
                        );
                    }
                    if (operation.op === 'update' && !('ref' in operation)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const resource = result as Resource<any>;
                        return this.#formatter.formatResource(
                            { ref: { type: operation.data.type, id: resource.id } },
                            resource,
                            [],
                        );
                    }
                    if (operation.op === 'remove' && !('data' in operation)) {
                        const id = result as string;
                        return this.#formatter.formatResource({ ref: { type: operation.ref.type, id } }, null, []);
                    }
                    if (operation.op === 'add' && 'data' in operation) {
                        const [id, relationship] = result as [string, DataList<ResourceIdentifier<string>>];
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
                        const [id, relationship] = result as [
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
                        const [id, relationship] = result as [string, DataList<ResourceIdentifier<string>>];
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
        };
    }

    async #handlePatch(context: C, query: CommonQuery<P>, body: unknown): Promise<Response> {
        if (!('id' in query.ref)) {
            throw new ErrorSet().add(ErrorFactory.makeQueryError('Should contain resource id'));
        }
        if ('relationship' in query.ref) {
            const errorKeeper = new ErrorKeeper(new Pointer(''), 'default', defaultErrorFormatter);

            if (!relationshipBodySchema.is(body, errorKeeper)) {
                throw errorKeeper.makeErrorSet();
            }
            const { relationship, included } = await this.#resourceManager.updateRelationship(
                context,
                query as Query<P, ResourceDeclaration, [], 'relationship'>,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                body.data,
                new Pointer('', 'data'),
            );

            return {
                status: 200,
                body: this.formatter.formatRelationships(
                    query as Query<P, ResourceDeclaration, [], 'relationship'>,
                    relationship as DataList<ResourceIdentifier<string>>,
                    included,
                ),
            };
        } else {
            const errorKeeper = new ErrorKeeper(new Pointer(''), 'default', defaultErrorFormatter);

            if (!commonResourceBodySchema.is(body, errorKeeper)) {
                throw errorKeeper.makeErrorSet();
            }
            const { resource, included } = await this.#resourceManager.update(
                context,
                query as Query<P, ResourceDeclaration, [], 'id'>,
                body.data as EditableResource<ResourceDeclaration>,
                new Pointer('', 'data'),
            );

            return {
                status: 200,
                body: this.formatter.formatResource(
                    query as Query<P, ResourceDeclaration, [], 'id'>,
                    resource,
                    included,
                ),
            };
        }
    }

    async #handleDelete(context: C, query: CommonQuery<P>, body: unknown): Promise<Response> {
        if (!('id' in query.ref)) {
            throw new ErrorSet().add(ErrorFactory.makeQueryError('Should contain resource id'));
        }
        if ('relationship' in query.ref) {
            const errorKeeper = new ErrorKeeper(new Pointer(''), 'default', defaultErrorFormatter);

            if (!resourceIdentifiersBodySchema.is(body, errorKeeper)) {
                throw errorKeeper.makeErrorSet();
            }
            const { relationship, included } = await this.#resourceManager.removeRelationships(
                context,
                query as Query<P, ResourceDeclaration, [], 'relationship'>,
                body.data,
                new Pointer('', 'data'),
            );

            return {
                status: 200,
                body: this.formatter.formatRelationships(
                    query as Query<P, ResourceDeclaration, [], 'relationship'>,
                    relationship as DataList<ResourceIdentifier<string>>,
                    included,
                ),
            };
        } else {
            await this.#resourceManager.remove(
                context,
                query as Query<P, ResourceDeclaration, [], 'id'>,
                new Pointer('', 'data'),
            );

            return {
                status: 200,
                body: this.formatter.formatResource(query as Query<P, ResourceDeclaration, [], 'id'>, null, []),
            };
        }
    }

    async handle(
        context: C,
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | string,
        url: string,
        body: unknown,
    ): Promise<Response> {
        let query: CommonQuery<P>;
        try {
            query = this.queryConverter.parse(url);
            if (method.toUpperCase() === 'GET') {
                return await this.#handleGet(context, query);
            } else if (method.toUpperCase() === 'POST') {
                return await this.#handlePost(context, query, body);
            } else if (method.toUpperCase() === 'PATCH') {
                return await this.#handlePatch(context, query, body);
            } else if (method.toUpperCase() === 'DELETE') {
                return await this.#handleDelete(context, query, body);
            }
            throw new ErrorSet().add(ErrorFactory.makeInvalidMethodError(method));
        } catch (err) {
            if (err instanceof ErrorSet) {
                return {
                    status: (err as ErrorSet<CommonError>).errors[0].status ?? 422,
                    body: err.toJSON(),
                };
            }
            return {
                status: 500,
                body: { errors: [ErrorFactory.makeInternalError()] },
            };
        }
    }
}
