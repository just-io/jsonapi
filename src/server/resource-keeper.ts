import {
    ResourceDeclaration,
    NewResource,
    Resource,
    EditableResource,
    Attributes,
    // Relationships,
    RelationshipValue,
} from '../types/resource-declaration';
import { ResourceSchema } from './resource-schema';
import { DataList, UntypedKeys } from '../types/common';
import { ErrorSet, Pointer, Result } from '@just-io/schema';
import { CommonError } from '../types/formats';
import { ErrorFormatter } from './error-formatter';

export interface FetchResourceOptions<D extends ResourceDeclaration, P> {
    page?: P;
    filter?: {
        [K in keyof D['listable']['filter']]?: D['listable']['filter'][K]['type'];
    };
    sort?: {
        field: keyof D['listable']['sort'];
        asc: boolean;
    }[];
    errorFormatter: ErrorFormatter;
    // fields?: (keyof Attributes<D> | keyof Relationships<D>)[];
}

export interface ModifyResourceOptions {
    location: 'query' | Pointer;
    errorFormatter: ErrorFormatter;
}

export type ResourceStatus =
    | {
          type: 'exist';
      }
    | {
          type: 'not-found';
      }
    | {
          type: 'forbidden';
          reason?: string;
      };

export abstract class ResourceKeeper<D extends ResourceDeclaration, C, P> {
    abstract readonly schema: ResourceSchema<D, C, P>;

    abstract status(context: C, ids: string[], errorFormatter: ErrorFormatter): Promise<Record<string, ResourceStatus>>;
    abstract get(context: C, ids: string[], options: Pick<FetchResourceOptions<D, P>, 'page'>): Promise<Resource<D>[]>;

    abstract list(
        context: C,
        options: FetchResourceOptions<D, P>,
    ): Promise<D['listable'] extends { status: true } ? Result<DataList<Resource<D>>, ErrorSet<CommonError>> : never>;

    abstract add(
        context: C,
        resource: NewResource<D>,
        options: ModifyResourceOptions,
    ): Promise<D extends { addable: true } ? Result<string, ErrorSet<CommonError>> : never>;

    abstract update(
        context: C,
        resource: EditableResource<D>,
        options: ModifyResourceOptions,
    ): Promise<D extends { updatable: true } ? Result<void, ErrorSet<CommonError>> : never>;

    abstract remove(
        context: C,
        id: string,
        options: ModifyResourceOptions,
    ): Promise<D extends { removable: true } ? Result<void, ErrorSet<CommonError>> : never>;
}

export type ResourceWithSingleRelationships<D extends ResourceDeclaration> = {
    id: string;
    type: D['type'];
    attributes: Attributes<D>;
    relationships: {
        [K in UntypedKeys<D['relationships'], { multiple: true }>]: RelationshipValue<D['relationships'][K]>;
    };
};

export abstract class FetchableResourceKeeper<D extends ResourceDeclaration, C, P> extends ResourceKeeper<D, C, P> {
    abstract readonly schema: ResourceSchema<D, C, P>;

    abstract status(context: C, ids: string[], errorFormatter: ErrorFormatter): Promise<Record<string, ResourceStatus>>;

    async get(context: C, ids: string[], options: Pick<FetchResourceOptions<D, P>, 'page'>): Promise<Resource<D>[]> {
        const resources = await this.getBase(context, ids, options);
        const multipleRelationshipFields = Object.keys(this.schema.relationships).filter(
            (field) => this.schema.relationships[field].multiple,
        );
        for (const field of multipleRelationshipFields) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const relationshipDescription = this.schema.relationships[field];
            const relationshipDataLists = await relationshipDescription.get(context, ids, {
                page: options.page,
                asMain: false,
            });
            for (const resource of resources) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                resource.relationships[field] = relationshipDataLists[resource.id];
            }
        }

        return resources as unknown as Resource<D>[];
    }

    abstract getBase(
        context: C,
        ids: string[],
        options: Pick<FetchResourceOptions<D, P>, 'page'>,
    ): Promise<ResourceWithSingleRelationships<D>[]>;

    abstract list(
        context: C,
        options: FetchResourceOptions<D, P>,
    ): Promise<D['listable'] extends { status: true } ? Result<DataList<Resource<D>>, ErrorSet<CommonError>> : never>;

    abstract add(
        context: C,
        resource: NewResource<D>,
        options: ModifyResourceOptions,
    ): Promise<D extends { addable: true } ? Result<string, ErrorSet<CommonError>> : never>;

    abstract update(
        context: C,
        resource: EditableResource<D>,
        options: ModifyResourceOptions,
    ): Promise<D extends { updatable: true } ? Result<void, ErrorSet<CommonError>> : never>;

    abstract remove(
        context: C,
        id: string,
        options: ModifyResourceOptions,
    ): Promise<D extends { removable: true } ? Result<void, ErrorSet<CommonError>> : never>;
}

export abstract class ListableResourceKeeper<
    D extends ResourceDeclaration & { listable: true },
    C,
    P,
> extends FetchableResourceKeeper<D, C, P> {
    async list(
        context: C,
        options: FetchResourceOptions<D, P>,
    ): Promise<D['listable'] extends { status: true } ? Result<DataList<Resource<D>>, ErrorSet<CommonError>> : never> {
        const result = await this.listIds(context, options);
        if (!result.ok) {
            return result as unknown as D['listable'] extends { status: true }
                ? Result<DataList<Resource<D>>, ErrorSet<CommonError>>
                : never;
        }
        const resources = await this.get(context, result.value.items, options);

        return {
            ok: true,
            value: {
                items: resources,
                offset: result.value.offset,
                total: result.value.total,
                limit: result.value.limit,
            },
        } as unknown as D['listable'] extends { status: true }
            ? Result<DataList<Resource<D>>, ErrorSet<CommonError>>
            : never;
    }

    abstract listIds(
        context: C,
        options: FetchResourceOptions<D, P>,
    ): Promise<Result<DataList<string>, ErrorSet<CommonError>>>;
}
