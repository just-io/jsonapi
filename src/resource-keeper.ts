import {
    ResourceDeclaration,
    NewResource,
    Resource,
    EditableResource,
    Attributes,
    Relationships,
    RelationshipValue,
} from './resource-declaration';
import { ResourceSchema } from './resource-schema';
import { DataList, UntypedKeys } from './types';

export interface ResourceOptions<D extends ResourceDeclaration, P> {
    page?: P;
    filter?: {
        [K in keyof D['filter']]?: D['filter'][K]['type'];
    };
    sort?: {
        field: keyof D['sort'];
        asc: boolean;
    }[];
    fields?: (keyof Attributes<D> | keyof Relationships<D>)[];
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

    abstract status(context: C, ids: string[]): Promise<Record<string, ResourceStatus>>;
    abstract get(
        context: C,
        ids: string[],
        options: Pick<ResourceOptions<D, P>, 'fields' | 'page'>,
    ): Promise<Resource<D>[]>;

    abstract list(
        context: C,
        options: ResourceOptions<D, P>,
    ): Promise<D extends { listable: true } ? DataList<Resource<D>> : never>;

    abstract add(context: C, resource: NewResource<D>): Promise<D extends { addable: true } ? string : never>;

    abstract update(context: C, resource: EditableResource<D>): Promise<D extends { updatable: true } ? void : never>;

    abstract remove(context: C, id: string): Promise<D extends { removable: true } ? void : never>;
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

    abstract status(context: C, ids: string[]): Promise<Record<string, ResourceStatus>>;

    async get(
        context: C,
        ids: string[],
        options: Pick<ResourceOptions<D, P>, 'fields' | 'page'>,
    ): Promise<Resource<D>[]> {
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

        return resources as unknown as D extends { getable: true } ? Resource<D>[] : never;
    }

    abstract getBase(
        context: C,
        ids: string[],
        options: Pick<ResourceOptions<D, P>, 'fields' | 'page'>,
    ): Promise<ResourceWithSingleRelationships<D>[]>;

    abstract list(
        context: C,
        options: ResourceOptions<D, P>,
    ): Promise<D extends { listable: true } ? DataList<Resource<D>> : never>;

    abstract add(context: C, resource: NewResource<D>): Promise<D extends { addable: true } ? string : never>;

    abstract update(context: C, resource: EditableResource<D>): Promise<D extends { updatable: true } ? void : never>;

    abstract remove(context: C, id: string): Promise<D extends { removable: true } ? void : never>;
}

export abstract class ListableResourceKeeper<
    D extends ResourceDeclaration & { listable: true },
    C,
    P,
> extends FetchableResourceKeeper<D, C, P> {
    async list(
        context: C,
        options: ResourceOptions<D, P>,
    ): Promise<D extends { listable: true } ? DataList<Resource<D>> : never> {
        const idList = await this.listIds(context, options);
        const resources = (await this.get(context, idList.items, options)) as unknown as Resource<D>;

        return {
            items: resources,
            offset: idList.offset,
            total: idList.total,
            limit: idList.limit,
        } as unknown as D extends { listable: true } ? DataList<Resource<D>> : never;
    }

    abstract listIds(context: C, options: ResourceOptions<D, P>): Promise<DataList<string>>;
}
