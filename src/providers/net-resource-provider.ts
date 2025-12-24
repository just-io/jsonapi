/* eslint-disable @typescript-eslint/no-explicit-any */
import ResourceProvider, {
    Request,
    Response,
    AdditionalRequestParams,
    GetResourceResponse,
    GetResourseRequest,
    Result,
    GetResourcesResponse,
    GetResoursesRequest,
    GetRelationshipResponse,
    GetRelationshipRequest,
    AddResourceResponse,
    AddResourseRequest,
    AddRelationshipResponse,
    AddRelationshipRequest,
    UpdateResourceResponse,
    UpdateResourseRequest,
    UpdateRelationshipResponse,
    UpdateRelationshipRequest,
    RemoveResourceResponse,
    RemoveResourseRequest,
    RemoveRelationshipResponse,
    RemoveRelationshipRequest,
    Operations,
    OperationResult,
    Meta,
} from './resource-provider';

export type FetchData = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    headers: Record<string, string>,
    body?: unknown,
) => Promise<unknown>;

export interface Composer<P> {
    composePage(page: P): [string, string][];
}

export class NetResourceProvider<P, M extends Meta = Meta> implements ResourceProvider<P, M> {
    private prefix: string;

    private fetchData: FetchData;

    private composer: Composer<P>;

    constructor(prefix: string, fetchData: FetchData, composer: Composer<P>) {
        this.prefix = prefix;
        this.fetchData = fetchData;
        this.composer = composer;
    }

    protected composeSearchParams<R>(query: Request<R> & AdditionalRequestParams<P>): URLSearchParams {
        const searchParams = new URLSearchParams();
        if (query.params.fields) {
            Object.entries<string[]>(query.params.fields).forEach(([key, values]) => {
                searchParams.append(`fields[${key}]`, values.join(','));
            });
        }
        if ('filter' in query.params && query.params.filter) {
            Object.entries<string[] | string>(query.params.filter as Record<string, string[] | string>).forEach(
                ([key, value]) => {
                    if (Array.isArray(value)) {
                        value.forEach((filterValue) => {
                            searchParams.append(`filter[${key}]`, filterValue);
                        });
                    } else {
                        searchParams.append(`filter[${key}]`, value);
                    }
                },
            );
        }
        if (query.params.page) {
            this.composer.composePage(query.params.page).forEach(([key, value]) => {
                searchParams.append(`page[${key}]`, value);
            });
        }
        if ('sort' in query.params && query.params.sort) {
            searchParams.append(
                'sort',
                query.params.sort.map((item) => `${item.asc ? '' : '-'}${item.field as string}`).join(','),
            );
        }
        if (query.params.include) {
            searchParams.append('include', query.params.include.map((item) => item.join('.')).join(','));
        }

        return searchParams;
    }

    getResourse<GRR extends GetResourceResponse<any, any>>(
        query: GetResourseRequest<GRR> & AdditionalRequestParams<P>,
    ): Promise<Result<GRR, M>> {
        const url = `${this.prefix}/${query.ref.type}/${query.ref.id}?${this.composeSearchParams(
            query as Request<GRR> & AdditionalRequestParams<P>,
        ).toString()}`;

        return this.fetchData('GET', url, {}) as Promise<Result<GRR, M>>;
    }

    getResourses<GRR extends GetResourcesResponse<any, any>>(
        query: GetResoursesRequest<GRR> & AdditionalRequestParams<P>,
    ): Promise<Result<GRR, M>> {
        const url = `${this.prefix}/${query.ref.type}?${this.composeSearchParams(
            query as Request<GRR> & AdditionalRequestParams<P>,
        ).toString()}`;

        return this.fetchData('GET', url, {}) as Promise<Result<GRR, M>>;
    }

    getRelationship<GRR extends GetRelationshipResponse<any, any, any>>(
        query: GetRelationshipRequest<GRR> & AdditionalRequestParams<P>,
    ): Promise<Result<GRR, M>> {
        const url = `${this.prefix}/${query.ref.type}/${query.ref.id}/relationships/${
            query.ref.relationship
        }?${this.composeSearchParams(query as Request<GRR> & AdditionalRequestParams<P>).toString()}`;

        return this.fetchData('GET', url, {}) as Promise<Result<GRR, M>>;
    }

    addResourse<ARR extends AddResourceResponse<any, any>>(
        query: AddResourseRequest<ARR> & AdditionalRequestParams<P>,
    ): Promise<Result<ARR, M>> {
        const url = `${this.prefix}/${query.ref.type}?${this.composeSearchParams(
            query as Request<ARR> & AdditionalRequestParams<P>,
        ).toString()}`;

        return this.fetchData('POST', url, {}, query.data) as Promise<Result<ARR, M>>;
    }

    addRelationship<ARR extends AddRelationshipResponse<any, any, any>>(
        query: AddRelationshipRequest<ARR> & AdditionalRequestParams<P>,
    ): Promise<Result<ARR, M>> {
        const url = `${this.prefix}/${query.ref.type}/${query.ref.id}/relationships/${
            query.ref.relationship
        }?${this.composeSearchParams(query as Request<ARR> & AdditionalRequestParams<P>).toString()}`;

        return this.fetchData('POST', url, {}, query.data) as Promise<Result<ARR, M>>;
    }

    updateResourse<URR extends UpdateResourceResponse<any, any>>(
        query: UpdateResourseRequest<URR> & AdditionalRequestParams<P>,
    ): Promise<Result<URR, M>> {
        const url = `${this.prefix}/${query.ref.type}/${query.ref.id}?${this.composeSearchParams(
            query as Request<URR> & AdditionalRequestParams<P>,
        ).toString()}`;

        return this.fetchData('PATCH', url, {}, query.data) as Promise<Result<URR, M>>;
    }

    updateRelationship<URR extends UpdateRelationshipResponse<any, any, any>>(
        query: UpdateRelationshipRequest<URR> & AdditionalRequestParams<P>,
    ): Promise<Result<URR, M>> {
        const url = `${this.prefix}/${query.ref.type}/${query.ref.id}/relationships/${
            query.ref.relationship
        }?${this.composeSearchParams(query as Request<URR> & AdditionalRequestParams<P>).toString()}`;

        return this.fetchData('PATCH', url, {}, query.data) as Promise<Result<URR, M>>;
    }

    removeResourse<RRR extends RemoveResourceResponse<any>>(
        query: RemoveResourseRequest<RRR> & AdditionalRequestParams<P>,
    ): Promise<Result<RRR, M>> {
        const url = `${this.prefix}/${query.ref.type}/${query.ref.id}?${this.composeSearchParams(
            query as Request<RRR> & AdditionalRequestParams<P>,
        ).toString()}`;

        return this.fetchData('DELETE', url, {}) as Promise<Result<RRR, M>>;
    }

    removeRelationship<RRR extends RemoveRelationshipResponse<any, any, any>>(
        query: RemoveRelationshipRequest<RRR> & AdditionalRequestParams<P>,
    ): Promise<Result<RRR, M>> {
        const url = `${this.prefix}/${query.ref.type}/${query.ref.id}/relationships/${
            query.ref.relationship
        }?${this.composeSearchParams(query as Request<RRR> & AdditionalRequestParams<P>).toString()}`;

        return this.fetchData('DELETE', url, {}, query.data) as Promise<Result<RRR, M>>;
    }

    bulk<OR extends Response[]>(query: Operations<OR, P>): Promise<OperationResult<OR, M>> {
        const url = `${this.prefix}/bulk`;

        return this.fetchData('PATCH', url, {}, { operations: query }) as Promise<Result<{ operations: OR }, M>>;
    }
}
