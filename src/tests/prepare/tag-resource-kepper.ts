import { ErrorSet, Result, schemas } from '@just-io/schema';
import { DefaultPage } from '../../server/defaults';
import { FetchResourceOptions, ResourceKeeper, ResourceStatus } from '../../server/resource-keeper';
import { ResourceSchema } from '../../server/resource-schema';
import { DataList, ResourceIdentifier } from '../../types/common';
import { EditableResource, NewResource, Resource } from '../../types/resource-declaration';
import { makeID, Store, Tag } from './store';
import { Context } from './types';
import { CommonError } from '../../types/formats';

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

export class TagsResourceKeeper extends ResourceKeeper<TagDeclaration, Context, DefaultPage> {
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
                ): Promise<Result<void, ErrorSet<CommonError>>> => {
                    const tag = this.#store.tags.find((aTag) => aTag.id === resourceId)!;
                    tag.note_id = resourceIdentifier.id;

                    return {
                        ok: true,
                        value: undefined,
                    };
                },
            },
        },
        filter: {
            name: {
                transformer: (value) => {
                    return {
                        ok: true,
                        value,
                    };
                },
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
        options: Pick<FetchResourceOptions<TagDeclaration, DefaultPage>, 'page'>,
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
        options: FetchResourceOptions<TagDeclaration, DefaultPage>,
    ): Promise<Result<DataList<Resource<TagDeclaration>>, ErrorSet<CommonError>>> {
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
            ok: true,
            value: {
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
            },
        };
    }

    async add(context: Context, resource: NewResource<TagDeclaration>): Promise<Result<string, ErrorSet<CommonError>>> {
        const id = resource.id ?? makeID();
        const tag: Tag = {
            id,
            name: resource.attributes.name,
            note_id: resource.relationships.note.id,
        };
        this.#store.tags.push(tag);

        return {
            ok: true,
            value: id,
        };
    }

    async update(
        context: Context,
        resource: EditableResource<TagDeclaration>,
    ): Promise<Result<void, ErrorSet<CommonError>>> {
        const tag = this.#store.tags.find((aTag) => aTag.id === resource.id)!;
        if (resource.attributes.name) {
            tag.name = resource.attributes.name;
        }

        return {
            ok: true,
            value: undefined,
        };
    }

    async remove(context: Context, id: string): Promise<Result<void, ErrorSet<CommonError>>> {
        const i = this.#store.tags.findIndex((aTag) => aTag.id !== id);
        if (i !== -1) {
            this.#store.notes.splice(i, 1);
        }

        return {
            ok: true,
            value: undefined,
        };
    }
}
