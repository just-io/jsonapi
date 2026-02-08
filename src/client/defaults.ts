import { ClientPageProvider } from './types';

export type DefaultPage = {
    number?: number;
    size?: number;
    relationships?: Record<string, { size: number }>;
};

export const clientPageProvider: ClientPageProvider<DefaultPage> = {
    toEntries(page: DefaultPage): [string, string][] {
        const entries: [string, string][] = [];
        if (page.number !== undefined) {
            entries.push(['number', String(page.number)]);
        }

        if (page.size) {
            entries.push(['size', String(page.size)]);
        }

        if (page.relationships) {
            Object.keys(page.relationships).forEach((field) => {
                entries.push([`relationships][${field}][size`, String(page.relationships![field].size)]);
            });
        }

        return entries;
    },
};
