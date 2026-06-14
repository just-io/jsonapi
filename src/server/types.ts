import { ErrorSet, Result, Schema } from '@just-io/schema';
import { CommonError } from '../types/formats';
import { CommonQueryRef, DataList, ResourceIdentifier } from '../types/common';
import { ErrorFormatter } from './error-formatter';

export interface PageProvider<P> {
    schema: Schema<P>;
    makeDefault(): P;
    extractFromEntries(entries: [string, string][], errorFormatter: ErrorFormatter): Result<P, ErrorSet<CommonError>>;
    toEntries(page: P): [string, string][];
    getPages(page: P, total: number, limit: number): { first: P; last: P; prev?: P; next?: P };
}

export interface MetaProvider<M> {
    composeList(list: DataList<ResourceIdentifier<string>>): M | undefined;
    compose(resource: ResourceIdentifier<string> | null): M | undefined;
    composeRoot(queryRef: CommonQueryRef): M | undefined;
}
