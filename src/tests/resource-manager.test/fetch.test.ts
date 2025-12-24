import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Context, makeResourceManager, NoteDeclaration, UserDeclaration } from '../prepare';
import { ErrorSet } from '@just-io/schema';

describe('ResourceManager', () => {
    const resourceManager = makeResourceManager();

    test('should throw error of unknown resource type', async () => {
        await assert.rejects(
            () =>
                resourceManager.list(
                    { role: 'admin', userId: '1' },
                    {
                        ref: { type: 'passwords' },
                    },
                ),
            (err) => {
                assert.ok(err instanceof ErrorSet);
                assert.deepStrictEqual(err.toJSON(), {
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

                return true;
            },
        );
    });

    describe('with admin context', () => {
        const context: Context = {
            role: 'admin',
            userId: '0',
        };

        describe('with users', () => {
            test('should list users', async () => {
                const result = await resourceManager.list(context, {
                    ref: { type: 'users' },
                });
                assert.deepStrictEqual(result, {
                    resources: {
                        items: [
                            {
                                type: 'users',
                                id: '11',
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
                            {
                                type: 'users',
                                id: '12',
                                attributes: {
                                    login: 'second',
                                },
                                relationships: {
                                    notes: {
                                        items: [
                                            {
                                                id: '14',
                                                type: 'notes',
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
                    },
                    included: [],
                });
            });

            test('should get user', async () => {
                const result = await resourceManager.get(context, {
                    ref: { type: 'users', id: '11' },
                });
                assert.deepStrictEqual(result, {
                    resource: {
                        type: 'users',
                        id: '11',
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
                    included: [],
                });
            });

            test('should not get user', async () => {
                const result = await resourceManager.get(context, {
                    ref: { type: 'users', id: '10' },
                });
                assert.deepStrictEqual(result, {
                    resource: null,
                    included: [],
                });
            });

            describe('with filter', () => {
                test('should list users with filter login', async () => {
                    const result = await resourceManager.list(context, {
                        ref: { type: 'users' },
                        params: {
                            fields: { users: ['login'] },
                            filter: {
                                login: ['first'],
                            },
                        },
                    });
                    assert.deepStrictEqual(result, {
                        resources: {
                            items: [
                                {
                                    type: 'users',
                                    id: '11',
                                    attributes: {
                                        login: 'first',
                                    },
                                    relationships: {},
                                },
                            ],
                            limit: 10,
                            offset: 0,
                            total: 1,
                        },
                        included: [],
                    });
                });

                test('should list zero users with filter login', async () => {
                    const result = await resourceManager.list(context, {
                        ref: { type: 'users' },
                        params: {
                            fields: { users: ['login'] },
                            filter: {
                                login: ['third'],
                            },
                        },
                    });
                    assert.deepStrictEqual(result, {
                        resources: {
                            items: [],
                            limit: 10,
                            offset: 0,
                            total: 0,
                        },
                        included: [],
                    });
                });

                test('should throw error on getting invalid filter', async () => {
                    await assert.rejects(
                        () =>
                            resourceManager.get(context, {
                                ref: { type: 'users', id: '11' },
                                params: {
                                    filter: { id: ['11'] },
                                },
                            }),
                        (err) => {
                            assert.ok(err instanceof ErrorSet);
                            assert.deepStrictEqual(err.toJSON(), {
                                errors: [
                                    {
                                        detail: 'Filtering by field "filter[id]" does not support in type "users"',
                                        source: {
                                            parameter: 'filter',
                                        },
                                        status: 400,
                                        title: 'Invalid Query Parameter',
                                    },
                                ],
                            });

                            return true;
                        },
                    );
                });
            });

            describe('with pages', () => {
                test('should list one user with page', async () => {
                    const result = await resourceManager.list(context, {
                        ref: { type: 'users' },
                        params: {
                            fields: { users: [] },
                            page: {
                                size: 1,
                            },
                        },
                    });
                    assert.deepStrictEqual(result, {
                        resources: {
                            items: [
                                {
                                    type: 'users',
                                    id: '11',
                                    attributes: {},
                                    relationships: {},
                                },
                            ],
                            limit: 1,
                            offset: 0,
                            total: 2,
                        },
                        included: [],
                    });
                });

                test('should list second user with page', async () => {
                    const result = await resourceManager.list(context, {
                        ref: { type: 'users' },
                        params: {
                            fields: { users: [] },
                            page: {
                                number: 1,
                                size: 1,
                            },
                        },
                    });
                    assert.deepStrictEqual(result, {
                        resources: {
                            items: [
                                {
                                    type: 'users',
                                    id: '12',
                                    attributes: {},
                                    relationships: {},
                                },
                            ],
                            limit: 1,
                            offset: 1,
                            total: 2,
                        },
                        included: [],
                    });
                });

                test('should throw error on listing invalid page', async () => {
                    await assert.rejects(
                        () =>
                            resourceManager.list(context, {
                                ref: { type: 'users' },
                                params: {
                                    page: {
                                        number: -1,
                                        size: 0.1,
                                    },
                                },
                            }),
                        (err) => {
                            assert.ok(err instanceof ErrorSet);
                            assert.deepStrictEqual(err.toJSON(), {
                                errors: [
                                    {
                                        detail: 'Should be more than or equal 0.',
                                        source: {
                                            parameter: 'page',
                                        },
                                        status: 400,
                                        title: 'Invalid Query Parameter',
                                    },
                                    {
                                        detail: 'Should be more than or equal 1.',
                                        source: {
                                            parameter: 'page',
                                        },
                                        status: 400,
                                        title: 'Invalid Query Parameter',
                                    },
                                ],
                            });

                            return true;
                        },
                    );
                });
            });

            describe('with sort', () => {
                test('should list sort users', async () => {
                    const result = await resourceManager.list<UserDeclaration>(context, {
                        ref: { type: 'users' },
                        params: {
                            fields: { users: ['login'] },
                            sort: [
                                {
                                    field: 'login',
                                    asc: false,
                                },
                            ],
                        },
                    });
                    assert.deepStrictEqual(result, {
                        resources: {
                            items: [
                                {
                                    type: 'users',
                                    id: '12',
                                    attributes: {
                                        login: 'second',
                                    },
                                    relationships: {},
                                },
                                {
                                    type: 'users',
                                    id: '11',
                                    attributes: {
                                        login: 'first',
                                    },
                                    relationships: {},
                                },
                            ],
                            limit: 10,
                            offset: 0,
                            total: 2,
                        },
                        included: [],
                    });
                });

                test('should throw error on listing invalid sort', async () => {
                    await assert.rejects(
                        () =>
                            resourceManager.list(context, {
                                ref: { type: 'users' },
                                params: {
                                    sort: [
                                        {
                                            field: 'name',
                                            asc: false,
                                        },
                                    ],
                                },
                            }),
                        (err) => {
                            assert.ok(err instanceof ErrorSet);
                            assert.deepStrictEqual(err.toJSON(), {
                                errors: [
                                    {
                                        detail: 'Sorting by field "name" does not support in type "users"',
                                        source: {
                                            parameter: 'sort',
                                        },
                                        status: 400,
                                        title: 'Invalid Query Parameter',
                                    },
                                ],
                            });

                            return true;
                        },
                    );
                });
            });

            describe('with relationship notes', () => {
                test('should relationship user notes', async () => {
                    const result = await resourceManager.relationship(context, {
                        ref: { type: 'users', id: '11', relationship: 'notes' },
                    });
                    assert.deepStrictEqual(result, {
                        relationship: {
                            items: [
                                {
                                    type: 'notes',
                                    id: '12',
                                },
                                {
                                    type: 'notes',
                                    id: '13',
                                },
                            ],
                            limit: 10,
                            offset: 0,
                            total: 2,
                        },
                        included: [],
                    });
                });

                test('should throw error on relationship invalid relationship', async () => {
                    await assert.rejects(
                        () =>
                            resourceManager.relationship(context, {
                                ref: { type: 'users', id: '11', relationship: 'note' },
                            }),
                        (err) => {
                            assert.ok(err instanceof ErrorSet);
                            assert.deepStrictEqual(err.toJSON(), {
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

                            return true;
                        },
                    );
                });

                test('should relationship user relationship notes', async () => {
                    const result = await resourceManager.relationship(context, {
                        ref: { type: 'users', id: '11', relationship: 'notes', related: true },
                    });
                    assert.deepStrictEqual(result, {
                        relationship: {
                            items: [
                                {
                                    type: 'notes',
                                    id: '12',
                                },
                                {
                                    type: 'notes',
                                    id: '13',
                                },
                            ],
                            limit: 10,
                            offset: 0,
                            total: 2,
                        },
                        included: [],
                    });
                });

                test('should throw error on relationship invalid relationship', async () => {
                    await assert.rejects(
                        () =>
                            resourceManager.relationship(context, {
                                ref: { type: 'users', id: '11', relationship: 'note', related: true },
                            }),
                        (err) => {
                            assert.ok(err instanceof ErrorSet);
                            assert.deepStrictEqual(err.toJSON(), {
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

                            return true;
                        },
                    );
                });
            });
        });
    });

    describe('with user context', () => {
        const context: Context = {
            role: 'user',
            userId: '11',
        };

        describe('with users', () => {
            test('should list users', async () => {
                const result = await resourceManager.list(context, {
                    ref: { type: 'users' },
                });
                assert.deepStrictEqual(result, {
                    resources: {
                        items: [
                            {
                                type: 'users',
                                id: '11',
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
                        ],
                        limit: 10,
                        offset: 0,
                        total: 1,
                    },
                    included: [],
                });
            });

            test('should get user', async () => {
                const result = await resourceManager.get(context, {
                    ref: { type: 'users', id: '11' },
                });
                assert.deepStrictEqual(result, {
                    resource: {
                        type: 'users',
                        id: '11',
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
                    included: [],
                });
            });

            test('should not get user', async () => {
                const result = await resourceManager.get(context, {
                    ref: { type: 'users', id: '10' },
                });
                assert.deepStrictEqual(result, {
                    resource: null,
                    included: [],
                });
            });

            test('should throw error on getting forbidden user', async () => {
                await assert.rejects(
                    () =>
                        resourceManager.get(context, {
                            ref: { type: 'users', id: '12' },
                        }),
                    (err) => {
                        assert.ok(err instanceof ErrorSet);
                        assert.deepStrictEqual(err.toJSON(), {
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

                        return true;
                    },
                );
            });

            describe('with includes', () => {
                test('should get user with notes', async () => {
                    const result = await resourceManager.get<UserDeclaration, [NoteDeclaration]>(context, {
                        ref: { type: 'users', id: '11' },
                        params: {
                            include: [['notes']],
                        },
                    });
                    assert.deepStrictEqual(result, {
                        resource: {
                            type: 'users',
                            id: '11',
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
                        included: [
                            {
                                attributes: {
                                    text: 'This is the big note',
                                    title: 'First Note',
                                    created_at: 0,
                                    links: ['g.com'],
                                },
                                id: '12',
                                type: 'notes',
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
                                attributes: {
                                    text: 'This is the small note',
                                    title: 'Second Note',
                                    created_at: 10,
                                    links: [],
                                },
                                id: '13',
                                type: 'notes',
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
                    });
                });

                test('should get user with notes.tags', async () => {
                    const result = await resourceManager.get(context, {
                        ref: { type: 'users', id: '11' },
                        params: {
                            include: [['notes', 'tags']],
                        },
                    });
                    assert.deepStrictEqual(result, {
                        resource: {
                            type: 'users',
                            id: '11',
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
                        included: [
                            {
                                attributes: {
                                    text: 'This is the big note',
                                    title: 'First Note',
                                    created_at: 0,
                                    links: ['g.com'],
                                },
                                id: '12',
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
                                type: 'notes',
                            },
                            {
                                attributes: {
                                    text: 'This is the small note',
                                    title: 'Second Note',
                                    created_at: 10,
                                    links: [],
                                },
                                id: '13',
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
                                type: 'notes',
                            },
                            {
                                attributes: {
                                    name: 'action',
                                },
                                id: '23',
                                relationships: {
                                    note: {
                                        id: '12',
                                        type: 'notes',
                                    },
                                },
                                type: 'tags',
                            },
                            {
                                attributes: {
                                    name: 'movie',
                                },
                                id: '24',
                                relationships: {
                                    note: {
                                        id: '12',
                                        type: 'notes',
                                    },
                                },
                                type: 'tags',
                            },
                            {
                                attributes: {
                                    name: 'drama',
                                },
                                id: '26',
                                relationships: {
                                    note: {
                                        id: '12',
                                        type: 'notes',
                                    },
                                },
                                type: 'tags',
                            },
                            {
                                attributes: {
                                    name: 'fantasy',
                                },
                                id: '25',
                                relationships: {
                                    note: {
                                        id: '13',
                                        type: 'notes',
                                    },
                                },
                                type: 'tags',
                            },
                        ],
                    });
                });

                test('should throw error on getting invalid include', async () => {
                    await assert.rejects(
                        () =>
                            resourceManager.get(context, {
                                ref: { type: 'users', id: '11' },
                                params: {
                                    include: [['notes.location']],
                                },
                            }),
                        (err) => {
                            assert.ok(err instanceof ErrorSet);
                            assert.deepStrictEqual(err.toJSON(), {
                                errors: [
                                    {
                                        detail: undefined,
                                        source: {
                                            parameter: 'include',
                                        },
                                        status: 400,
                                        title: 'Invalid Query Parameter',
                                    },
                                ],
                            });

                            return true;
                        },
                    );
                });
            });

            describe('with fields', () => {
                test('should get user with fields login', async () => {
                    const result = await resourceManager.get<UserDeclaration>(context, {
                        ref: { type: 'users', id: '11' },
                        params: {
                            fields: { users: ['login'] },
                        },
                    });
                    assert.deepStrictEqual(result, {
                        resource: {
                            type: 'users',
                            id: '11',
                            attributes: {
                                login: 'first',
                            },
                            relationships: {},
                        },
                        included: [],
                    });
                });

                test('should get user with fields user login and note title', async () => {
                    const result = await resourceManager.get(context, {
                        ref: { type: 'users', id: '11' },
                        params: {
                            fields: { users: ['login'], notes: ['title'] },
                            include: [['notes']],
                        },
                    });
                    assert.deepStrictEqual(result, {
                        resource: {
                            type: 'users',
                            id: '11',
                            attributes: {
                                login: 'first',
                            },
                            relationships: {},
                        },
                        included: [
                            {
                                attributes: {
                                    title: 'First Note',
                                },
                                id: '12',
                                type: 'notes',
                                relationships: {},
                            },
                            {
                                attributes: {
                                    title: 'Second Note',
                                },
                                id: '13',
                                type: 'notes',
                                relationships: {},
                            },
                        ],
                    });
                });

                test('should throw error on getting invalid field resource type', async () => {
                    await assert.rejects(
                        () =>
                            resourceManager.get(context, {
                                ref: { type: 'users', id: '11' },
                                params: {
                                    fields: { note: ['name'] },
                                },
                            }),
                        (err) => {
                            assert.ok(err instanceof ErrorSet);
                            assert.deepStrictEqual(err.toJSON(), {
                                errors: [
                                    {
                                        detail: "The resource type 'note' does not exist.",
                                        source: {
                                            parameter: 'fields',
                                        },
                                        status: 400,
                                        title: 'Invalid Query Parameter',
                                    },
                                ],
                            });

                            return true;
                        },
                    );
                });

                test('should throw error on getting invalid field resourse field', async () => {
                    await assert.rejects(
                        () =>
                            resourceManager.get(context, {
                                ref: { type: 'users', id: '11' },
                                params: {
                                    fields: { notes: ['name'] },
                                },
                            }),
                        (err) => {
                            assert.ok(err instanceof ErrorSet);
                            assert.deepStrictEqual(err.toJSON(), {
                                errors: [
                                    {
                                        detail: "The resource type 'notes' does not have field 'name'.",
                                        source: {
                                            parameter: 'fields',
                                        },
                                        status: 400,
                                        title: 'Invalid Query Parameter',
                                    },
                                ],
                            });

                            return true;
                        },
                    );
                });
            });
        });
    });
});
