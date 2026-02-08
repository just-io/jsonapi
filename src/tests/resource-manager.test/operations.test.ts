import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Context, makeResourceManager, NoteDeclaration, TagDeclaration } from '../prepare';
import { operation } from '../../server/operation';
import { AddResourceOperation } from '../../types/common';

describe('ResourceManager', () => {
    describe('method operations', () => {
        const resourceManager = makeResourceManager();

        const context: Context = {
            role: 'user',
            userId: '11',
        };

        test('apply one operation', async () => {
            const { result } = await resourceManager.operations(context, [
                {
                    op: 'add',
                    data: {
                        type: 'notes',
                        attributes: {
                            title: 'New Note',
                        },
                        relationships: {
                            tags: [],
                        },
                    },
                } as AddResourceOperation<NoteDeclaration>,
            ]);
            assert.ok(result.ok === true);

            const id = result.value[0].id;

            assert.deepStrictEqual(result.value, [
                {
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
                            total: 0,
                            limit: 4,
                            offset: 0,
                        },
                    },
                },
            ]);
        });

        test('apply two operation with lid', async () => {
            const { result } = await resourceManager.operations(context, [
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
                operation.add<TagDeclaration>({
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
                }),
            ]);
            assert.ok(result.ok === true);

            const noteId = result.value[0].id;
            const tagId = result.value[1].id;

            assert.deepStrictEqual(result.value, [
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
        });

        test('should return error of add tag with invalid lid', async () => {
            const { result } = await resourceManager.operations(context, [
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
                } as AddResourceOperation<NoteDeclaration>,
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
                                lid: 'note',
                            },
                        },
                    },
                } as AddResourceOperation<TagDeclaration>,
            ]);
            assert.ok(result.ok === false);
            assert.deepStrictEqual(result.error.toJSON(), {
                errors: [
                    {
                        detail: 'The resource with lid does not have reference.',
                        source: {
                            pointer: '/1/data/relationships/note/lid',
                        },
                        status: 400,
                        title: 'Invalid Resource Lid',
                    },
                ],
            });
        });
    });
});
