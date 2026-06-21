import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';

import { Context, makeResourceManager, makeResourceObserver, NoteDeclaration, TagDeclaration } from '../prepare';
import { ObservationEvent } from '../../types/observer';

describe('ResourceObserver', () => {
    describe('method observe', () => {
        test('should return error ', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                assert.deepStrictEqual(observationEvents, []);
                fn();
            }

            const abortController = new AbortController();

            const result = await resourceObserver.observe(
                context,
                {
                    types: {
                        passwords: {
                            adding: true,
                        },
                    },
                    resources: {
                        books: {},
                        tags: {
                            '12': {
                                relationships: {
                                    category: true,
                                },
                            },
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            assert.ok(result.ok === false);
            assert.deepStrictEqual(result.error.toJSON(), [
                {
                    detail: 'The resource with type "passwords" is not existed.',
                    source: {
                        pointer: '/types/passwords',
                    },
                    status: 404,
                    title: 'Invalid Resource Type',
                },
                {
                    detail: 'The resource with type "books" is not existed.',
                    source: {
                        pointer: '/resources/books',
                    },
                    status: 404,
                    title: 'Invalid Resource Type',
                },
                {
                    detail: 'The resource with type "tags" does not have field "category".',
                    source: {
                        pointer: '/resources/tags/12/category',
                    },
                    status: 400,
                    title: 'Invalid Resource Field',
                },
            ]);
        });

        test('should handle adding resource', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                const id = observationEvents[0].id;
                const noteId = observationEvents[0].resourceIdentifier.id;
                assert.deepStrictEqual(observationEvents, [
                    {
                        id,
                        resourceIdentifier: {
                            id: noteId,
                            type: 'notes',
                        },
                        type: 'add',
                    },
                ]);
                fn();
            }

            const abortController = new AbortController();

            await resourceObserver.observe(
                context,
                {
                    types: {
                        notes: {
                            adding: true,
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            const { eventStore } = await resourceManager.add<NoteDeclaration>(
                context,
                { ref: { type: 'notes' } },
                {
                    type: 'notes',
                    attributes: {
                        title: 'title',
                    },
                    relationships: {
                        tags: [],
                    },
                },
            );

            eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 1);
        });

        test('should not handle adding resource after aborting', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                const id = observationEvents[0].id;
                const noteId = observationEvents[0].resourceIdentifier.id;
                assert.deepStrictEqual(observationEvents, [
                    {
                        id,
                        resourceIdentifier: {
                            id: noteId,
                            type: 'notes',
                        },
                        type: 'add',
                    },
                ]);
                fn();
            }

            const abortController = new AbortController();

            await resourceObserver.observe(
                context,
                {
                    types: {
                        notes: {
                            adding: true,
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            (
                await resourceManager.add<NoteDeclaration>(
                    context,
                    { ref: { type: 'notes' } },
                    {
                        type: 'notes',
                        attributes: {
                            title: 'title',
                        },
                        relationships: {
                            tags: [],
                        },
                    },
                )
            ).eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 1);

            abortController.abort();

            (
                await resourceManager.add<NoteDeclaration>(
                    context,
                    { ref: { type: 'notes' } },
                    {
                        type: 'notes',
                        attributes: {
                            title: 'title',
                        },
                        relationships: {
                            tags: [],
                        },
                    },
                )
            ).eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 1);
        });

        test('should not get adding resource of other', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const contextAnotherUser: Context = {
                role: 'user',
                userId: '12',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                assert.deepStrictEqual(observationEvents, []);
                fn();
            }

            const abortController = new AbortController();

            await resourceObserver.observe(
                context,
                {
                    types: {
                        notes: {
                            adding: true,
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            const { eventStore } = await resourceManager.add<NoteDeclaration>(
                contextAnotherUser,
                { ref: { type: 'notes' } },
                {
                    type: 'notes',
                    attributes: {
                        title: 'title',
                    },
                    relationships: {
                        tags: [],
                    },
                },
            );

            eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 0);
        });

        test('should handle updating resource', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                const id = observationEvents[0].id;
                assert.deepStrictEqual(observationEvents, [
                    {
                        id,
                        resourceIdentifier: {
                            id: '12',
                            type: 'notes',
                        },
                        type: 'update',
                    },
                ]);
                fn();
            }

            const abortController = new AbortController();

            await resourceObserver.observe(
                context,
                {
                    types: {
                        notes: {
                            updating: true,
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            const { eventStore } = await resourceManager.update<NoteDeclaration>(
                context,
                { ref: { type: 'notes', id: '12' } },
                {
                    type: 'notes',
                    id: '12',
                    attributes: {
                        title: 'new title',
                    },
                    relationships: {},
                },
            );

            eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 1);
        });

        test('should handle updating resource by id', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                const id = observationEvents[0].id;
                assert.deepStrictEqual(observationEvents, [
                    {
                        id,
                        resourceIdentifier: {
                            id: '12',
                            type: 'notes',
                        },
                        type: 'update',
                    },
                ]);
                fn();
            }

            const abortController = new AbortController();

            await resourceObserver.observe(
                context,
                {
                    resources: {
                        notes: {
                            '12': {},
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            const { eventStore } = await resourceManager.update<NoteDeclaration>(
                context,
                { ref: { type: 'notes', id: '12' } },
                {
                    type: 'notes',
                    id: '12',
                    attributes: {
                        title: 'new title',
                    },
                    relationships: {},
                },
            );

            eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 1);
        });

        test('should handle remove type', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                const id = observationEvents[0].id;
                assert.deepStrictEqual(observationEvents, [
                    {
                        id,
                        resourceIdentifier: {
                            id: '12',
                            type: 'notes',
                        },
                        type: 'remove',
                    },
                ]);
                fn();
            }

            const abortController = new AbortController();

            await resourceObserver.observe(
                context,
                {
                    resources: {
                        notes: {
                            '12': {},
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            const { eventStore } = await resourceManager.remove<NoteDeclaration>(context, {
                ref: { type: 'notes', id: '12' },
            });

            eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 1);
        });

        test('should handle update relationship resource', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                const id = observationEvents[0].id;
                assert.deepStrictEqual(observationEvents, [
                    {
                        id,
                        resourceIdentifier: {
                            id: '23',
                            type: 'tags',
                        },
                        type: 'update',
                    },
                ]);
                fn();
            }

            const abortController = new AbortController();

            await resourceObserver.observe(
                context,
                {
                    resources: {
                        notes: {
                            '12': {
                                relationships: {
                                    tags: true,
                                },
                            },
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            const { eventStore } = await resourceManager.update<TagDeclaration>(
                context,
                { ref: { type: 'tags', id: '23' } },
                {
                    type: 'tags',
                    id: '23',
                    attributes: {
                        name: 'new-tag',
                    },
                    relationships: {},
                },
            );

            eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 1);
        });

        test('should not handle update relationship resource', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                assert.deepStrictEqual(observationEvents, []);
                fn();
            }

            const abortController = new AbortController();

            await resourceObserver.observe(
                context,
                {
                    resources: {
                        notes: {
                            '12': {},
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            const { eventStore } = await resourceManager.update<TagDeclaration>(
                context,
                { ref: { type: 'tags', id: '23' } },
                {
                    type: 'tags',
                    id: '23',
                    attributes: {
                        name: 'new-tag',
                    },
                    relationships: {},
                },
            );

            eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 0);
        });

        test('should handle update relationship resource with one event', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                const id = observationEvents[0].id;
                assert.deepStrictEqual(observationEvents, [
                    {
                        id,
                        resourceIdentifier: {
                            id: '12',
                            type: 'notes',
                        },
                        type: 'update',
                    },
                ]);
                fn();
            }

            const abortController = new AbortController();

            await resourceObserver.observe(
                context,
                {
                    resources: {
                        tags: {
                            '23': {
                                relationships: {
                                    note: true,
                                },
                            },
                            '24': {
                                relationships: {
                                    note: true,
                                },
                            },
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            const { eventStore } = await resourceManager.update<NoteDeclaration>(
                context,
                { ref: { type: 'notes', id: '12' } },
                {
                    type: 'notes',
                    id: '12',
                    attributes: {
                        title: 'new title',
                    },
                    relationships: {},
                },
            );

            eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 1);
        });

        test('should handle update outer resource', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const resourceObserver = makeResourceObserver(resourceManager);

            const fn = mock.fn();
            function callback(observationEvents: ObservationEvent[]): void {
                const id = observationEvents[0].id;
                assert.deepStrictEqual(observationEvents, [
                    {
                        id,
                        resourceIdentifier: {
                            id: '23',
                            type: 'tags',
                        },
                        type: 'outer-update',
                    },
                ]);
                fn();
            }

            const abortController = new AbortController();

            await resourceObserver.observe(
                context,
                {
                    resources: {
                        notes: {
                            '12': {
                                outer: true,
                            },
                        },
                    },
                },
                callback,
                abortController.signal,
            );

            const { eventStore } = await resourceManager.update<TagDeclaration>(
                context,
                { ref: { type: 'tags', id: '23' } },
                {
                    type: 'tags',
                    id: '23',
                    attributes: {
                        name: 'new-tag',
                    },
                    relationships: {},
                },
            );

            eventStore.emit();

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 1);
        });
    });
});
