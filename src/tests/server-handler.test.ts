import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Context, makeServerHandler } from './prepare';

describe('ServerHandler', () => {
    const context: Context = {
        role: 'admin',
        userId: '0',
    };

    test('should return error of unknown resource type', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(context, 'GET', 'www.example.com/api/v1/passwords', '');

        assert.deepStrictEqual(result, {
            status: 404,
            body: {
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
            },
        });
    });

    test('should return error of invalid query', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(context, 'GET', 'www.example.com/api/v1/users/10/relationship', '');

        assert.deepStrictEqual(result, {
            status: 404,
            body: {
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
            },
        });
    });

    test('should return list of users', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(context, 'GET', 'www.example.com/api/v1/users', '');

        assert.deepStrictEqual(result, {
            status: 200,
            body: {
                data: [
                    {
                        type: 'users',
                        id: '11',
                        attributes: {
                            login: 'first',
                        },
                        relationships: {
                            notes: {
                                data: [
                                    {
                                        id: '12',
                                        type: 'notes',
                                    },
                                    {
                                        id: '13',
                                        type: 'notes',
                                    },
                                ],
                                links: {
                                    first: undefined,
                                    last: undefined,
                                    next: undefined,
                                    prev: undefined,
                                    self: 'www.example.com/api/v1/users/11/relationships/notes',
                                    related: 'www.example.com/api/v1/users/11/notes',
                                },
                                meta: {
                                    total: 2,
                                    totalPages: 1,
                                    pageNumber: 0,
                                    pageSize: 4,
                                },
                            },
                        },
                        links: {
                            self: 'www.example.com/api/v1/users/11',
                        },
                        meta: {},
                    },
                    {
                        type: 'users',
                        id: '12',
                        attributes: {
                            login: 'second',
                        },
                        relationships: {
                            notes: {
                                data: [
                                    {
                                        id: '14',
                                        type: 'notes',
                                    },
                                ],
                                links: {
                                    first: undefined,
                                    last: undefined,
                                    next: undefined,
                                    prev: undefined,
                                    self: 'www.example.com/api/v1/users/12/relationships/notes',
                                    related: 'www.example.com/api/v1/users/12/notes',
                                },
                                meta: {
                                    total: 1,
                                    totalPages: 1,
                                    pageNumber: 0,
                                    pageSize: 4,
                                },
                            },
                        },
                        links: {
                            self: 'www.example.com/api/v1/users/12',
                        },
                        meta: {},
                    },
                ],
                included: [],
                links: {
                    first: undefined,
                    last: undefined,
                    next: undefined,
                    prev: undefined,
                    self: 'www.example.com/api/v1/users',
                },
                meta: {
                    total: 2,
                    totalPages: 1,
                    pageNumber: 0,
                    pageSize: 10,
                },
            },
        });
    });

    test('should return user', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(context, 'GET', 'www.example.com/api/v1/users/11', '');

        assert.deepStrictEqual(result, {
            status: 200,
            body: {
                data: {
                    type: 'users',
                    id: '11',
                    attributes: {
                        login: 'first',
                    },
                    relationships: {
                        notes: {
                            data: [
                                {
                                    id: '12',
                                    type: 'notes',
                                },
                                {
                                    id: '13',
                                    type: 'notes',
                                },
                            ],
                            links: {
                                first: undefined,
                                last: undefined,
                                next: undefined,
                                prev: undefined,
                                self: 'www.example.com/api/v1/users/11/relationships/notes',
                                related: 'www.example.com/api/v1/users/11/notes',
                            },
                            meta: {
                                total: 2,
                                totalPages: 1,
                                pageNumber: 0,
                                pageSize: 4,
                            },
                        },
                    },
                    meta: {},
                },
                included: [],
                links: {
                    self: 'www.example.com/api/v1/users/11',
                },
                meta: {},
            },
        });
    });

    test('should return not-found user', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(context, 'GET', 'www.example.com/api/v1/users/10', '');

        assert.deepStrictEqual(result, {
            status: 404,
            body: {
                data: null,
                included: [],
                links: {
                    self: 'www.example.com/api/v1/users/10',
                },
                meta: {},
            },
        });
    });

    test('should return user notes', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(
            context,
            'GET',
            'www.example.com/api/v1/users/11/relationships/notes',
            '',
        );

        assert.deepStrictEqual(result, {
            status: 200,
            body: {
                data: [
                    {
                        type: 'notes',
                        id: '12',
                    },
                    {
                        type: 'notes',
                        id: '13',
                    },
                ],
                included: [],
                links: {
                    first: undefined,
                    last: undefined,
                    next: undefined,
                    prev: undefined,
                    related: 'www.example.com/api/v1/users/11/notes',
                    self: 'www.example.com/api/v1/users/11/relationships/notes',
                },
                meta: {
                    total: 2,
                    totalPages: 1,
                    pageNumber: 0,
                    pageSize: 10,
                },
            },
        });
    });

    test('should return error of adding tag', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(context, 'POST', 'www.example.com/api/v1/tags', {
            data: {},
        });

        assert.deepStrictEqual(result, {
            status: 422,
            body: {
                errors: [
                    {
                        details: 'Should be existed.',
                        pointer: ['', 'data', 'type'],
                    },
                    {
                        details: 'Should be existed.',
                        pointer: ['', 'data', 'attributes'],
                    },
                    {
                        details: 'Should be existed.',
                        pointer: ['', 'data', 'relationships'],
                    },
                ],
            },
        });
    });

    test('should return data after adding tag', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(context, 'POST', 'www.example.com/api/v1/tags', {
            data: {
                type: 'tags',
                attributes: {
                    name: 'new-tag',
                },
                relationships: {
                    note: {
                        type: 'notes',
                        id: '12',
                    },
                },
            },
        });

        assert('data' in result.body);
        assert(result.body.data !== null);
        assert('id' in result.body.data);
        const id = result.body.data.id;

        assert.deepStrictEqual(result, {
            status: 200,
            body: {
                data: {
                    id,
                    type: 'tags',
                    attributes: {
                        name: 'new-tag',
                    },
                    relationships: {
                        note: {
                            data: {
                                type: 'notes',
                                id: '12',
                            },
                            links: {
                                related: `www.example.com/api/v1/tags/${id}/note`,
                                self: `www.example.com/api/v1/tags/${id}/relationships/note`,
                            },
                            meta: {},
                        },
                    },
                    meta: {},
                },
                meta: {},
                included: [],
                links: {
                    self: `www.example.com/api/v1/tags/${id}`,
                },
            },
        });
    });

    test('should return data after updating tag', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(context, 'PATCH', 'www.example.com/api/v1/tags/23', {
            data: {
                id: '23',
                type: 'tags',
                attributes: {
                    name: 'jazz',
                },
                relationships: {},
            },
        });

        const id = '23';

        assert.deepStrictEqual(result, {
            status: 200,
            body: {
                data: {
                    id,
                    type: 'tags',
                    attributes: {
                        name: 'jazz',
                    },
                    relationships: {
                        note: {
                            data: {
                                type: 'notes',
                                id: '12',
                            },
                            links: {
                                related: `www.example.com/api/v1/tags/${id}/note`,
                                self: `www.example.com/api/v1/tags/${id}/relationships/note`,
                            },
                            meta: {},
                        },
                    },
                    meta: {},
                },
                meta: {},
                included: [],
                links: {
                    self: `www.example.com/api/v1/tags/${id}`,
                },
            },
        });
    });

    test('should return null data after removing tag', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(context, 'DELETE', 'www.example.com/api/v1/tags/23', '');

        const id = '23';

        assert.deepStrictEqual(result, {
            status: 200,
            body: {
                data: null,
                meta: {},
                included: [],
                links: {
                    self: `www.example.com/api/v1/tags/${id}`,
                },
            },
        });
    });

    test('should return note tags after adding tags', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(
            context,
            'POST',
            'www.example.com/api/v1/notes/12/relationships/tags',
            {
                data: [
                    {
                        type: 'tags',
                        id: '25',
                    },
                ],
            },
        );

        assert.deepStrictEqual(result, {
            status: 200,
            body: {
                data: [
                    {
                        type: 'tags',
                        id: '23',
                    },
                    {
                        type: 'tags',
                        id: '24',
                    },
                    {
                        type: 'tags',
                        id: '25',
                    },
                    {
                        type: 'tags',
                        id: '26',
                    },
                ],
                included: [],
                links: {
                    first: undefined,
                    last: undefined,
                    next: undefined,
                    prev: undefined,
                    related: 'www.example.com/api/v1/notes/12/tags',
                    self: 'www.example.com/api/v1/notes/12/relationships/tags',
                },
                meta: {
                    pageNumber: 0,
                    pageSize: 4,
                    total: 4,
                    totalPages: 1,
                },
            },
        });
    });

    test('should return note tags after updating tags', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(
            context,
            'PATCH',
            'www.example.com/api/v1/notes/12/relationships/tags',
            {
                data: [
                    {
                        type: 'tags',
                        id: '25',
                    },
                ],
            },
        );

        assert.deepStrictEqual(result, {
            status: 200,
            body: {
                data: [
                    {
                        type: 'tags',
                        id: '25',
                    },
                ],
                included: [],
                links: {
                    first: undefined,
                    last: undefined,
                    next: undefined,
                    prev: undefined,
                    related: 'www.example.com/api/v1/notes/12/tags',
                    self: 'www.example.com/api/v1/notes/12/relationships/tags',
                },
                meta: {
                    pageNumber: 0,
                    pageSize: 4,
                    total: 1,
                    totalPages: 1,
                },
            },
        });
    });

    test('should return note tags after removing tags', async () => {
        const serverHandler = makeServerHandler();
        const result = await serverHandler.handle(
            context,
            'DELETE',
            'www.example.com/api/v1/notes/12/relationships/tags',
            {
                data: [
                    {
                        type: 'tags',
                        id: '26',
                    },
                ],
            },
        );

        assert.deepStrictEqual(result, {
            status: 200,
            body: {
                data: [
                    {
                        type: 'tags',
                        id: '23',
                    },
                    {
                        type: 'tags',
                        id: '24',
                    },
                ],
                included: [],
                links: {
                    first: undefined,
                    last: undefined,
                    next: undefined,
                    prev: undefined,
                    related: 'www.example.com/api/v1/notes/12/tags',
                    self: 'www.example.com/api/v1/notes/12/relationships/tags',
                },
                meta: {
                    pageNumber: 0,
                    pageSize: 4,
                    total: 2,
                    totalPages: 1,
                },
            },
        });
    });

    test('should return operation results', async () => {
        const serverHandler = makeServerHandler();
        const results = await serverHandler.handle(context, 'POST', 'www.example.com/api/v1/operations', {
            'atomic:operations': [
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
            ],
        });

        assert(
            results.body &&
                typeof results.body === 'object' &&
                'atomic:results' in results.body &&
                Array.isArray(results.body['atomic:results']),
        );

        assert(
            results.body['atomic:results'][0] !== null &&
                typeof results.body['atomic:results'][0] === 'object' &&
                results.body['atomic:results'][0].data &&
                'id' in results.body['atomic:results'][0].data,
        );
        const noteId = results.body['atomic:results'][0].data.id;
        assert(
            results.body['atomic:results'][1] !== null &&
                typeof results.body['atomic:results'][1] === 'object' &&
                results.body['atomic:results'][1].data &&
                'id' in results.body['atomic:results'][1].data,
        );
        const tagId = results.body['atomic:results'][1].data.id;

        assert.deepStrictEqual(results, {
            status: 200,
            body: {
                'atomic:results': [
                    {
                        data: {
                            attributes: {
                                created_at: 0,
                                links: [],
                                text: '',
                                title: 'New Note',
                            },
                            id: noteId,
                            meta: {},
                            relationships: {
                                author: {
                                    data: {
                                        id: '0',
                                        type: 'users',
                                    },
                                    links: {
                                        related: `www.example.com/api/v1/notes/${noteId}/author`,
                                        self: `www.example.com/api/v1/notes/${noteId}/relationships/author`,
                                    },
                                    meta: {},
                                },
                                tags: {
                                    data: [],
                                    links: {
                                        related: `www.example.com/api/v1/notes/${noteId}/tags`,
                                        self: `www.example.com/api/v1/notes/${noteId}/relationships/tags`,
                                    },
                                    meta: {
                                        pageNumber: 0,
                                        pageSize: 4,
                                        total: 0,
                                        totalPages: 0,
                                    },
                                },
                            },
                            type: 'notes',
                        },
                        included: [],
                        links: {
                            self: `www.example.com/api/v1/notes/${noteId}`,
                        },
                        meta: {},
                    },
                    {
                        data: {
                            attributes: {
                                name: 'new one',
                            },
                            id: tagId,
                            meta: {},
                            relationships: {
                                note: {
                                    data: {
                                        id: noteId,
                                        type: 'notes',
                                    },
                                    links: {
                                        related: `www.example.com/api/v1/tags/${tagId}/note`,
                                        self: `www.example.com/api/v1/tags/${tagId}/relationships/note`,
                                    },
                                    meta: {},
                                },
                            },
                            type: 'tags',
                        },
                        included: [],
                        links: {
                            self: `www.example.com/api/v1/tags/${tagId}`,
                        },
                        meta: {},
                    },
                ],
            },
        });
    });
});
