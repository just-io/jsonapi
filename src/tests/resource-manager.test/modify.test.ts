import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Context, makeResourceManager, NoteDeclaration, TagDeclaration, UserDeclaration } from '../prepare';

describe('ResourceManager', () => {
    describe('unavailable cases', () => {
        describe('method add', () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            test('should return error of unknown resource type', async () => {
                const { result } = await resourceManager.add(
                    context,
                    {
                        ref: { type: 'passwords' },
                    },
                    {
                        type: 'passwords',
                        attributes: {},
                        relationships: {},
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
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
            });

            test('should return error on add user', async () => {
                const { result } = await resourceManager.add<UserDeclaration>(
                    context,
                    {
                        ref: { type: 'users' },
                    },
                    {
                        type: 'users',
                        attributes: {},
                        relationships: {},
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: "The method 'post' is not allowed.",
                            source: {
                                parameter: 'method',
                            },
                            status: 405,
                            title: 'Method Not Allowed',
                        },
                    ],
                });
            });
        });

        describe('method update', () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'admin',
                userId: '0',
            };

            test('should return error of unknown resource type', async () => {
                const { result } = await resourceManager.update(
                    context,
                    {
                        ref: { type: 'passwords', id: '12' },
                    },
                    {
                        type: 'passwords',
                        id: '12',
                        attributes: {},
                        relationships: {},
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
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
            });

            test('should return error on update user', async () => {
                const { result } = await resourceManager.update<UserDeclaration>(
                    context,
                    {
                        ref: { type: 'users', id: '12' },
                    },
                    {
                        type: 'users',
                        id: '12',
                        attributes: {},
                        relationships: {},
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: "The method 'patch' is not allowed.",
                            source: {
                                parameter: 'method',
                            },
                            status: 405,
                            title: 'Method Not Allowed',
                        },
                    ],
                });
            });
        });

        describe('method remove', () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'admin',
                userId: '0',
            };

            test('should return error of unknown resource type', async () => {
                const { result } = await resourceManager.remove(context, {
                    ref: { type: 'passwords', id: '12' },
                });
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
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
            });

            test('should return error of remove user', async () => {
                const { result } = await resourceManager.remove(context, {
                    ref: { type: 'users', id: '12' },
                });
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: "The method 'delete' is not allowed.",
                            source: {
                                parameter: 'method',
                            },
                            status: 405,
                            title: 'Method Not Allowed',
                        },
                    ],
                });
            });
        });
    });

    describe('modify cases', () => {
        describe('method add', () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            test('should return error of add note to forbidden user', async () => {
                const { result } = await resourceManager.add<NoteDeclaration>(
                    context,
                    {
                        ref: { type: 'notes' },
                    },
                    {
                        type: 'notes',
                        attributes: {
                            title: 'New Note',
                        },
                        relationships: {
                            author: {
                                type: 'users',
                                id: '12',
                            },
                            tags: [],
                        },
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: undefined,
                            source: {
                                pointer: '/relationships/author/id',
                            },
                            status: 403,
                            title: 'Forbidden',
                        },
                    ],
                });
            });

            test('should return error of add note to not found user', async () => {
                const { result } = await resourceManager.add<NoteDeclaration>(
                    context,
                    {
                        ref: { type: 'notes' },
                    },
                    {
                        type: 'notes',
                        attributes: {
                            title: 'New Note',
                        },
                        relationships: {
                            author: {
                                type: 'users',
                                id: '10',
                            },
                            tags: [],
                        },
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: undefined,
                            source: {
                                pointer: '/relationships/author/id',
                            },
                            status: 404,
                            title: 'Not found',
                        },
                    ],
                });
            });

            test('should return error of add note to invalid attribute', async () => {
                const { result } = await resourceManager.add(
                    context,
                    {
                        ref: { type: 'notes' },
                    },
                    {
                        type: 'notes',
                        attributes: {
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-expect-error
                            title: 12,
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-expect-error
                            links: ['href:', 12],
                        },
                        relationships: {
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-expect-error
                            author: {
                                type: 'users',
                                id: '11',
                            },
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-expect-error
                            tags: [],
                        },
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: 'Should be "string" type.',
                            source: {
                                pointer: '/attributes/title',
                            },
                            status: 400,
                            title: 'Invalid Field',
                        },
                        {
                            detail: 'Should be "string" type.',
                            source: {
                                pointer: '/attributes/links/1',
                            },
                            status: 400,
                            title: 'Invalid Field',
                        },
                    ],
                });
            });

            test('should add note to user', async () => {
                const { result } = await resourceManager.add<NoteDeclaration>(
                    context,
                    {
                        ref: { type: 'notes' },
                    },
                    {
                        type: 'notes',
                        attributes: {
                            title: 'New Note',
                        },
                        relationships: {
                            author: {
                                type: 'users',
                                id: '11',
                            },
                            tags: [],
                        },
                    },
                );
                assert.ok(result.ok === true);
                const { resource, included } = result.value;

                assert.ok(typeof resource?.id === 'string');

                const id = resource.id;

                assert.deepStrictEqual(
                    { resource, included },
                    {
                        resource: {
                            type: 'notes',
                            id,
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
                                    limit: 4,
                                    offset: 0,
                                    total: 0,
                                },
                            },
                        },
                        included: [],
                    },
                );
            });
        });

        describe('method update', () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            test('should return error of update note of forbidden user', async () => {
                const { result } = await resourceManager.update<NoteDeclaration>(
                    context,
                    {
                        ref: { type: 'notes', id: '14' },
                    },
                    {
                        id: '14',
                        type: 'notes',
                        attributes: {
                            title: 'Updated Note Info',
                        },
                        relationships: {},
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: undefined,
                            source: {
                                parameter: 'query',
                            },
                            status: 403,
                            title: 'Forbidden',
                        },
                    ],
                });
            });

            test('should return error of update note of not equal id', async () => {
                const { result } = await resourceManager.update<NoteDeclaration>(
                    context,
                    {
                        ref: { type: 'notes', id: '12' },
                    },
                    {
                        id: '13',
                        type: 'notes',
                        attributes: {
                            title: 'Updated Note Info',
                        },
                        relationships: {},
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: 'The resource with id does not equal query id.',
                            source: {
                                pointer: '/id',
                            },
                            status: 400,
                            title: 'Invalid Resource Id',
                        },
                    ],
                });
            });

            test('should return error of update not found note', async () => {
                const { result } = await resourceManager.update<NoteDeclaration>(
                    context,
                    {
                        ref: { type: 'notes', id: '10' },
                    },
                    {
                        id: '10',
                        type: 'notes',
                        attributes: {
                            title: 'Updated Note Info',
                        },
                        relationships: {},
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: undefined,
                            source: {
                                parameter: 'query',
                            },
                            status: 404,
                            title: 'Not found',
                        },
                    ],
                });
            });

            test('should update note of user', async () => {
                const { result } = await resourceManager.update<NoteDeclaration>(
                    context,
                    {
                        ref: { type: 'notes', id: '12' },
                    },
                    {
                        id: '12',
                        type: 'notes',
                        attributes: {
                            title: 'Updated Note Info',
                        },
                        relationships: {},
                    },
                );
                assert.ok(result.ok === true);
                const { resource, included } = result.value;

                assert.ok(typeof resource?.id === 'string');

                const id = resource.id;

                assert.deepStrictEqual(
                    { resource, included },
                    {
                        resource: {
                            type: 'notes',
                            id,
                            attributes: {
                                title: 'Updated Note Info',
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
                        included: [],
                    },
                );
            });
        });

        describe('method remove', () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            test('should return error of remove note of forbidden user', async () => {
                const { result } = await resourceManager.remove<NoteDeclaration>(context, {
                    ref: { type: 'notes', id: '14' },
                });
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: undefined,
                            source: {
                                parameter: 'query',
                            },
                            status: 403,
                            title: 'Forbidden',
                        },
                    ],
                });
            });

            test('should return error of remove not found note', async () => {
                const { result } = await resourceManager.remove<NoteDeclaration>(context, {
                    ref: { type: 'notes', id: '10' },
                });
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: undefined,
                            source: {
                                parameter: 'query',
                            },
                            status: 404,
                            title: 'Not found',
                        },
                    ],
                });
            });

            test('should remove note of user', async () => {
                assert.doesNotReject(() => {
                    return resourceManager.remove<NoteDeclaration>(context, {
                        ref: { type: 'notes', id: '12' },
                    });
                });
            });
        });

        describe('method updateRelationship', () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            test('should return error of update tag to forbidden user', async () => {
                const { result } = await resourceManager.updateRelationship<TagDeclaration, 'note'>(
                    context,
                    {
                        ref: { type: 'tags', id: '23', relationship: 'note' },
                    },
                    {
                        type: 'notes',
                        id: '14',
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: 'Resource with id "14" is forbidden.',
                            source: {
                                pointer: '/id',
                            },
                            status: 403,
                            title: 'Forbidden',
                        },
                    ],
                });
            });

            test('should return error of update tag of not found user', async () => {
                const { result } = await resourceManager.updateRelationship<TagDeclaration, 'note'>(
                    context,
                    {
                        ref: { type: 'tags', id: '23', relationship: 'note' },
                    },
                    {
                        type: 'notes',
                        id: '10',
                    },
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: 'Resource with id "10" doesn\'t exist.',
                            source: {
                                pointer: '/id',
                            },
                            status: 404,
                            title: 'Not found',
                        },
                    ],
                });
            });

            test('should update tag', async () => {
                const { result } = await resourceManager.updateRelationship<TagDeclaration, 'note'>(
                    context,
                    {
                        ref: { type: 'tags', id: '23', relationship: 'note' },
                    },
                    {
                        type: 'notes',
                        id: '13',
                    },
                );
                assert.ok(result.ok === true);
                const { relationship, included } = result.value;
                assert.deepStrictEqual(
                    { relationship, included },
                    {
                        relationship: {
                            id: '13',
                            type: 'notes',
                        },
                        included: [],
                    },
                );
            });
        });

        describe('method addRelationship', () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            test('should return error of add tag of forbidden user', async () => {
                const { result } = await resourceManager.addRelationships<NoteDeclaration, 'tags'>(
                    context,
                    {
                        ref: { type: 'notes', id: '12', relationship: 'tags' },
                    },
                    [
                        {
                            type: 'tags',
                            id: '27',
                        },
                    ],
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: 'Resource with id "27" is forbidden.',
                            source: {
                                pointer: '/0/id',
                            },
                            status: 403,
                            title: 'Forbidden',
                        },
                    ],
                });
            });

            test('should return error of add not existing tag', async () => {
                const { result } = await resourceManager.addRelationships<NoteDeclaration, 'tags'>(
                    context,
                    {
                        ref: { type: 'notes', id: '12', relationship: 'tags' },
                    },
                    [
                        {
                            type: 'tags',
                            id: '28',
                        },
                    ],
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: 'Resource with id "28" doesn\'t exist.',
                            source: {
                                pointer: '/0/id',
                            },
                            status: 404,
                            title: 'Not found',
                        },
                    ],
                });
            });

            test('should add tag', async () => {
                const { result } = await resourceManager.addRelationships<NoteDeclaration, 'tags'>(
                    context,
                    {
                        ref: { type: 'notes', id: '12', relationship: 'tags' },
                    },
                    [
                        {
                            type: 'tags',
                            id: '25',
                        },
                    ],
                );
                assert.ok(result.ok === true);
                const { relationship, included } = result.value;
                assert.deepStrictEqual(
                    { relationship, included },
                    {
                        relationship: {
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
                            total: 4,
                            limit: 4,
                            offset: 0,
                        },
                        included: [],
                    },
                );
            });
        });

        describe('method removeRelationships', () => {
            const resourceManager = makeResourceManager();

            const context: Context = {
                role: 'user',
                userId: '11',
            };

            test('should return error of remove tag of forbidden user', async () => {
                const { result } = await resourceManager.removeRelationships<NoteDeclaration, 'tags'>(
                    context,
                    {
                        ref: { type: 'notes', id: '12', relationship: 'tags' },
                    },
                    [
                        {
                            type: 'tags',
                            id: '27',
                        },
                    ],
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: 'Resource with id "27" is forbidden.',
                            source: {
                                pointer: '/0/id',
                            },
                            status: 403,
                            title: 'Forbidden',
                        },
                    ],
                });
            });

            test('should remove unexisting tag', async () => {
                const { result } = await resourceManager.removeRelationships<NoteDeclaration, 'tags'>(
                    context,
                    {
                        ref: { type: 'notes', id: '12', relationship: 'tags' },
                    },
                    [
                        {
                            type: 'tags',
                            id: '28',
                        },
                    ],
                );
                assert.ok(result.ok === true);
                const { relationship, included } = result.value;
                assert.deepStrictEqual(
                    { relationship, included },
                    {
                        relationship: {
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
                            total: 3,
                            limit: 4,
                            offset: 0,
                        },
                        included: [],
                    },
                );
            });

            test('should remove tag', async () => {
                const { result } = await resourceManager.removeRelationships<NoteDeclaration, 'tags'>(
                    context,
                    {
                        ref: { type: 'notes', id: '12', relationship: 'tags' },
                    },
                    [
                        {
                            type: 'tags',
                            id: '23',
                        },
                    ],
                );
                assert.ok(result.ok === true);
                const { relationship, included } = result.value;
                assert.deepStrictEqual(
                    { relationship, included },
                    {
                        relationship: {
                            items: [
                                {
                                    id: '24',
                                    type: 'tags',
                                },
                                {
                                    id: '26',
                                    type: 'tags',
                                },
                            ],
                            total: 2,
                            limit: 4,
                            offset: 0,
                        },
                        included: [],
                    },
                );
            });

            test('should return error of updating tag of forbidden user', async () => {
                const { result } = await resourceManager.updateRelationship<NoteDeclaration, 'tags'>(
                    context,
                    {
                        ref: { type: 'notes', id: '12', relationship: 'tags' },
                    },
                    [
                        {
                            type: 'tags',
                            id: '27',
                        },
                    ],
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: 'Resource with id "27" is forbidden.',
                            source: {
                                pointer: '/0/id',
                            },
                            status: 403,
                            title: 'Forbidden',
                        },
                    ],
                });
            });

            test('should return error of updating not existing tag', async () => {
                const { result } = await resourceManager.updateRelationship<NoteDeclaration, 'tags'>(
                    context,
                    {
                        ref: { type: 'notes', id: '12', relationship: 'tags' },
                    },
                    [
                        {
                            type: 'tags',
                            id: '28',
                        },
                    ],
                );
                assert.ok(result.ok === false);
                assert.deepStrictEqual(result.error.toJSON(), {
                    errors: [
                        {
                            detail: 'Resource with id "28" doesn\'t exist.',
                            source: {
                                pointer: '/0/id',
                            },
                            status: 404,
                            title: 'Not found',
                        },
                    ],
                });
            });

            test('should update tags', async () => {
                const { result } = await resourceManager.updateRelationship<NoteDeclaration, 'tags'>(
                    context,
                    {
                        ref: { type: 'notes', id: '12', relationship: 'tags' },
                    },
                    [
                        {
                            type: 'tags',
                            id: '25',
                        },
                    ],
                );
                assert.ok(result.ok === true);
                const { relationship, included } = result.value;
                assert.deepStrictEqual(
                    { relationship, included },
                    {
                        relationship: {
                            items: [
                                {
                                    id: '25',
                                    type: 'tags',
                                },
                            ],
                            limit: 4,
                            total: 1,
                            offset: 0,
                        },
                        included: [],
                    },
                );
            });
        });
    });
});
