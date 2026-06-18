import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { QueryConverter } from './query-converter';
import { pageProvider } from './defaults';
import { defaultErrorFormatter } from './error-formatter';

describe('QueryConverter', () => {
    const queryConverter = new QueryConverter(pageProvider);

    describe('method parse', () => {
        describe('only pathname', () => {
            const defaultParams = {
                fields: {},
                include: [],
                sort: [],
                filter: {},
                page: {},
            };
            test('should return data with only resourse type', () => {
                assert.deepStrictEqual(queryConverter.parse('/articles', defaultErrorFormatter), {
                    ok: true,
                    value: {
                        ref: {
                            type: 'articles',
                        },
                        params: defaultParams,
                    },
                });
            });

            test('should return data with resourse type and id', () => {
                assert.deepStrictEqual(queryConverter.parse('/articles/11', defaultErrorFormatter), {
                    ok: true,
                    value: {
                        ref: {
                            type: 'articles',
                            id: '11',
                        },
                        params: defaultParams,
                    },
                });
            });

            test('should return data with resourse type, id, and relationship', () => {
                assert.deepStrictEqual(queryConverter.parse('/articles/11/comments', defaultErrorFormatter), {
                    ok: true,
                    value: {
                        ref: {
                            type: 'articles',
                            id: '11',
                            related: true,
                            relationship: 'comments',
                        },
                        params: defaultParams,
                    },
                });
            });

            test('should return data with resourse type, id, relation, and relationship', () => {
                assert.deepStrictEqual(
                    queryConverter.parse('/articles/11/relationships/comments', defaultErrorFormatter),
                    {
                        ok: true,
                        value: {
                            ref: {
                                type: 'articles',
                                id: '11',
                                related: false,
                                relationship: 'comments',
                            },
                            params: defaultParams,
                        },
                    },
                );
            });

            test('should return error without resourse type', () => {
                const result = queryConverter.parse('/', defaultErrorFormatter);
                assert.ok(!result.ok);
                assert.deepStrictEqual(result.error.toJSON(), [
                    {
                        detail: undefined,
                        source: {
                            parameter: 'query',
                        },
                        status: 400,
                        title: 'Type should be existed',
                    },
                ]);
            });

            test('should return error without resourse type on empty string', () => {
                const result = queryConverter.parse('', defaultErrorFormatter);
                assert.ok(!result.ok);
                assert.deepStrictEqual(result.error.toJSON(), [
                    {
                        detail: undefined,
                        source: {
                            parameter: 'query',
                        },
                        status: 400,
                        title: 'Type should be existed',
                    },
                ]);
            });
        });

        describe('with query parameters', () => {
            test('should return error with invalid parameter', () => {
                const result = queryConverter.parse(
                    '/articles/11/relationships/comments?includ=comments',
                    defaultErrorFormatter,
                );
                assert.ok(!result.ok);
                assert.deepStrictEqual(result.error.toJSON(), [
                    {
                        detail: undefined,
                        source: {
                            parameter: 'query',
                        },
                        status: 400,
                        title: 'Invalid search param "includ=comments"',
                    },
                ]);
            });

            describe('with parameter include', () => {
                test('should return include with query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse(
                            '/articles/11/relationships/comments?include=comments.author',
                            defaultErrorFormatter,
                        ),
                        {
                            ok: true,
                            value: {
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
                                    page: {},
                                },
                            },
                        },
                    );
                });

                test('should return two include with query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse(
                            '/articles/11/relationships/comments?include=comments.author,author.department',
                            defaultErrorFormatter,
                        ),
                        {
                            ok: true,
                            value: {
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
                                    page: {},
                                },
                            },
                        },
                    );
                });

                describe('should return error', () => {
                    test('with empty block in include query parameter', () => {
                        const result = queryConverter.parse(
                            '/articles/11/relationships/comments?include',
                            defaultErrorFormatter,
                        );
                        assert.ok(!result.ok);
                        assert.deepStrictEqual(result.error.toJSON(), [
                            {
                                detail: undefined,
                                source: {
                                    parameter: 'query',
                                },
                                status: 400,
                                title: 'Invalid search param "include="',
                            },
                        ]);
                    });

                    test('with empty block part in include query parameter', () => {
                        const result = queryConverter.parse(
                            '/articles/11/relationships/comments?include=comments.',
                            defaultErrorFormatter,
                        );
                        assert.ok(!result.ok);
                        assert.deepStrictEqual(result.error.toJSON(), [
                            {
                                detail: undefined,
                                source: {
                                    parameter: 'query',
                                },
                                status: 400,
                                title: 'Invalid search param "include=comments."',
                            },
                        ]);
                    });

                    test('with skipped block part in include query parameter', () => {
                        const result = queryConverter.parse(
                            '/articles/11/relationships/comments?include=comments,',
                            defaultErrorFormatter,
                        );
                        assert.ok(!result.ok);
                        assert.deepStrictEqual(result.error.toJSON(), [
                            {
                                detail: undefined,
                                source: {
                                    parameter: 'query',
                                },
                                status: 400,
                                title: 'Invalid search param "include=comments,"',
                            },
                        ]);
                    });
                });
            });

            describe('with parameter sort', () => {
                test('should return sort with query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse('/articles/11/relationships/comments?sort=title', defaultErrorFormatter),
                        {
                            ok: true,
                            value: {
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
                                    page: {},
                                },
                            },
                        },
                    );
                });

                test('should return two sort with query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse(
                            '/articles/11/relationships/comments?sort=title,-created',
                            defaultErrorFormatter,
                        ),
                        {
                            ok: true,
                            value: {
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
                                    page: {},
                                },
                            },
                        },
                    );
                });

                describe('should return error', () => {
                    test('with empty block in sort query parameter', () => {
                        const result = queryConverter.parse(
                            '/articles/11/relationships/comments?sort',
                            defaultErrorFormatter,
                        );
                        assert.ok(!result.ok);
                        assert.deepStrictEqual(result.error.toJSON(), [
                            {
                                detail: undefined,
                                source: {
                                    parameter: 'query',
                                },
                                status: 400,
                                title: 'Invalid search param "sort="',
                            },
                        ]);
                    });

                    test('with skipped block part in sort query parameter', () => {
                        const result = queryConverter.parse(
                            '/articles/11/relationships/comments?sort=id,',
                            defaultErrorFormatter,
                        );
                        assert.ok(!result.ok);
                        assert.deepStrictEqual(result.error.toJSON(), [
                            {
                                detail: undefined,
                                source: {
                                    parameter: 'query',
                                },
                                status: 400,
                                title: 'Invalid search param "sort=id,"',
                            },
                        ]);
                    });
                });
            });

            describe('with parameter fields', () => {
                test('should return fields with empty query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse(
                            '/articles/11/relationships/comments?fields[people]',
                            defaultErrorFormatter,
                        ),
                        {
                            ok: true,
                            value: {
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
                                    page: {},
                                },
                            },
                        },
                    );
                });

                test('should return fields with query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse(
                            '/articles/11/relationships/comments?fields[people]=name',
                            defaultErrorFormatter,
                        ),
                        {
                            ok: true,
                            value: {
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
                                    page: {},
                                },
                            },
                        },
                    );
                });

                test('should return fields with two query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse(
                            '/articles/11/relationships/comments?fields[people]=name&fields[articles]=title,body',
                            defaultErrorFormatter,
                        ),
                        {
                            ok: true,
                            value: {
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
                                    page: {},
                                },
                            },
                        },
                    );
                });

                test('should return fields with encoded query parameter', () => {
                    assert.deepStrictEqual(
                        queryConverter.parse(
                            '/articles/11/relationships/comments?fields%5Barticles%5D=title%2Cbody',
                            defaultErrorFormatter,
                        ),
                        {
                            ok: true,
                            value: {
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
                                    page: {},
                                },
                            },
                        },
                    );
                });

                describe('should return error', () => {
                    test('with empty block in fields query parameter', () => {
                        const result = queryConverter.parse(
                            '/articles/11/relationships/comments?fields',
                            defaultErrorFormatter,
                        );
                        assert.ok(!result.ok);
                        assert.deepStrictEqual(result.error.toJSON(), [
                            {
                                detail: undefined,
                                source: {
                                    parameter: 'query',
                                },
                                status: 400,
                                title: 'Invalid search param "fields="',
                            },
                        ]);
                    });

                    test('with empty block key in fields query parameter', () => {
                        const result = queryConverter.parse(
                            '/articles/11/relationships/comments?fields[]',
                            defaultErrorFormatter,
                        );
                        assert.ok(!result.ok);
                        assert.deepStrictEqual(result.error.toJSON(), [
                            {
                                detail: undefined,
                                source: {
                                    parameter: 'query',
                                },
                                status: 400,
                                title: 'Invalid search param "fields[]="',
                            },
                        ]);
                    });

                    test('with skipped block part in fields query parameter', () => {
                        const result = queryConverter.parse(
                            '/articles/11/relationships/comments?fields[people]=name,',
                            defaultErrorFormatter,
                        );
                        assert.ok(!result.ok);
                        assert.deepStrictEqual(result.error.toJSON(), [
                            {
                                detail: undefined,
                                source: {
                                    parameter: 'query',
                                },
                                status: 400,
                                title: 'Invalid search param "fields[people]=name,"',
                            },
                        ]);
                    });
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
                    filter: { 'title.contains': ['first'], scope: ['first', 'second'] },
                    page: {},
                },
            });

            assert.equal(
                url,
                '/articles/11/relationships/comments?include=comments.author&fields%5Barticles%5D=title%2Cbody&fields%5Bpeople%5D=name&filter%5Btitle.contains%5D=first&filter%5Bscope%5D=first&filter%5Bscope%5D=second&sort=id',
            );
        });
    });
});
