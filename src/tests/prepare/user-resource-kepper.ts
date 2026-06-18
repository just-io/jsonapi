import { ErrorSet, Result } from '@just-io/schema';
import { DefaultPage } from '../../server/defaults';
import { FetchResourceOptions, ResourceKeeper, ResourceStatus } from '../../server/resource-keeper';
import { RelationshipOptions, ResourceSchema } from '../../server/resource-schema';
import { DataList, ResourceIdentifier } from '../../types/common';
import { EditableResource, NewResource, Resource } from '../../types/resource-declaration';
import { Store, User } from './store';
import { Context } from './types';
import { CommonError } from '../../types/formats';

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

export class UsersResourceKeeper extends ResourceKeeper<UserDeclaration, Context, DefaultPage> {
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
                transformer: (values: string[]) => {
                    return {
                        ok: true,
                        value: values,
                    };
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
        options: Pick<FetchResourceOptions<UserDeclaration, DefaultPage>, 'page'>,
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
        options: FetchResourceOptions<UserDeclaration, DefaultPage>,
    ): Promise<Result<DataList<Resource<UserDeclaration>>, ErrorSet<CommonError>>> {
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
        const offset = (options.page?.number ?? 0) * limit;

        return {
            ok: true,
            value: {
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
            },
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
