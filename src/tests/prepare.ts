import { Client, Fetcher } from '../client';
import { DefaultMeta, DefaultPage, metaProvider, pageProvider } from '../defaults';
import { QueryConverter } from '../query-converter';
import { EditableResource, NewResource, Resource } from '../resource-declaration';
import { ResourceStatus, ResourceKeeper, ResourceOptions } from '../resource-keeper';
import { ResourceManager } from '../resource-manager';
import { RelationshipOptions, ResourceSchema } from '../resource-schema';
import schemas from '../schemas';
import { ServerHandler } from '../server-handler';
import { DataList, ResourceIdentifier } from '../types';

export type User = {
    id: string;
    login: string;
};

export type Note = {
    id: string;
    title: string;
    text: string;
    user_id: string;
    created_at: number;
    links: string[];
};

// implement
export type NoteTagRelationship = {
    note_id: string;
    tag_id: string;
};

export type Tag = {
    id: string;
    name: string;
    note_id: string;
};

export type UserDeclaration = {
    type: 'users';
    attributes: {
        login: {
            type: string;
            mode: 'readonly';
        };
    };
    relationships: {
        notes: {
            types: 'notes';
            multiple: true;
            mode: 'readonly';
        };
    };
    listable: {
        status: true;
        filter: {
            login: {
                multiple: true;
                type: string[];
            };
        };
        sort: {
            login: { dir: 'desc' };
        };
    };
    addable: false;
    updatable: false;
    removable: false;
};

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

export type TagDeclaration = {
    type: 'tags';
    attributes: {
        name: {
            type: string;
            mode: 'editable';
        };
    };
    relationships: {
        note: {
            types: 'notes';
            mode: 'editable';
        };
    };
    listable: {
        status: true;
        filter: {
            name: {
                multiple: false;
                type: string;
            };
        };
        sort: Record<string, never>;
    };
    addable: true;
    updatable: true;
    removable: true;
};

function makeID(): string {
    return Math.random().toString().slice(2);
}

type Store = { users: User[]; notes: Note[]; tags: Tag[] };

function makeNewStores(): Store {
    return {
        users: [
            {
                id: '11',
                login: 'first',
            },
            {
                id: '12',
                login: 'second',
            },
        ],
        notes: [
            {
                id: '12',
                title: 'First Note',
                text: 'This is the big note',
                user_id: '11',
                created_at: 0,
                links: ['g.com'],
            },
            {
                id: '13',
                title: 'Second Note',
                text: 'This is the small note',
                user_id: '11',
                created_at: 10,
                links: [],
            },
            {
                id: '14',
                title: 'Second Note',
                text: 'This is the small note',
                user_id: '12',
                created_at: 20,
                links: [],
            },
        ],
        tags: [
            {
                id: '23',
                name: 'action',
                note_id: '12',
            },
            {
                id: '24',
                name: 'movie',
                note_id: '12',
            },
            {
                id: '25',
                name: 'fantasy',
                note_id: '13',
            },
            {
                id: '26',
                name: 'drama',
                note_id: '12',
            },
            {
                id: '27',
                name: 'comedy',
                note_id: '14',
            },
        ],
    };
}

export type Context = {
    role: 'admin' | 'user';
    userId: string;
};

class UsersResourceKeeper extends ResourceKeeper<UserDeclaration, Context, DefaultPage> {
    #store: Store;

    constructor(store: Store) {
        super();
        this.#store = store;
    }

    readonly schema: ResourceSchema<UserDeclaration, Context, DefaultPage> = {
        type: 'users',
        attributes: {
            login: {
                mode: 'readonly',
            },
        },
        relationships: {
            notes: {
                types: ['notes'],
                multiple: true,
                mode: 'readonly',
                get: async (
                    context: Context,
                    resourceIds: string[],
                    options: RelationshipOptions<DefaultPage>,
                ): Promise<Record<string, DataList<ResourceIdentifier<'notes'>>>> => {
                    const limit = options.page?.size ?? 10;
                    const offset = options.page?.number ?? 0;
                    return Object.fromEntries(
                        resourceIds.map((resourceId) => {
                            const userNotes = this.#store.notes.filter((aNote) => resourceId === aNote.user_id);
                            return [
                                resourceId,
                                {
                                    items: userNotes
                                        .map((aNote) => ({ id: aNote.id, type: 'notes' }) as const)
                                        .slice(offset, offset + limit),
                                    total: userNotes.length,
                                    limit,
                                    offset,
                                },
                            ];
                        }),
                    );
                },
            },
        },
        filter: {
            login: {
                multiple: true,
                // schema: schemas.array(schemas.string()),
                transformer: (values: string[]) => {
                    return values;
                },
            },
        },
        sort: {
            login: { dir: 'desc' },
        },
        listable: true,
        addable: false,
        updatable: false,
        removable: false,
    };

    async status(context: Context, ids: string[]): Promise<Record<string, ResourceStatus>> {
        const users = this.#store.users.filter((anUser) => ids.includes(anUser.id));
        const userStatuses: Record<string, ResourceStatus> = {};
        for (const user of users) {
            if (user) {
                if (context.role === 'admin') {
                    userStatuses[user.id] = { type: 'exist' };
                } else {
                    if (user.id === context.userId) {
                        userStatuses[user.id] = { type: 'exist' };
                    } else {
                        userStatuses[user.id] = { type: 'forbidden' };
                    }
                }
            }
        }
        for (const id of ids) {
            if (!userStatuses[id]) {
                userStatuses[id] = { type: 'not-found' };
            }
        }

        return userStatuses;
    }

    async get(
        context: Context,
        ids: string[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: Pick<ResourceOptions<UserDeclaration, DefaultPage>, 'page'>,
    ): Promise<Resource<UserDeclaration>[]> {
        return ids.map((id) => {
            const user = this.#store.users.find((anUser) => id === anUser.id)!;
            const notes = this.#store.notes
                .filter((note) => note.user_id === user.id)
                .map((note) => ({ id: note.id, type: 'notes' as const }));
            return {
                id,
                type: 'users',
                attributes: {
                    login: user.login,
                },
                relationships: {
                    notes: {
                        items: notes,
                        limit: 4,
                        offset: 0,
                        total: notes.length,
                    },
                },
            } satisfies Resource<UserDeclaration>;
        });
    }

    async list(
        context: Context,
        options: ResourceOptions<UserDeclaration, DefaultPage>,
    ): Promise<DataList<Resource<UserDeclaration>>> {
        let users: User[];
        if (context.role === 'admin') {
            users = this.#store.users;
        } else {
            users = this.#store.users.filter((anUser) => anUser.id === context.userId);
        }
        users = users.filter((user) => (options.filter?.login ? options.filter.login.includes(user.login) : true));
        if (options.sort) {
            users.sort((userA, userB) => {
                for (const sort of options.sort!) {
                    const result = userA[sort.field].localeCompare(userB[sort.field]);
                    if (!result) {
                        continue;
                    }
                    return sort.asc ? result : result * -1;
                }
                return 0;
            });
        }
        const limit = options.page?.size ?? 10;
        const offset = options.page?.number ?? 0;

        return {
            items: users
                .map((user) => {
                    const notes = this.#store.notes
                        .filter((note) => note.user_id === user.id)
                        .map((note) => ({ id: note.id, type: 'notes' as const }));
                    return {
                        id: user.id,
                        type: 'users',
                        attributes: {
                            login: user.login,
                        },
                        relationships: {
                            notes: {
                                items: notes,
                                limit: 4,
                                offset: 0,
                                total: notes.length,
                            },
                        },
                    } satisfies Resource<UserDeclaration>;
                })
                .slice(offset, offset + limit),
            limit,
            offset,
            total: users.length,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    add(context: Context, resource: NewResource<UserDeclaration>): Promise<never> {
        return Promise.reject(new Error('Method not implemented.'));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(context: Context, resource: EditableResource<UserDeclaration>): Promise<never> {
        return Promise.reject(new Error('Method not implemented.'));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    remove(context: Context, id: string): Promise<never> {
        return Promise.reject(new Error('Method not implemented.'));
    }
}

function fetchTagsByNoteId(
    store: Store,
    nodeId: string,
    limit: number,
    offset: number,
): DataList<ResourceIdentifier<'tags'>> {
    const note = store.notes.find((aNote) => aNote.id === nodeId);
    if (!note) {
        return { items: [], total: 0, limit, offset: 0 };
    }
    const noteTags = store.tags.filter((tag) => tag.note_id === nodeId);

    return {
        items: noteTags.map((tag) => ({ id: tag.id, type: 'tags' as const })).slice(offset, offset + limit),
        total: noteTags.length,
        limit,
        offset,
    };
}

// function checkTags(
//     context: Context,
//     store: Store,
//     id: string,
//     resourceIdentifiers: ResourceIdentifier<'tags'>[]
// ): RelationshipStatus {
//     for (const resourceIdentifier of resourceIdentifiers) {
//         const tag = store.tags.find((aTag) => aTag.id === resourceIdentifier.id);
//         if (!tag) {
//             return {
//                 type: 'not-found',
//                 id,
//             };
//         }
//         if (context.role === 'user') {
//             const tagNote = store.notes.find((note) => note.id === tag.note_id);
//             if (tagNote?.user_id !== context.userId) {
//                 return {
//                     type: 'forbidden',
//                     id,
//                 };
//             }
//         }
//     }

//     return { type: 'ok' };
// }

class NotesResourceKeeper extends ResourceKeeper<NoteDeclaration, Context, DefaultPage> {
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
                ): Promise<void> => {
                    this.#store.tags.forEach((tag) => {
                        if (resourceIdentifiers.find((rId) => rId.id === tag.id)) {
                            tag.note_id = resourceId;
                        }
                    });
                },
                update: async (
                    context: Context,
                    resourceId: string,
                    resourceIdentifiers: ResourceIdentifier<'tags'>[],
                ): Promise<void> => {
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
                },
                remove: async (
                    context: Context,
                    resourceId: string,
                    resourceIdentifiers: ResourceIdentifier<'tags'>[],
                ): Promise<void> => {
                    const ids = resourceIdentifiers.map((rId) => rId.id);
                    for (let i = 0; i < this.#store.tags.length; i++) {
                        if (ids.includes(this.#store.tags[i].id)) {
                            this.#store.tags.splice(i, 1);
                            i--;
                            continue;
                        }
                    }
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
        options: Pick<ResourceOptions<NoteDeclaration, DefaultPage>, 'page'>,
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
        options: ResourceOptions<NoteDeclaration, DefaultPage>,
    ): Promise<DataList<Resource<NoteDeclaration>>> {
        let notes: Note[];
        if (context.role === 'admin') {
            notes = this.#store.notes;
        } else {
            notes = this.#store.notes.filter((aNote) => aNote.user_id === context.userId);
        }
        const limit = options.page?.size ?? 10;
        const offset = options.page?.number ?? 0;

        return {
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
        };
    }

    async add(context: Context, resource: NewResource<NoteDeclaration>): Promise<string> {
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

        return id;
    }

    async update(context: Context, resource: EditableResource<NoteDeclaration>): Promise<void> {
        const note = this.#store.notes.find((aNote) => aNote.id === resource.id)!;
        if (resource.attributes.text) {
            note.text = resource.attributes.text;
        }
        if (resource.attributes.title) {
            note.title = resource.attributes.title;
        }
    }

    async remove(context: Context, id: string): Promise<void> {
        const i = this.#store.notes.findIndex((note) => note.id !== id);
        if (i !== -1) {
            this.#store.notes.splice(i, 1);
        }
    }
}

class TagsResourceKeeper extends ResourceKeeper<TagDeclaration, Context, DefaultPage> {
    #store: Store;

    constructor(store: Store) {
        super();
        this.#store = store;
    }

    readonly schema: ResourceSchema<TagDeclaration, Context, DefaultPage> = {
        type: 'tags',
        attributes: {
            name: {
                schema: schemas.string(),
                mode: 'editable',
            },
        },
        relationships: {
            note: {
                types: ['notes'],
                mode: 'editable',
                get: async (
                    context: Context,
                    resourceIds: string[],
                ): Promise<Record<string, ResourceIdentifier<'notes'>>> => {
                    return Object.fromEntries(
                        resourceIds.map((resourceId) => {
                            const tag = this.#store.tags.find((aTag) => aTag.id === resourceId)!;

                            return [
                                resourceId,
                                {
                                    type: 'notes',
                                    id: tag.note_id,
                                },
                            ];
                        }),
                    );
                },
                update: async (
                    context: Context,
                    resourceId: string,
                    resourceIdentifier: ResourceIdentifier<'notes'>,
                ): Promise<void> => {
                    const tag = this.#store.tags.find((aTag) => aTag.id === resourceId)!;
                    tag.note_id = resourceIdentifier.id;
                },
            },
        },
        filter: {
            name: {
                transformer: (value) => value,
                multiple: false,
            },
        },
        sort: {},
        listable: true,
        addable: true,
        updatable: true,
        removable: true,
    };

    async status(context: Context, ids: string[]): Promise<Record<string, ResourceStatus>> {
        const tags = this.#store.tags.filter((aTag) => ids.includes(aTag.id));
        const tagStatuses: Record<string, ResourceStatus> = {};
        for (const tag of tags) {
            if (tag) {
                if (context.role === 'admin') {
                    tagStatuses[tag.id] = { type: 'exist' };
                } else {
                    const note = this.#store.notes.find((aNote) => aNote.id === tag.note_id)!;
                    if (note.user_id === context.userId) {
                        tagStatuses[tag.id] = { type: 'exist' };
                    } else {
                        tagStatuses[tag.id] = { type: 'forbidden' };
                    }
                }
            }
        }
        for (const id of ids) {
            if (!tagStatuses[id]) {
                tagStatuses[id] = { type: 'not-found' };
            }
        }

        return tagStatuses;
    }

    async get(
        context: Context,
        ids: string[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: Pick<ResourceOptions<TagDeclaration, DefaultPage>, 'page'>,
    ): Promise<Resource<TagDeclaration>[]> {
        return ids.map((id) => {
            const tag = this.#store.tags.find((aTag) => aTag.id === id)!;
            return {
                id,
                type: 'tags',
                attributes: {
                    name: tag.name,
                },
                relationships: {
                    note: {
                        id: tag.note_id,
                        type: 'notes',
                    },
                },
            };
        });
    }

    async list(
        context: Context,
        options: ResourceOptions<TagDeclaration, DefaultPage>,
    ): Promise<DataList<Resource<TagDeclaration>>> {
        let tags: Tag[];
        if (context.role === 'admin') {
            tags = this.#store.tags.filter((tag) => (options.filter?.name ? tag.name === options.filter.name : true));
        } else {
            tags = this.#store.tags
                .filter((tag) => (options.filter?.name ? tag.name === options.filter.name : true))
                .filter((tag) => {
                    const note = this.#store.notes.find((aNote) => aNote.id === tag.note_id)!;
                    return note.user_id === context.userId;
                });
        }
        const limit = options.page?.size ?? 10;
        const offset = options.page?.number ?? 0;

        return {
            items: tags
                .map(
                    (tag) =>
                        ({
                            id: tag.id,
                            type: 'tags',
                            attributes: {
                                name: tag.name,
                            },
                            relationships: {
                                note: {
                                    id: tag.note_id,
                                    type: 'notes',
                                },
                            },
                        }) satisfies Resource<TagDeclaration>,
                )
                .slice(offset, offset + limit),
            limit,
            offset,
            total: tags.length,
        };
    }

    async add(context: Context, resource: NewResource<TagDeclaration>): Promise<string> {
        const id = resource.id ?? makeID();
        const tag: Tag = {
            id,
            name: resource.attributes.name,
            note_id: resource.relationships.note.id,
        };
        this.#store.tags.push(tag);

        return id;
    }

    async update(context: Context, resource: EditableResource<TagDeclaration>): Promise<void> {
        const tag = this.#store.tags.find((aTag) => aTag.id === resource.id)!;
        if (resource.attributes.name) {
            tag.name = resource.attributes.name;
        }
    }

    async remove(context: Context, id: string): Promise<void> {
        const i = this.#store.tags.findIndex((aTag) => aTag.id !== id);
        if (i !== -1) {
            this.#store.notes.splice(i, 1);
        }
    }
}

export function makeResourceManager(): ResourceManager<Context, DefaultPage> {
    const store = makeNewStores();
    const resourceManager = new ResourceManager<Context, DefaultPage>(pageProvider);
    resourceManager.addResourceKeeper(new NotesResourceKeeper(store));
    resourceManager.addResourceKeeper(new TagsResourceKeeper(store));
    resourceManager.addResourceKeeper(new UsersResourceKeeper(store));
    resourceManager.init();

    return resourceManager;
}

export function makeServerHandler(): ServerHandler<Context, DefaultPage, DefaultMeta> {
    const resourceManager = makeResourceManager();
    const serverHandler = new ServerHandler<Context, DefaultPage, DefaultMeta>(
        resourceManager,
        pageProvider,
        metaProvider,
    );
    serverHandler.setPrefix('/api/v1');
    serverHandler.setDomain('www.example.com');

    return serverHandler;
}

export function makeClient(): Client<Context, DefaultPage, DefaultMeta> {
    const serverHandler = makeServerHandler();
    const queryConverter = new QueryConverter<DefaultPage>(pageProvider);
    queryConverter.setPrefix('/api/v1');
    queryConverter.setDomain('www.example.com');
    const methodMap = {
        get: 'GET',
        add: 'POST',
        operations: 'POST',
        update: 'PATCH',
        remove: 'DELETE',
    };

    const fetcher: Fetcher<Context, DefaultPage> = (context, method, query, body) => {
        const url = queryConverter.make(query);
        return serverHandler.handle(context, methodMap[method], url, body).then((result) => result.body);
    };

    const client = new Client<Context, DefaultPage, DefaultMeta>(pageProvider, fetcher);
    client.setPrefix('/api/v1');
    client.setDomain('www.example.com');

    return client;
}
