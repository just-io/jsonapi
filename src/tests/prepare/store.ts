import { DataList, ResourceIdentifier } from '../../types/common';

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

export type Tag = {
    id: string;
    name: string;
    note_id: string;
};

export function makeID(): string {
    return Math.random().toString().slice(2);
}

export type Store = { users: User[]; notes: Note[]; tags: Tag[] };

export function makeNewStores(): Store {
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

export function fetchTagsByNoteId(
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
