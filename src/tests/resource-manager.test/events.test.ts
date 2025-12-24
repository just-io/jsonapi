import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Context, makeResourceManager, NoteDeclaration, TagDeclaration } from '../prepare';
import { DataList, Operation, OperationResults, Query, ResourceIdentifier } from '../../types';
import { DefaultPage } from '../../defaults';
import { ResourceDeclaration, CommonResource, NewResource, EditableResource } from '../../resource-declaration';
import { ErrorContext } from '../../resource-manager';
import { ErrorSet } from '@just-io/schema';
import { CommonError } from '../../errors';
import { operation } from '../../operation';

describe('ResourceManager', () => {
    describe('events', () => {
        test('should call error event', async () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            function handleError(
                ctx: Context,
                errorContext: ErrorContext<DefaultPage>,
                error: ErrorSet<CommonError>,
            ): void {
                assert.deepStrictEqual(ctx, {
                    role: 'user',
                    userId: '11',
                });
                assert.deepStrictEqual(errorContext, {
                    method: 'get',
                    query: {
                        ref: { type: 'passwords', id: '1' },
                    },
                });
                assert.ok(error instanceof ErrorSet);
                assert.deepStrictEqual(error.toJSON(), {
                    errors: [
                        {
                            detail: "The resource with type 'passwords' is not existed.",
                            source: {
                                parameter: 'query',
                            },
                            status: 404,
                            title: 'Invalid Resource Type',
                        },
                    ],
                });
            }

            resourceManager.on('error', handleError);

            assert.rejects(() => resourceManager.get(context, { ref: { type: 'passwords', id: '1' } }));
        });

        test('should call get event', async () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            function handleGet(
                ctx: Context,
                query: Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'id'>,
                resource: CommonResource | null,
                included: CommonResource[],
            ): void {
                assert.deepStrictEqual(ctx, {
                    role: 'user',
                    userId: '11',
                });
                assert.deepStrictEqual(query, {
                    ref: { type: 'notes', id: '12' },
                    params: { include: [['author']] },
                });
                assert.deepStrictEqual(resource, {
                    id: '12',
                    type: 'notes',
                    attributes: {
                        title: 'First Note',
                        text: 'This is the big note',
                        created_at: 0,
                        links: ['g.com'],
                    },
                    relationships: {
                        author: {
                            type: 'users',
                            id: '11',
                        },
                        tags: {
                            items: [
                                {
                                    id: '23',
                                    type: 'tags',
                                },
                                {
                                    id: '24',
                                    type: 'tags',
                                },
                                {
                                    id: '26',
                                    type: 'tags',
                                },
                            ],
                            limit: 4,
                            offset: 0,
                            total: 3,
                        },
                    },
                });
                assert.deepStrictEqual(included, [
                    {
                        id: '11',
                        type: 'users',
                        attributes: {
                            login: 'first',
                        },
                        relationships: {
                            notes: {
                                items: [
                                    {
                                        id: '12',
                                        type: 'notes',
                                    },
                                    {
                                        id: '13',
                                        type: 'notes',
                                    },
                                ],
                                limit: 4,
                                offset: 0,
                                total: 2,
                            },
                        },
                    },
                ]);
            }

            resourceManager.on('get', handleGet);

            await resourceManager.get(context, { ref: { type: 'notes', id: '12' }, params: { include: [['author']] } });
        });

        test('should call list event', async () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            function handleList(
                ctx: Context,
                query: Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'list'>,
                resources: DataList<CommonResource>,
                included: CommonResource[],
            ): void {
                assert.deepStrictEqual(ctx, {
                    role: 'user',
                    userId: '11',
                });
                assert.deepStrictEqual(query, {
                    ref: { type: 'notes' },
                    params: { include: [['author']] },
                });
                assert.deepStrictEqual(resources, {
                    items: [
                        {
                            id: '12',
                            type: 'notes',
                            attributes: {
                                title: 'First Note',
                                text: 'This is the big note',
                                created_at: 0,
                                links: ['g.com'],
                            },
                            relationships: {
                                author: {
                                    id: '11',
                                    type: 'users',
                                },
                                tags: {
                                    items: [
                                        {
                                            id: '23',
                                            type: 'tags',
                                        },
                                        {
                                            id: '24',
                                            type: 'tags',
                                        },
                                        {
                                            id: '26',
                                            type: 'tags',
                                        },
                                    ],
                                    limit: 4,
                                    offset: 0,
                                    total: 3,
                                },
                            },
                        },
                        {
                            id: '13',
                            type: 'notes',
                            attributes: {
                                title: 'Second Note',
                                text: 'This is the small note',
                                created_at: 10,
                                links: [],
                            },
                            relationships: {
                                author: {
                                    id: '11',
                                    type: 'users',
                                },
                                tags: {
                                    items: [
                                        {
                                            id: '25',
                                            type: 'tags',
                                        },
                                    ],
                                    limit: 4,
                                    offset: 0,
                                    total: 1,
                                },
                            },
                        },
                    ],
                    limit: 10,
                    offset: 0,
                    total: 2,
                });
                assert.deepStrictEqual(included, [
                    {
                        id: '11',
                        type: 'users',
                        attributes: {
                            login: 'first',
                        },
                        relationships: {
                            notes: {
                                items: [
                                    {
                                        id: '12',
                                        type: 'notes',
                                    },
                                    {
                                        id: '13',
                                        type: 'notes',
                                    },
                                ],
                                limit: 4,
                                offset: 0,
                                total: 2,
                            },
                        },
                    },
                ]);
            }

            resourceManager.on('list', handleList);

            await resourceManager.list(context, { ref: { type: 'notes' }, params: { include: [['author']] } });
        });

        test('should call relationship event', async () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            function handleRelationship(
                ctx: Context,
                query: Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'relationship'>,
                resources: ResourceIdentifier<string> | DataList<ResourceIdentifier<string>> | null,
                included: CommonResource[],
            ): void {
                assert.deepStrictEqual(ctx, {
                    role: 'user',
                    userId: '11',
                });
                assert.deepStrictEqual(query, {
                    ref: {
                        type: 'notes',
                        id: '12',
                        relationship: 'tags',
                    },
                });
                assert.deepStrictEqual(resources, {
                    items: [
                        {
                            id: '23',
                            type: 'tags',
                        },
                        {
                            id: '24',
                            type: 'tags',
                        },
                        {
                            id: '26',
                            type: 'tags',
                        },
                    ],
                    limit: 4,
                    offset: 0,
                    total: 3,
                });
                assert.deepStrictEqual(included, []);
            }

            resourceManager.on('relationship', handleRelationship);

            await resourceManager.relationship(context, { ref: { type: 'notes', id: '12', relationship: 'tags' } });
        });
    });

    test('should call add and change events', async () => {
        const resourceManager = makeResourceManager();

        const context: Context = {
            role: 'user',
            userId: '11',
        };

        function handleAdd(
            ctx: Context,
            query: Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'list'>,
            newResource: NewResource<ResourceDeclaration>,
            resource: CommonResource,
            included: CommonResource[],
        ): void {
            assert.deepStrictEqual(ctx, {
                role: 'user',
                userId: '11',
            });
            assert.deepStrictEqual(query, {
                ref: {
                    type: 'notes',
                },
            });
            assert.deepStrictEqual(newResource, {
                type: 'notes',
                attributes: {
                    title: 'Title',
                },
                relationships: {
                    tags: [],
                },
            });
            const id = resource.id;
            assert.deepStrictEqual(resource, {
                type: 'notes',
                id,
                attributes: {
                    created_at: 0,
                    links: [],
                    text: '',
                    title: 'Title',
                },
                relationships: {
                    author: {
                        id: '11',
                        type: 'users',
                    },
                    tags: {
                        items: [],
                        limit: 4,
                        offset: 0,
                        total: 0,
                    },
                },
            });
            assert.deepStrictEqual(included, []);
        }

        function handleChange(
            ctx: Context,
            query:
                | Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'id'>
                | Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'list'>,
            oldResource: CommonResource | null,
            newResource: CommonResource | null,
        ): void {
            assert.deepStrictEqual(ctx, {
                role: 'user',
                userId: '11',
            });
            assert.deepStrictEqual(query, {
                ref: {
                    type: 'notes',
                },
            });
            assert.deepStrictEqual(oldResource, null);
            assert(newResource !== null);
            const id = newResource.id;
            assert.deepStrictEqual(newResource, {
                type: 'notes',
                id,
                attributes: {
                    created_at: 0,
                    links: [],
                    text: '',
                    title: 'Title',
                },
                relationships: {
                    author: {
                        id: '11',
                        type: 'users',
                    },
                    tags: {
                        items: [],
                        limit: 4,
                        offset: 0,
                        total: 0,
                    },
                },
            });
        }

        resourceManager.on('add', handleAdd);
        resourceManager.on('change', handleChange);

        await resourceManager.add<NoteDeclaration>(
            context,
            { ref: { type: 'notes' } },
            {
                type: 'notes',
                attributes: {
                    title: 'Title',
                },
                relationships: {
                    tags: [],
                },
            },
        );
    });

    test('should call update and change events', async () => {
        const resourceManager = makeResourceManager();

        const context: Context = {
            role: 'user',
            userId: '11',
        };

        function handleUpdate(
            ctx: Context,
            query: Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'id'>,
            editableResource: EditableResource<ResourceDeclaration>,
            resource: CommonResource,
            included: CommonResource[],
        ): void {
            assert.deepStrictEqual(ctx, {
                role: 'user',
                userId: '11',
            });
            assert.deepStrictEqual(query, {
                ref: {
                    type: 'notes',
                    id: '12',
                },
            });
            assert.deepStrictEqual(editableResource, {
                type: 'notes',
                id: '12',
                attributes: {
                    text: 'Text',
                },
                relationships: {
                    tags: [],
                },
            });
            assert.deepStrictEqual(resource, {
                type: 'notes',
                id: '12',
                attributes: {
                    title: 'First Note',
                    text: 'Text',
                    created_at: 0,
                    links: ['g.com'],
                },
                relationships: {
                    author: {
                        id: '11',
                        type: 'users',
                    },
                    tags: {
                        items: [
                            {
                                id: '23',
                                type: 'tags',
                            },
                            {
                                id: '24',
                                type: 'tags',
                            },
                            {
                                id: '26',
                                type: 'tags',
                            },
                        ],
                        limit: 4,
                        offset: 0,
                        total: 3,
                    },
                },
            });
            assert.deepStrictEqual(included, []);
        }

        function handleChange(
            ctx: Context,
            query:
                | Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'id'>
                | Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'list'>,
            oldResource: CommonResource | null,
            newResource: CommonResource | null,
        ): void {
            assert.deepStrictEqual(ctx, {
                role: 'user',
                userId: '11',
            });
            assert.deepStrictEqual(query, {
                ref: {
                    type: 'notes',
                    id: '12',
                },
            });
            assert(oldResource !== null);
            assert.deepStrictEqual(oldResource, {
                type: 'notes',
                id: '12',
                attributes: {
                    title: 'First Note',
                    text: 'This is the big note',
                    created_at: 0,
                    links: ['g.com'],
                },
                relationships: {
                    author: {
                        id: '11',
                        type: 'users',
                    },
                    tags: {
                        items: [
                            {
                                id: '23',
                                type: 'tags',
                            },
                            {
                                id: '24',
                                type: 'tags',
                            },
                            {
                                id: '26',
                                type: 'tags',
                            },
                        ],
                        limit: 4,
                        offset: 0,
                        total: 3,
                    },
                },
            });
            assert(newResource !== null);
            assert.deepStrictEqual(newResource, {
                type: 'notes',
                id: '12',
                attributes: {
                    title: 'First Note',
                    text: 'Text',
                    created_at: 0,
                    links: ['g.com'],
                },
                relationships: {
                    author: {
                        id: '11',
                        type: 'users',
                    },
                    tags: {
                        items: [
                            {
                                id: '23',
                                type: 'tags',
                            },
                            {
                                id: '24',
                                type: 'tags',
                            },
                            {
                                id: '26',
                                type: 'tags',
                            },
                        ],
                        limit: 4,
                        offset: 0,
                        total: 3,
                    },
                },
            });
        }

        resourceManager.on('update', handleUpdate);
        resourceManager.on('change', handleChange);

        await resourceManager.update<NoteDeclaration>(
            context,
            { ref: { type: 'notes', id: '12' } },
            {
                type: 'notes',
                id: '12',
                attributes: {
                    text: 'Text',
                },
                relationships: {
                    tags: [],
                },
            },
        );
    });

    test('should call remove and change events', async () => {
        const resourceManager = makeResourceManager();

        const context: Context = {
            role: 'user',
            userId: '11',
        };

        function handleRemove(
            ctx: Context,
            query: Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'id'>,
        ): void {
            assert.deepStrictEqual(ctx, {
                role: 'user',
                userId: '11',
            });
            assert.deepStrictEqual(query, {
                ref: {
                    type: 'notes',
                    id: '12',
                },
            });
        }

        function handleChange(
            ctx: Context,
            query:
                | Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'id'>
                | Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'list'>,
            oldResource: CommonResource | null,
            newResource: CommonResource | null,
        ): void {
            assert.deepStrictEqual(ctx, {
                role: 'user',
                userId: '11',
            });
            assert.deepStrictEqual(query, {
                ref: {
                    type: 'notes',
                    id: '12',
                },
            });
            assert(oldResource !== null);
            assert.deepStrictEqual(oldResource, {
                type: 'notes',
                id: '12',
                attributes: {
                    title: 'First Note',
                    text: 'This is the big note',
                    created_at: 0,
                    links: ['g.com'],
                },
                relationships: {
                    author: {
                        id: '11',
                        type: 'users',
                    },
                    tags: {
                        items: [
                            {
                                id: '23',
                                type: 'tags',
                            },
                            {
                                id: '24',
                                type: 'tags',
                            },
                            {
                                id: '26',
                                type: 'tags',
                            },
                        ],
                        limit: 4,
                        offset: 0,
                        total: 3,
                    },
                },
            });
            assert(newResource === null);
        }

        resourceManager.on('remove', handleRemove);
        resourceManager.on('change', handleChange);

        await resourceManager.remove<NoteDeclaration>(context, { ref: { type: 'notes', id: '12' } });
    });

    test('should call add-relationship event', async () => {
        const resourceManager = makeResourceManager();

        const context: Context = {
            role: 'user',
            userId: '11',
        };

        function handleAddRelationship(
            ctx: Context,
            query: Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'relationship'>,
            relationshipValue: ResourceIdentifier<string>[],
            relationship: DataList<ResourceIdentifier<string>>,
            included: CommonResource[],
        ): void {
            assert.deepStrictEqual(ctx, {
                role: 'user',
                userId: '11',
            });
            assert.deepStrictEqual(query, {
                ref: {
                    type: 'notes',
                    id: '12',
                    relationship: 'tags',
                },
            });
            assert.deepStrictEqual(relationshipValue, [
                {
                    id: '25',
                    type: 'tags',
                },
            ]);
            assert.deepStrictEqual(relationship, {
                items: [
                    {
                        id: '23',
                        type: 'tags',
                    },
                    {
                        id: '24',
                        type: 'tags',
                    },
                    {
                        id: '25',
                        type: 'tags',
                    },
                    {
                        id: '26',
                        type: 'tags',
                    },
                ],
                limit: 4,
                offset: 0,
                total: 4,
            });
            assert.deepStrictEqual(included, []);
        }

        resourceManager.on('add-relationship', handleAddRelationship);

        await resourceManager.addRelationships<NoteDeclaration, 'tags'>(
            context,
            { ref: { type: 'notes', id: '12', relationship: 'tags' } },
            [
                {
                    id: '25',
                    type: 'tags',
                },
            ],
        );
    });

    test('should call update-relationship event', async () => {
        const resourceManager = makeResourceManager();

        const context: Context = {
            role: 'user',
            userId: '11',
        };

        function handleUpdateRelationship(
            ctx: Context,
            query: Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'relationship'>,
            relationshipValue: ResourceIdentifier<string> | ResourceIdentifier<string>[] | null,
            relationship: ResourceIdentifier<string> | DataList<ResourceIdentifier<string>> | null,
            included: CommonResource[],
        ): void {
            assert.deepStrictEqual(ctx, {
                role: 'user',
                userId: '11',
            });
            assert.deepStrictEqual(query, {
                ref: {
                    type: 'notes',
                    id: '12',
                    relationship: 'tags',
                },
            });
            assert.deepStrictEqual(relationshipValue, [
                {
                    id: '25',
                    type: 'tags',
                },
            ]);
            assert.deepStrictEqual(relationship, {
                items: [
                    {
                        id: '25',
                        type: 'tags',
                    },
                ],
                limit: 4,
                offset: 0,
                total: 1,
            });
            assert.deepStrictEqual(included, []);
        }

        resourceManager.on('update-relationship', handleUpdateRelationship);

        await resourceManager.updateRelationship<NoteDeclaration, 'tags'>(
            context,
            { ref: { type: 'notes', id: '12', relationship: 'tags' } },
            [
                {
                    id: '25',
                    type: 'tags',
                },
            ],
        );
    });

    test('should call remove-relationship event', async () => {
        const resourceManager = makeResourceManager();

        const context: Context = {
            role: 'user',
            userId: '11',
        };

        function handleRemoveRelationship(
            ctx: Context,
            query: Query<DefaultPage, ResourceDeclaration, ResourceDeclaration[], 'relationship'>,
            relationshipValue: ResourceIdentifier<string>[],
            relationship: DataList<ResourceIdentifier<string>>,
            included: CommonResource[],
        ): void {
            assert.deepStrictEqual(ctx, {
                role: 'user',
                userId: '11',
            });
            assert.deepStrictEqual(query, {
                ref: {
                    type: 'notes',
                    id: '12',
                    relationship: 'tags',
                },
            });
            assert.deepStrictEqual(relationshipValue, [
                {
                    id: '26',
                    type: 'tags',
                },
            ]);
            assert.deepStrictEqual(relationship, {
                items: [
                    {
                        id: '23',
                        type: 'tags',
                    },
                    {
                        id: '24',
                        type: 'tags',
                    },
                ],
                limit: 4,
                offset: 0,
                total: 2,
            });
            assert.deepStrictEqual(included, []);
        }

        resourceManager.on('remove-relationship', handleRemoveRelationship);

        await resourceManager.removeRelationships<NoteDeclaration, 'tags'>(
            context,
            { ref: { type: 'notes', id: '12', relationship: 'tags' } },
            [
                {
                    id: '26',
                    type: 'tags',
                },
            ],
        );
    });

    test('should call operations event', async () => {
        const resourceManager = makeResourceManager();

        const context: Context = {
            role: 'user',
            userId: '11',
        };

        function handleOperations(
            ctx: Context,
            operations: Operation<ResourceDeclaration>[],
            results: OperationResults<Operation<ResourceDeclaration>[]>,
        ): void {
            assert.deepStrictEqual(ctx, {
                role: 'user',
                userId: '11',
            });
            assert.deepStrictEqual(operations, [
                {
                    op: 'add',
                    data: {
                        type: 'notes',
                        lid: 'new-note',
                        attributes: {
                            title: 'New Note',
                        },
                        relationships: {
                            tags: [],
                        },
                    },
                },
                {
                    op: 'add',
                    data: {
                        type: 'tags',
                        attributes: {
                            name: 'new one',
                        },
                        relationships: {
                            note: {
                                type: 'notes',
                                lid: 'new-note',
                            },
                        },
                    },
                },
            ]);

            assert(results[0] !== null && typeof results[0] === 'object' && 'id' in results[0]);
            const noteId = results[0].id;
            assert(results[1] !== null && typeof results[1] === 'object' && 'id' in results[1]);
            const tagId = results[1].id;
            assert.deepStrictEqual(results, [
                {
                    type: 'notes',
                    id: noteId,
                    attributes: {
                        title: 'New Note',
                        text: '',
                        created_at: 0,
                        links: [],
                    },
                    relationships: {
                        author: {
                            id: '11',
                            type: 'users',
                        },
                        tags: {
                            items: [],
                            total: 0,
                            limit: 4,
                            offset: 0,
                        },
                    },
                },
                {
                    attributes: {
                        name: 'new one',
                    },
                    id: tagId,
                    relationships: {
                        note: {
                            id: noteId,
                            type: 'notes',
                        },
                    },
                    type: 'tags',
                },
            ]);
        }

        resourceManager.on('operations', handleOperations);

        await resourceManager.operations(context, [
            operation.add<NoteDeclaration>({
                op: 'add',
                data: {
                    type: 'notes',
                    lid: 'new-note',
                    attributes: {
                        title: 'New Note',
                    },
                    relationships: {
                        tags: [],
                    },
                },
            }),
            operation.add<TagDeclaration>({
                op: 'add',
                data: {
                    type: 'tags',
                    attributes: {
                        name: 'new one',
                    },
                    relationships: {
                        note: {
                            type: 'notes',
                            lid: 'new-note',
                        },
                    },
                },
            }),
        ]);
    });
});
