import { ErrorSet, Result } from '@just-io/schema';
import { ErrorFactory } from './errors';
import { ResourceDeclaration } from '../types/resource-declaration';
import { ArrayFields, Query, QueryParams, QueryRef } from '../types/common';
import { CommonError } from '../types/formats';
import { PageProvider } from './types';
import { ErrorFormatter } from './error-formatter';

export class QueryConverter<P> {
    #domain = '';

    #prefix = '';

    #pageProvider: PageProvider<P>;

    constructor(pageProvider: PageProvider<P>) {
        this.#pageProvider = pageProvider;
    }

    setPrefix(prefix: string): this {
        this.#prefix = prefix;
        return this;
    }

    setDomain(domain: string): this {
        this.#domain = domain;
        return this;
    }

    parsePath<D extends ResourceDeclaration>(
        url: string,
        errorFormatter: ErrorFormatter,
    ): Result<QueryRef<D, 'list' | 'id' | 'relationship'>, ErrorSet<CommonError>> {
        const i = url.indexOf('/');
        if (i === -1) {
            return {
                ok: false,
                error: new ErrorSet<CommonError>().add(
                    ErrorFactory.makeQueryError(errorFormatter.query.invalidTypeTitle()),
                ),
            };
        }
        const [path] = url.split('?');
        const [type, id, relationships, related] = path.slice(i + this.#prefix.length + 1).split('/');
        if (!type) {
            return {
                ok: false,
                error: new ErrorSet<CommonError>().add(
                    ErrorFactory.makeQueryError(errorFormatter.query.invalidTypeTitle()),
                ),
            };
        }

        const queryRef: QueryRef<D, 'list' | 'id' | 'relationship'> = {
            type,
        };

        if (id) {
            (queryRef as QueryRef<D, 'id'>).id = id;
            if (relationships === 'relationships' && related) {
                (queryRef as QueryRef<D, 'relationship'>).related = false;
                (queryRef as QueryRef<D, 'relationship'>).relationship = related;
            } else if (relationships) {
                (queryRef as QueryRef<D, 'relationship'>).related = true;
                (queryRef as QueryRef<D, 'relationship'>).relationship = relationships;
            }
        }

        return {
            ok: true,
            value: queryRef,
        };
    }

    makePath<D extends ResourceDeclaration>(queryRef: QueryRef<D, 'list' | 'id' | 'relationship'>): string {
        let output = `${this.#domain}${this.#prefix}/${queryRef.type}`;
        if ('id' in queryRef && queryRef.id) {
            output += `/${queryRef.id}`;
            if ('related' in queryRef && queryRef.related) {
                output += `/${queryRef.relationship as string}`;
            } else if ('relationship' in queryRef && queryRef.relationship) {
                output += `/relationships/${queryRef.relationship as string}`;
            }
        }

        return output;
    }

    parse<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        url: string,
        errorFormatter: ErrorFormatter,
    ): Result<Query<P, D, I, 'list' | 'id' | 'relationship'>, ErrorSet<CommonError>> {
        const [, params] = url.split('?');
        const queryRefResult = this.parsePath(url, errorFormatter);
        if (!queryRefResult.ok) {
            return queryRefResult;
        }
        const queryParams: Required<Omit<QueryParams<P, D, I>, 'page'>> = {
            fields: {} as ArrayFields<[D, ...I]>,
            filter: {},
            include: [],
            sort: [],
        };

        const searchParams = new URLSearchParams(params);

        const pageEntries: [string, string][] = [];

        const errorSet = new ErrorSet<CommonError>();

        for (const [key, value] of searchParams.entries()) {
            if (key === 'include') {
                queryParams.include = value.split(',').map((sub) => sub.split('.'));
                if (
                    queryParams.include.some((includeValue) => includeValue.some((subIncludeValue) => !subIncludeValue))
                ) {
                    errorSet.add(ErrorFactory.makeQueryError(errorFormatter.query.invalidSearchParam(key, value)));
                }
                continue;
            }
            if (key === 'sort') {
                if (!value) {
                    errorSet.add(ErrorFactory.makeQueryError(errorFormatter.query.invalidSearchParam(key, value)));
                    continue;
                }
                queryParams.sort = value.split(',').map((field) => {
                    if (field[0] === '-') {
                        return {
                            field: field.slice(1),
                            asc: false,
                        };
                    }
                    return {
                        field,
                        asc: true,
                    };
                }) as Required<QueryParams<P, D, I>>['sort'];
                if (queryParams.sort.some((sort) => !sort.field)) {
                    errorSet.add(ErrorFactory.makeQueryError(errorFormatter.query.invalidSearchParam(key, value)));
                }
                continue;
            }
            const scopedParam = key.match(/(fields|filter|page)\[(.+)\]/);
            if (scopedParam) {
                if (!scopedParam[2]) {
                    errorSet.add(ErrorFactory.makeQueryError(errorFormatter.query.invalidSearchParam(key, value)));
                    continue;
                }
                if (scopedParam[1] === 'fields') {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    queryParams.fields[scopedParam[2]] = value ? value.split(',') : [];
                    if (queryParams.fields[scopedParam[2]]!.some((field) => !field)) {
                        errorSet.add(ErrorFactory.makeQueryError(errorFormatter.query.invalidSearchParam(key, value)));
                    }
                }
                if (scopedParam[1] === 'filter') {
                    if (!queryParams.filter[scopedParam[2]]) {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        queryParams.filter[scopedParam[2]] = [];
                    }
                    queryParams.filter[scopedParam[2]]!.push(value);
                }
                if (scopedParam[1] === 'page') {
                    pageEntries.push([scopedParam[2], value]);
                }
            } else {
                errorSet.add(ErrorFactory.makeQueryError(errorFormatter.query.invalidSearchParam(key, value)));
            }
        }

        const pageResult = this.#pageProvider.extractFromEntries(pageEntries, errorFormatter);

        if (!pageResult.ok) {
            errorSet.append(pageResult.error);
            return {
                ok: false,
                error: errorSet,
            };
        }

        if (errorSet.errors.length) {
            return {
                ok: false,
                error: errorSet,
            };
        }

        return {
            ok: true,
            value: {
                ref: queryRefResult.value,
                params: {
                    ...queryParams,
                    page: pageResult.value,
                },
            },
        };
    }

    make<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        query: Query<P, D, I, 'list' | 'id' | 'relationship'>,
    ): string {
        let output = this.makePath(query.ref);
        const searchParams = new URLSearchParams();

        if (query.params?.include?.length) {
            searchParams.set('include', query.params.include.map((items) => items.join('.')).join(','));
        }

        if (query.params?.fields) {
            Object.keys(query.params.fields).forEach((key) => {
                if (query.params!.fields![key]!.length) {
                    searchParams.set(`fields[${key}]`, query.params!.fields![key]!.join(','));
                } else {
                    searchParams.set(`fields[${key}]`, '');
                }
            });
        }

        if (query.params?.filter) {
            Object.keys(query.params.filter).forEach((key) => {
                query.params!.filter![key]!.forEach((value) => {
                    searchParams.set(`filter[${key}]`, value);
                });
            });
        }

        if (query.params?.page) {
            this.#pageProvider.toEntries(query.params.page).forEach(([key, value]) => {
                searchParams.set(`page[${key}]`, value);
            });
        }

        if (query.params?.sort?.length) {
            searchParams.set(
                `sort`,
                query.params.sort.map((item) => `${item.asc ? '' : '-'}${item.field as string}`).join(','),
            );
        }

        if (searchParams.size) {
            output += `?${searchParams.toString()}`;
        }

        return output;
    }

    makeDefaultQuery<
        D extends ResourceDeclaration,
        T extends 'list' | 'id' | 'relationship',
        R extends keyof D['relationships'] = keyof D['relationships'],
    >(queryRef: QueryRef<D, T, R>): Query<P, D, [], T, R> {
        return {
            ref: queryRef,
            params: {
                fields: {} as ArrayFields<[D]>,
                include: [],
                sort: [],
                filter: {},
                page: this.#pageProvider.makeDefault(),
            },
        };
    }
}
