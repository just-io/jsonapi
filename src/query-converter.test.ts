import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { QueryConverter } from './query-converter';
import { PageProvider } from './types';
import schemas from './schemas';
import { ErrorFactory, CommonError } from './errors';
import { ErrorSet } from '@just-io/schema';

type Page = {
    number?: number;
    size?: number;
};

const pageProvider: PageProvider<Page> = {
    schema: schemas.structure<Page>({
        number: schemas.optional(schemas.number()),
        size: schemas.optional(schemas.number()),
    }),
    extractFromEntries(entries: [string, string][]): Page {
        const page: Page = {
            number: 0,
        };
        entries.forEach(([key, value]) => {
            const parts = key.match(/([^\]]+)(?:\]\[([^\]]+))?(?:\]\[([^\]]+))?/);
            if (parts) {
                if (isNaN(Number(value)) || Number(value) < 0 || Number(value) % 1 !== 0) {
                    throw new ErrorSet<CommonError>().add(
                        ErrorFactory.makeInvalidQueryParameterError(
                            'page',
                            `Invalid page search param '${key}=${value}' value should be intenger and great or equal 0`,
                        ),
                    );
                }
                if (parts[1] === 'number') {
                    page.number = Number(value);
                } else if (parts[1] === 'size') {
                    page.size = Number(value);
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
    toEntries(page: Page): [string, string][] {
        const entries: [string, string][] = [];
        if (page.number !== undefined) {
            entries.push(['number', String(page.number)]);
        }

        if (page.size) {
            entries.push(['size', String(page.size)]);
        }

        return entries;
    },
    getPages(page: Page, total: number, limit: number): { first: Page; last: Page; prev?: Page; next?: Page } {
        const number = page.number ?? 0;
        const currentNumber = number < Math.ceil(total / limit) ? number : 0;
        return {
            first: {
                number: 0,
                size: limit,
            },
            last: {
                number: Math.floor(total / limit),
                size: limit,
            },
            prev: currentNumber
                ? {
                      number: currentNumber - 1,
                      size: limit,
                  }
                : undefined,
            next:
                currentNumber !== Math.floor(total / limit)
                    ? {
                          number: currentNumber + 1,
                          size: limit,
                      }
                    : undefined,
        };
    },
};

describe('QueryConverter', () => {
    const queryConverter = new QueryConverter(pageProvider);

    describe('method parse', () => {
        describe('only pathname', () => {
            const defaultParams = {
                fields: {},
                include: [],
                sort: [],
                filter: {},
                page: {
                    number: 0,
                },
            };
            test('should return data with only resourse type', () => {
                assert.deepStrictEqual(queryConverter.parse('/articles'), {
                    ref: {
                        type: 'articles',
                    },
                    params: defaultParams,
                });
            });

            test('should return data with resourse type and id', () => {
                assert.deepStrictEqual(queryConverter.parse('/articles/11'), {
                    ref: {
                        type: 'articles',
                        id: '11',
                    },
                    params: defaultParams,
                });
            });

            test('should return data with resourse type, id, and relationship', () => {
                assert.deepStrictEqual(queryConverter.parse('/articles/11/comments'), {
                    ref: {
                        type: 'articles',
                        id: '11',
                        related: true,
                        relationship: 'comments',
                    },
                    params: defaultParams,
                });
            });

            test('should return data with resourse type, id, relation, and relationship', () => {
                assert.deepStrictEqual(queryConverter.parse('/articles/11/relationships/comments'), {
                    ref: {
                        type: 'articles',
                        id: '11',
                        related: false,
                        relationship: 'comments',
                    },
                    params: defaultParams,
                });
            });

            test('should throw error without resourse type', () => {
                assert.throws(() => queryConverter.parse('/'));
                assert.throws(() => queryConverter.parse(''));
            });
        });

        describe('with query parameters', () => {
            test('should throw error with invalid parameter', () => {
                assert.throws(() => queryConverter.parse('/articles/11/relationships/comments?includ=comments'));
            });

            describe('with parameter include', () => {
                test('should return include with query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse('/articles/11/relationships/comments?include=comments.author'),
                        {
                            ref: {
                                type: 'articles',
                                id: '11',
                                related: false,
                                relationship: 'comments',
                            },
                            params: {
                                fields: {},
                                include: [['comments', 'author']],
                                sort: [],
                                filter: {},
                                page: {
                                    number: 0,
                                },
                            },
                        },
                    );
                });

                test('should return two include with query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse(
                            '/articles/11/relationships/comments?include=comments.author,author.department',
                        ),
                        {
                            ref: {
                                type: 'articles',
                                id: '11',
                                related: false,
                                relationship: 'comments',
                            },
                            params: {
                                fields: {},
                                include: [
                                    ['comments', 'author'],
                                    ['author', 'department'],
                                ],
                                sort: [],
                                filter: {},
                                page: {
                                    number: 0,
                                },
                            },
                        },
                    );
                });

                test('should throw error with empty block in include query parameter', () => {
                    assert.throws(() => queryConverter.parse('/articles/11/relationships/comments?include'));
                    assert.throws(() => queryConverter.parse('/articles/11/relationships/comments?include=comments.'));
                    assert.throws(() => queryConverter.parse('/articles/11/relationships/comments?include=comments,'));
                });
            });

            describe('with parameter sort', () => {
                test('should return sort with query parameter', () => {
                    assert.deepStrictEqual(queryConverter.parse('/articles/11/relationships/comments?sort=title'), {
                        ref: {
                            type: 'articles',
                            id: '11',
                            related: false,
                            relationship: 'comments',
                        },
                        params: {
                            fields: {},
                            include: [],
                            sort: [
                                {
                                    field: 'title',
                                    asc: true,
                                },
                            ],
                            filter: {},
                            page: {
                                number: 0,
                            },
                        },
                    });
                });

                test('should return two sort with query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse('/articles/11/relationships/comments?sort=title,-created'),
                        {
                            ref: {
                                type: 'articles',
                                id: '11',
                                related: false,
                                relationship: 'comments',
                            },
                            params: {
                                fields: {},
                                include: [],
                                sort: [
                                    {
                                        field: 'title',
                                        asc: true,
                                    },
                                    {
                                        field: 'created',
                                        asc: false,
                                    },
                                ],
                                filter: {},
                                page: {
                                    number: 0,
                                },
                            },
                        },
                    );
                });

                test('should throw error with empty block in sort query parameter', () => {
                    assert.throws(() => queryConverter.parse('/articles/11/relationships/comments?sort'));
                    assert.throws(() => queryConverter.parse('/articles/11/relationships/comments?sort=id,'));
                });
            });

            describe('with parameter fields', () => {
                test('should return fields with empty query parameter', () => {
                    assert.deepStrictEqual(queryConverter.parse('/articles/11/relationships/comments?fields[people]'), {
                        ref: {
                            type: 'articles',
                            id: '11',
                            related: false,
                            relationship: 'comments',
                        },
                        params: {
                            fields: {
                                people: [],
                            },
                            include: [],
                            sort: [],
                            filter: {},
                            page: {
                                number: 0,
                            },
                        },
                    });
                });

                test('should return fields with query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse('/articles/11/relationships/comments?fields[people]=name'),
                        {
                            ref: {
                                type: 'articles',
                                id: '11',
                                related: false,
                                relationship: 'comments',
                            },
                            params: {
                                fields: {
                                    people: ['name'],
                                },
                                include: [],
                                sort: [],
                                filter: {},
                                page: {
                                    number: 0,
                                },
                            },
                        },
                    );
                });

                test('should return fields with two query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse(
                            '/articles/11/relationships/comments?fields[people]=name&fields[articles]=title,body',
                        ),
                        {
                            ref: {
                                type: 'articles',
                                id: '11',
                                related: false,
                                relationship: 'comments',
                            },
                            params: {
                                fields: {
                                    people: ['name'],
                                    articles: ['title', 'body'],
                                },
                                include: [],
                                sort: [],
                                filter: {},
                                page: {
                                    number: 0,
                                },
                            },
                        },
                    );
                });

                test('should return fields with encoded query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse('/articles/11/relationships/comments?fields%5Barticles%5D=title%2Cbody'),
                        {
                            ref: {
                                type: 'articles',
                                id: '11',
                                related: false,
                                relationship: 'comments',
                            },
                            params: {
                                fields: {
                                    articles: ['title', 'body'],
                                },
                                include: [],
                                sort: [],
                                filter: {},
                                page: {
                                    number: 0,
                                },
                            },
                        },
                    );
                });

                test('should throw error with empty block in fields query parameter', () => {
                    assert.throws(() => queryConverter.parse('/articles/11/relationships/comments?fields'));
                    assert.throws(() => queryConverter.parse('/articles/11/relationships/comments?fields[]'));
                    assert.throws(() =>
                        queryConverter.parse('/articles/11/relationships/comments?fields[people]=name,'),
                    );
                });
            });
        });
    });

    describe('method make', () => {
        test('should return url string', () => {
            const url = queryConverter.make({
                ref: {
                    type: 'articles',
                    id: '11',
                    related: false,
                    relationship: 'comments',
                },
                params: {
                    fields: { articles: ['title', 'body'], people: ['name'] },
                    include: [['comments', 'author']],
                    sort: [{ field: 'id', asc: true }],
                    filter: { 'title.contains': ['first'] },
                    page: {},
                },
            });

            assert.equal(
                url,
                '/articles/11/relationships/comments?include=comments.author&fields%5Barticles%5D=title%2Cbody&fields%5Bpeople%5D=name&filter%5Btitle.contains%5D=first&sort=id',
            );
        });
    });
});
