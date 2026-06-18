import { ErrorSet, Result, schemas } from '@just-io/schema';
import { DefaultPage } from '../../server/defaults';
import { FetchResourceOptions, ResourceKeeper, ResourceStatus } from '../../server/resource-keeper';
import { RelationshipOptions, ResourceSchema } from '../../server/resource-schema';
import { DataList, ResourceIdentifier } from '../../types/common';
import { EditableResource, NewResource, Resource } from '../../types/resource-declaration';
import { fetchTagsByNoteId, makeID, Note, Store } from './store';
import { Context } from './types';
import { CommonError } from '../../types/formats';

export type NoteDeclaration = {
    type: 'notes';
    attributes: {
        title: {
            type: string;
            mode: 'editable';
        };
        text: {
            type: string;
            mode: 'editable';
            optional: true;
        };
        created_at: {
            type: number;
            mode: 'readonly';
        };
        links: {
            type: string[];
            mode: 'editable';
            optional: true;
        };
    };
    relationships: {
        author: {
            types: 'users';
            mode: 'unchangeable';
            optional: true;
        };
        tags: {
            types: 'tags';
            multiple: true;
            mode: 'editable';
        };
    };
    listable: {
        status: true;
        filter: Record<string, never>;
        sort: Record<string, never>;
    };
    addable: true;
    updatable: true;
    removable: true;
};

export class NotesResourceKeeper extends ResourceKeeper<NoteDeclaration, Context, DefaultPage> {
    #store: Store;

    constructor(store: Store) {
        super();
        this.#store = store;
    }

    schema: ResourceSchema<NoteDeclaration, Context, DefaultPage> = {
        type: 'notes',
        attributes: {
            title: {
                schema: schemas.string(),
                mode: 'editable',
            },
            text: {
                schema: schemas.string(),
                mode: 'editable',
                optional: true,
            },
            created_at: {
                mode: 'readonly',
            },
            links: {
                schema: schemas.array(schemas.string()),
                mode: 'editable',
                optional: true,
            },
        },
        relationships: {
            tags: {
                types: ['tags'],
                multiple: true,
                mode: 'editable',
                get: async (
                    context: Context,
                    resourceIds: string[],
                    options: RelationshipOptions<DefaultPage>,
                ): Promise<Record<string, DataList<ResourceIdentifier<'tags'>>>> => {
                    const limit = options.asMain
                        ? options.page?.size ?? 4
                        : options.page?.relationships?.tags?.size ?? 4;
                    const offset = options.asMain ? (options.page?.number ?? 0) * limit : 0;

                    return Object.fromEntries(
                        resourceIds.map((resourceId) => [
                            resourceId,
                            fetchTagsByNoteId(this.#store, resourceId, limit, offset),
                        ]),
                    );
                },
                add: async (
                    context: Context,
                    resourceId: string,
                    resourceIdentifiers: ResourceIdentifier<'tags'>[],
                ): Promise<Result<void, ErrorSet<CommonError>>> => {
                    this.#store.tags.forEach((tag) => {
                        if (resourceIdentifiers.find((rId) => rId.id === tag.id)) {
                            tag.note_id = resourceId;
                        }
                    });

                    return {
                        ok: true,
                        value: undefined,
                    };
                },
                update: async (
                    context: Context,
                    resourceId: string,
                    resourceIdentifiers: ResourceIdentifier<'tags'>[],
                ): Promise<Result<void, ErrorSet<CommonError>>> => {
                    const ids = resourceIdentifiers.map((rId) => rId.id);
                    for (let i = 0; i < this.#store.tags.length; i++) {
                        if (this.#store.tags[i].note_id === resourceId && !ids.includes(this.#store.tags[i].id)) {
                            this.#store.tags.splice(i, 1);
                            i--;
                            continue;
                        }
                        if (ids.includes(this.#store.tags[i].id)) {
                            this.#store.tags[i].note_id = resourceId;
                        }
                    }

                    return {
                        ok: true,
                        value: undefined,
                    };
                },
                remove: async (
                    context: Context,
                    resourceId: string,
                    resourceIdentifiers: ResourceIdentifier<'tags'>[],
                ): Promise<Result<void, ErrorSet<CommonError>>> => {
                    const ids = resourceIdentifiers.map((rId) => rId.id);
                    for (let i = 0; i < this.#store.tags.length; i++) {
                        if (ids.includes(this.#store.tags[i].id)) {
                            this.#store.tags.splice(i, 1);
                            i--;
                            continue;
                        }
                    }

                    return {
                        ok: true,
                        value: undefined,
                    };
                },
            },
            author: {
                types: ['users'],
                mode: 'unchangeable',
                optional: true,
                get: async (
                    context: Context,
                    resourceIds: string[],
                ): Promise<Record<string, ResourceIdentifier<'users'>>> => {
                    return Object.fromEntries(
                        resourceIds.map((resourceId) => {
                            const note = this.#store.notes.find((aNote) => aNote.id === resourceId);

                            return [
                                resourceId,
                                {
                                    type: 'users',
                                    id: note!.user_id,
                                },
                            ];
                        }),
                    );
                },
            },
        },
        filter: {},
        sort: {},
        listable: true,
        addable: true,
        updatable: true,
        removable: true,
    };

    async status(context: Context, ids: string[]): Promise<Record<string, ResourceStatus>> {
        const notes = this.#store.notes.filter((aNote) => ids.includes(aNote.id));
        const noteStatuses: Record<string, ResourceStatus> = {};
        for (const note of notes) {
            if (note) {
                if (context.role === 'admin') {
                    noteStatuses[note.id] = { type: 'exist' };
                } else {
                    if (note.user_id === context.userId) {
                        noteStatuses[note.id] = { type: 'exist' };
                    } else {
                        noteStatuses[note.id] = { type: 'forbidden' };
                    }
                }
            }
        }
        for (const id of ids) {
            if (!noteStatuses[id]) {
                noteStatuses[id] = { type: 'not-found' };
            }
        }

        return noteStatuses;
    }

    async get(
        context: Context,
        ids: string[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: Pick<FetchResourceOptions<NoteDeclaration, DefaultPage>, 'page'>,
    ): Promise<Resource<NoteDeclaration>[]> {
        return ids.map((id) => {
            const note = this.#store.notes.find((aNote) => aNote.id === id)!;
            return {
                id: note.id,
                type: 'notes',
                attributes: {
                    title: note.title,
                    text: note.text,
                    created_at: note.created_at,
                    links: note.links,
                },
                relationships: {
                    author: {
                        type: 'users',
                        id: note.user_id,
                    },
                    tags: fetchTagsByNoteId(this.#store, note.id, options.page?.relationships?.tags?.size ?? 4, 0),
                },
            } satisfies Resource<NoteDeclaration>;
        });
    }

    async list(
        context: Context,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: FetchResourceOptions<NoteDeclaration, DefaultPage>,
    ): Promise<Result<DataList<Resource<NoteDeclaration>>, ErrorSet<CommonError>>> {
        let notes: Note[];
        if (context.role === 'admin') {
            notes = this.#store.notes;
        } else {
            notes = this.#store.notes.filter((aNote) => aNote.user_id === context.userId);
        }
        const limit = options.page?.size ?? 10;
        const offset = (options.page?.number ?? 0) * limit;

        return {
            ok: true,
            value: {
                items: notes
                    .map(
                        (note) =>
                            ({
                                id: note.id,
                                type: 'notes',
                                attributes: {
                                    title: note.title,
                                    text: note.text,
                                    created_at: note.created_at,
                                    links: note.links,
                                },
                                relationships: {
                                    author: {
                                        type: 'users',
                                        id: note.user_id,
                                    },
                                    tags: fetchTagsByNoteId(
                                        this.#store,
                                        note.id,
                                        options.page?.relationships?.tags?.size ?? 4,
                                        0,
                                    ),
                                },
                            }) satisfies Resource<NoteDeclaration>,
                    )
                    .slice(offset, offset + limit),
                limit,
                offset,
                total: notes.length,
            },
        };
    }

    async add(
        context: Context,
        resource: NewResource<NoteDeclaration>,
    ): Promise<Result<string, ErrorSet<CommonError>>> {
        const id = resource.id ?? makeID();
        const note: Note = {
            id,
            title: resource.attributes.title,
            text: resource.attributes.text ?? '',
            user_id: resource.relationships.author?.id ?? context.userId,
            created_at: 0,
            links: resource.attributes.links ?? [],
        };
        this.#store.notes.push(note);

        return {
            ok: true,
            value: id,
        };
    }

    async update(
        context: Context,
        resource: EditableResource<NoteDeclaration>,
    ): Promise<Result<void, ErrorSet<CommonError>>> {
        const note = this.#store.notes.find((aNote) => aNote.id === resource.id)!;
        if (resource.attributes.text !== undefined) {
            note.text = resource.attributes.text;
        }
        if (resource.attributes.title !== undefined) {
            note.title = resource.attributes.title;
        }
        if (resource.attributes.links) {
            note.links = resource.attributes.links;
        }

        return {
            ok: true,
            value: undefined,
        };
    }

    async remove(context: Context, id: string): Promise<Result<void, ErrorSet<CommonError>>> {
        const i = this.#store.notes.findIndex((note) => note.id === id);
        if (i !== -1) {
            this.#store.notes.splice(i, 1);
        }

        return {
            ok: true,
            value: undefined,
        };
    }
}
