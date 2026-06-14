import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';

import {
    Context,
    makeClient,
    makeObserver,
    makeResourceManager,
    makeResourceObserver,
    makeServerHandler,
    NoteDeclaration,
} from '../prepare';
import { ObservationEvent } from '../../types/observer';

describe('Observer', () => {
    describe('method observe', () => {
        test.only('should handle adding resource', async () => {
            const context: Context = {
                role: 'user',
                userId: '11',
            };
            const resourceManager = makeResourceManager();
            const serverHandler = makeServerHandler(resourceManager);
            const resourceObserver = makeResourceObserver(resourceManager);
            const client = makeClient(serverHandler);
            const observer = makeObserver(context, resourceObserver);

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

            observer.observe(
                {
                    types: {
                        notes: {
                            adding: true,
                        },
                    },
                },
                callback,
            );

            await client
                .add<NoteDeclaration>({
                    type: 'notes',
                    attributes: {
                        title: 'New Note',
                    },
                    relationships: {
                        tags: [],
                    },
                })
                .exec(context);

            await new Promise((res) => setTimeout(res, 0));
            assert.equal(fn.mock.callCount(), 1);
        });
    });
});
