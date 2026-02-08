import { ErrorFactory } from './errors';
import { DataList, MetaProvider, PageProvider, ResourceIdentifier, CommonQueryRef } from '../types/common';
import schemas from './schemas';
import { ErrorSet } from '@just-io/schema';
import { CommonError } from '../types/formats';

export type DefaultPage = {
    number?: number;
    size?: number;
    relationships?: Record<string, { size: number }>;
};

export const pageProvider: PageProvider<DefaultPage> = {
    schema: schemas.structure<DefaultPage>({
        number: schemas.optional(schemas.number().integer().minimum(0)),
        size: schemas.optional(schemas.number().integer().minimum(1)),
        relationships: schemas.optional(
            schemas.record(
                schemas.structure({
                    size: schemas.number().integer().minimum(1),
                }),
            ),
        ),
    }),
    extractFromEntries(entries: [string, string][]): DefaultPage {
        const page: DefaultPage = {};
        entries.forEach(([key, value]) => {
            const parts = key.match(/([^\]]+)(?:\]\[([^\]]+))?(?:\]\[([^\]]+))?/);
            if (parts) {
                if (parts[1] === 'number') {
                    page.number = Number(value);
                } else if (parts[1] === 'size') {
                    page.size = Number(value);
                } else if (parts[1] === 'relationships' && parts[2] && parts[3] === 'size') {
                    if (!page.relationships) {
                        page.relationships = {};
                    }
                    page.relationships[parts[2]] = {
                        size: Number(value),
                    };
                } else {
                    throw new ErrorSet<CommonError>().add(
                        ErrorFactory.makeInvalidQueryParameterError(
                            'page',
                            `Invalid page search param '${key}=${value}'`,
                        ),
                    );
                }
            } else {
                throw new ErrorSet<CommonError>().add(
                    ErrorFactory.makeInvalidQueryParameterError('page', `Invalid page search param '${key}=${value}'`),
                );
            }
        });

        return page;
    },
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
    getPages(
        page: DefaultPage,
        total: number,
        limit: number,
    ): { first: DefaultPage; last: DefaultPage; prev?: DefaultPage; next?: DefaultPage } {
        const number = page.number ?? 0;
        const currentNumber = number < Math.ceil(total / limit) ? number : 0;
        return {
            first: {
                number: 0,
                size: limit,
                relationships: page.relationships,
            },
            last: {
                number: total === 0 ? 0 : Math.floor((total - 1) / limit),
                size: limit,
                relationships: page.relationships,
            },
            prev: currentNumber
                ? {
                      number: currentNumber - 1,
                      size: limit,
                      relationships: page.relationships,
                  }
                : undefined,
            next:
                currentNumber !== (total === 0 ? 0 : Math.floor((total - 1) / limit))
                    ? {
                          number: currentNumber + 1,
                          size: limit,
                          relationships: page.relationships,
                      }
                    : undefined,
        };
    },
};

export type DefaultMeta = {
    total?: number;
    totalPages?: number;
    pageNumber?: number;
    pageSize?: number;
};

export const metaProvider: MetaProvider<DefaultMeta> = {
    composeList(list: DataList<ResourceIdentifier<string>>): DefaultMeta | undefined {
        if (list.total === undefined) {
            return {};
        }
        if (list.limit === undefined || list.offset === undefined) {
            return { total: list.total };
        }
        const totalPages = Math.ceil(list.total / list.limit);
        const pageNumber = Math.floor(list.offset / list.limit);

        return { total: list.total, totalPages, pageNumber, pageSize: list.limit };
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    compose(resource: ResourceIdentifier<string> | null): DefaultMeta | undefined {
        return {};
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    composeRoot(queryRef: CommonQueryRef): DefaultMeta | undefined {
        return {};
    },
};
