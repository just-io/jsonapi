import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Context, makeClient, NoteDeclaration, TagDeclaration, UserDeclaration } from './prepare';
import { operation } from '../server/operation';

describe('Client', () => {
    const context: Context = {
        role: 'admin',
        userId: '0',
    };

    describe('method get', () => {
        test('should return resource result', async () => {
            const client = makeClient();

            const result = await client
                .get<NoteDeclaration>('notes', '12')
                .fields('title', 'tags')
                .include<TagDeclaration, 'name'>('tags', 'tags', 'name')
                .page({
                    relationships: {
                        tags: {
                            size: 4,
                        },
                    },
                })
                .exec(context);

            assert.deepStrictEqual(result, {
                data: {
                    attributes: {
                        title: 'First Note',
                    },
                    id: '12',
                    meta: {},
                    relationships: {
                        tags: {
                            data: [
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
                                total: 3,
                                totalPages: 1,
                            },
                        },
                    },
                    type: 'notes',
                },
                included: [
                    {
                        attributes: {
                            name: 'action',
                        },
                        id: '23',
                        links: {
                            self: 'www.example.com/api/v1/tags/23',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                    {
                        attributes: {
                            name: 'movie',
                        },
                        id: '24',
                        links: {
                            self: 'www.example.com/api/v1/tags/24',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                    {
                        attributes: {
                            name: 'drama',
                        },
                        id: '26',
                        links: {
                            self: 'www.example.com/api/v1/tags/26',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                ],
                links: {
                    self: 'www.example.com/api/v1/notes/12?include=tags&fields%5Bnotes%5D=title%2Ctags&fields%5Btags%5D=name&page%5Brelationships%5D%5Btags%5D%5Bsize%5D=4',
                },
                meta: {},
            });
        });

        test('should return null result', async () => {
            const client = makeClient();

            const result = await client
                .get<NoteDeclaration>('notes', '10')
                .fields('title', 'tags')
                .include<TagDeclaration, 'name'>('tags', 'tags', 'name')
                .exec(context);

            assert.deepStrictEqual(result, {
                data: null,
                included: [],
                links: {
                    self: 'www.example.com/api/v1/notes/10?include=tags&fields%5Bnotes%5D=title%2Ctags&fields%5Btags%5D=name',
                },
                meta: {},
            });
        });
    });

    describe('method list', () => {
        test('should return resources result', async () => {
            const client = makeClient();

            const result = await client
                .list<UserDeclaration>('users')
                .fields('notes')
                .include<NoteDeclaration, 'title'>('notes', 'notes', 'title')
                .filter('login', 'first')
                .sort('login', false)
                .page({ number: 0, size: 1, relationships: { notes: { size: 10 } } })
                .exec(context);

            assert.deepStrictEqual(result, {
                data: [
                    {
                        attributes: {},
                        id: '11',
                        links: {
                            self: 'www.example.com/api/v1/users/11',
                        },
                        meta: {},
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
                                    related: 'www.example.com/api/v1/users/11/notes',
                                    self: 'www.example.com/api/v1/users/11/relationships/notes',
                                },
                                meta: {
                                    pageNumber: 0,
                                    pageSize: 4,
                                    total: 2,
                                    totalPages: 1,
                                },
                            },
                        },
                        type: 'users',
                    },
                ],
                included: [
                    {
                        attributes: {
                            title: 'First Note',
                        },
                        id: '12',
                        links: {
                            self: 'www.example.com/api/v1/notes/12',
                        },
                        meta: {},
                        relationships: {},
                        type: 'notes',
                    },
                    {
                        attributes: {
                            title: 'Second Note',
                        },
                        id: '13',
                        links: {
                            self: 'www.example.com/api/v1/notes/13',
                        },
                        meta: {},
                        relationships: {},
                        type: 'notes',
                    },
                ],
                links: {
                    first: undefined,
                    last: undefined,
                    next: undefined,
                    prev: undefined,
                    self: 'www.example.com/api/v1/users?include=notes&fields%5Busers%5D=notes&fields%5Bnotes%5D=title&filter%5Blogin%5D=first&page%5Bnumber%5D=0&page%5Bsize%5D=1&page%5Brelationships%5D%5Bnotes%5D%5Bsize%5D=10&sort=-login',
                },
                meta: {
                    pageNumber: 0,
                    pageSize: 1,
                    total: 1,
                    totalPages: 1,
                },
            });
        });
    });

    describe('method relationship', () => {
        test('should return resources result', async () => {
            const client = makeClient();

            const result = await client
                .relationship<UserDeclaration, 'notes'>('users', '11', 'notes')
                .include<NoteDeclaration, 'title'>('notes', 'notes', 'title')
                .page({ number: 0, size: 1, relationships: { notes: { size: 10 } } })
                .exec(context);

            assert.deepStrictEqual(result, {
                data: [
                    {
                        id: '12',
                        type: 'notes',
                    },
                ],
                included: [
                    {
                        attributes: {
                            title: 'First Note',
                        },
                        id: '12',
                        links: {
                            self: 'www.example.com/api/v1/notes/12',
                        },
                        meta: {},
                        relationships: {},
                        type: 'notes',
                    },
                ],
                links: {
                    first: 'www.example.com/api/v1/users/11/relationships/notes?include=notes&fields%5Bnotes%5D=title&page%5Bnumber%5D=0&page%5Bsize%5D=1&page%5Brelationships%5D%5Bnotes%5D%5Bsize%5D=10',
                    last: 'www.example.com/api/v1/users/11/relationships/notes?include=notes&fields%5Bnotes%5D=title&page%5Bnumber%5D=1&page%5Bsize%5D=1&page%5Brelationships%5D%5Bnotes%5D%5Bsize%5D=10',
                    next: 'www.example.com/api/v1/users/11/relationships/notes?include=notes&fields%5Bnotes%5D=title&page%5Bnumber%5D=1&page%5Bsize%5D=1&page%5Brelationships%5D%5Bnotes%5D%5Bsize%5D=10',
                    prev: undefined,
                    related:
                        'www.example.com/api/v1/users/11/notes?include=notes&fields%5Bnotes%5D=title&page%5Bnumber%5D=0&page%5Bsize%5D=1&page%5Brelationships%5D%5Bnotes%5D%5Bsize%5D=10',
                    self: 'www.example.com/api/v1/users/11/relationships/notes?include=notes&fields%5Bnotes%5D=title&page%5Bnumber%5D=0&page%5Bsize%5D=1&page%5Brelationships%5D%5Bnotes%5D%5Bsize%5D=10',
                },
                meta: {
                    pageNumber: 0,
                    pageSize: 1,
                    total: 2,
                    totalPages: 2,
                },
            });
        });
    });

    describe('method add', () => {
        test('should return added resource result', async () => {
            const client = makeClient();

            const result = await client
                .add<NoteDeclaration>({
                    type: 'notes',
                    attributes: {
                        title: 'New Note',
                    },
                    relationships: {
                        tags: [],
                    },
                })
                .fields('title', 'tags')
                .include<TagDeclaration, 'name'>('tags', 'tags', 'name')
                .page({
                    relationships: {
                        tags: {
                            size: 4,
                        },
                    },
                })
                .exec(context);

            const noteId = result.data.id;

            assert.deepStrictEqual(result, {
                data: {
                    attributes: {
                        title: 'New Note',
                    },
                    id: noteId,
                    meta: {},
                    relationships: {
                        tags: {
                            data: [],
                            links: {
                                first: undefined,
                                last: undefined,
                                next: undefined,
                                prev: undefined,
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
                    self: `www.example.com/api/v1/notes/${noteId}?include=tags&fields%5Bnotes%5D=title%2Ctags&fields%5Btags%5D=name&page%5Brelationships%5D%5Btags%5D%5Bsize%5D=4`,
                },
                meta: {},
            });
        });
    });

    describe('method update', () => {
        test('should return updated resource result', async () => {
            const client = makeClient();

            const result = await client
                .update<NoteDeclaration>({
                    type: 'notes',
                    id: '12',
                    attributes: {
                        title: 'New name',
                    },
                    relationships: {
                        tags: [],
                    },
                })
                .fields('title', 'tags')
                .include<TagDeclaration, 'name'>('tags', 'tags', 'name')
                .page({
                    relationships: {
                        tags: {
                            size: 4,
                        },
                    },
                })
                .exec(context);

            assert.deepStrictEqual(result, {
                data: {
                    attributes: {
                        title: 'New name',
                    },
                    id: '12',
                    meta: {},
                    relationships: {
                        tags: {
                            data: [
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
                                total: 3,
                                totalPages: 1,
                            },
                        },
                    },
                    type: 'notes',
                },
                included: [
                    {
                        attributes: {
                            name: 'action',
                        },
                        id: '23',
                        links: {
                            self: 'www.example.com/api/v1/tags/23',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                    {
                        attributes: {
                            name: 'movie',
                        },
                        id: '24',
                        links: {
                            self: 'www.example.com/api/v1/tags/24',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                    {
                        attributes: {
                            name: 'drama',
                        },
                        id: '26',
                        links: {
                            self: 'www.example.com/api/v1/tags/26',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                ],
                links: {
                    self: 'www.example.com/api/v1/notes/12?include=tags&fields%5Bnotes%5D=title%2Ctags&fields%5Btags%5D=name&page%5Brelationships%5D%5Btags%5D%5Bsize%5D=4',
                },
                meta: {},
            });
        });
    });

    describe('method remove', () => {
        test('should return null result', async () => {
            const client = makeClient();

            const result = await client.remove<NoteDeclaration>('notes', '12').exec(context);

            assert.deepStrictEqual(result, {
                data: null,
                included: [],
                links: {
                    self: 'www.example.com/api/v1/notes/12',
                },
                meta: {},
            });
        });
    });

    describe('method addRelationship', () => {
        test('should return updated resource result', async () => {
            const client = makeClient();

            const result = await client
                .addRelationship<NoteDeclaration, 'tags'>('notes', '12', 'tags', [
                    {
                        id: '25',
                        type: 'tags',
                    },
                ])
                .include<TagDeclaration, 'name'>('tags', 'tags', 'name')
                .page({
                    relationships: {
                        tags: {
                            size: 4,
                        },
                    },
                })
                .exec(context);

            assert.deepStrictEqual(result, {
                data: [
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
                included: [
                    {
                        attributes: {
                            name: 'action',
                        },
                        id: '23',
                        links: {
                            self: 'www.example.com/api/v1/tags/23',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                    {
                        attributes: {
                            name: 'movie',
                        },
                        id: '24',
                        links: {
                            self: 'www.example.com/api/v1/tags/24',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                    {
                        attributes: {
                            name: 'fantasy',
                        },
                        id: '25',
                        links: {
                            self: 'www.example.com/api/v1/tags/25',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                    {
                        attributes: {
                            name: 'drama',
                        },
                        id: '26',
                        links: {
                            self: 'www.example.com/api/v1/tags/26',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                ],
                links: {
                    first: undefined,
                    last: undefined,
                    next: undefined,
                    prev: undefined,
                    related:
                        'www.example.com/api/v1/notes/12/tags?include=tags&fields%5Btags%5D=name&page%5Brelationships%5D%5Btags%5D%5Bsize%5D=4',
                    self: 'www.example.com/api/v1/notes/12/relationships/tags?include=tags&fields%5Btags%5D=name&page%5Brelationships%5D%5Btags%5D%5Bsize%5D=4',
                },
                meta: {
                    pageNumber: 0,
                    pageSize: 4,
                    total: 4,
                    totalPages: 1,
                },
            });
        });
    });

    describe('method updateRelationship', () => {
        test('should return updated resource result', async () => {
            const client = makeClient();

            const result = await client
                .updateRelationship<NoteDeclaration, 'tags'>('notes', '12', 'tags', [
                    {
                        id: '25',
                        type: 'tags',
                    },
                ])
                .include<TagDeclaration, 'name'>('tags', 'tags', 'name')
                .page({
                    relationships: {
                        tags: {
                            size: 4,
                        },
                    },
                })
                .exec(context);

            assert.deepStrictEqual(result, {
                data: [
                    {
                        id: '25',
                        type: 'tags',
                    },
                ],
                included: [
                    {
                        attributes: {
                            name: 'fantasy',
                        },
                        id: '25',
                        links: {
                            self: 'www.example.com/api/v1/tags/25',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                ],
                links: {
                    first: undefined,
                    last: undefined,
                    next: undefined,
                    prev: undefined,
                    related:
                        'www.example.com/api/v1/notes/12/tags?include=tags&fields%5Btags%5D=name&page%5Brelationships%5D%5Btags%5D%5Bsize%5D=4',
                    self: 'www.example.com/api/v1/notes/12/relationships/tags?include=tags&fields%5Btags%5D=name&page%5Brelationships%5D%5Btags%5D%5Bsize%5D=4',
                },
                meta: {
                    pageNumber: 0,
                    pageSize: 4,
                    total: 1,
                    totalPages: 1,
                },
            });
        });
    });

    describe('method removeRelationship', () => {
        test('should return updated resource result', async () => {
            const client = makeClient();

            const result = await client
                .removeRelationship<NoteDeclaration, 'tags'>('notes', '12', 'tags', [
                    {
                        id: '26',
                        type: 'tags',
                    },
                ])
                .include<TagDeclaration, 'name'>('tags', 'tags', 'name')
                .page({
                    relationships: {
                        tags: {
                            size: 4,
                        },
                    },
                })
                .exec(context);

            assert.deepStrictEqual(result, {
                data: [
                    {
                        id: '23',
                        type: 'tags',
                    },
                    {
                        id: '24',
                        type: 'tags',
                    },
                ],
                included: [
                    {
                        attributes: {
                            name: 'action',
                        },
                        id: '23',
                        links: {
                            self: 'www.example.com/api/v1/tags/23',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                    {
                        attributes: {
                            name: 'movie',
                        },
                        id: '24',
                        links: {
                            self: 'www.example.com/api/v1/tags/24',
                        },
                        meta: {},
                        relationships: {},
                        type: 'tags',
                    },
                ],
                links: {
                    first: undefined,
                    last: undefined,
                    next: undefined,
                    prev: undefined,
                    related:
                        'www.example.com/api/v1/notes/12/tags?include=tags&fields%5Btags%5D=name&page%5Brelationships%5D%5Btags%5D%5Bsize%5D=4',
                    self: 'www.example.com/api/v1/notes/12/relationships/tags?include=tags&fields%5Btags%5D=name&page%5Brelationships%5D%5Btags%5D%5Bsize%5D=4',
                },
                meta: {
                    pageNumber: 0,
                    pageSize: 4,
                    total: 2,
                    totalPages: 1,
                },
            });
        });
    });

    describe('method operations', () => {
        test('should return resource result', async () => {
            const client = makeClient();

            const result = await client
                .operations([
                    operation.add<NoteDeclaration>({
                        type: 'notes',
                        lid: 'new-note',
                        attributes: {
                            title: 'New Note',
                        },
                        relationships: {
                            tags: [],
                        },
                    }),
                    operation.addRelationships<NoteDeclaration, 'tags'>(
                        {
                            type: 'notes',
                            lid: 'new-note',
                            relationship: 'tags',
                        },
                        [
                            {
                                type: 'tags',
                                id: '25',
                            },
                        ],
                    ),
                ])
                .exec(context);

            const noteId = result['atomic:results'][0].data.id;

            assert.deepStrictEqual(result, {
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
                                        first: undefined,
                                        last: undefined,
                                        next: undefined,
                                        prev: undefined,
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
                        data: [
                            {
                                id: '25',
                                type: 'tags',
                            },
                        ],
                        included: [],
                        links: {
                            first: undefined,
                            last: undefined,
                            next: undefined,
                            prev: undefined,
                            related: `www.example.com/api/v1/notes/${noteId}/tags`,
                            self: `www.example.com/api/v1/notes/${noteId}/relationships/tags`,
                        },
                        meta: {
                            pageNumber: 0,
                            pageSize: 4,
                            total: 1,
                            totalPages: 1,
                        },
                    },
                ],
            });
        });
    });
});
