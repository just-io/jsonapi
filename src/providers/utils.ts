/* eslint-disable @typescript-eslint/no-explicit-any */

import { ResourceDeclaration } from '../resource-declaration';
import { FilterRecord, Meta, MetaResource, PickedResourcePresenter, ResourcePresenter } from './resource-provider';

type NullableKeys<D extends ResourceDeclaration> = keyof FilterRecord<D['relationships'], { nullable: true }>;
type MultipleKeys<D extends ResourceDeclaration> = keyof FilterRecord<D['relationships'], { multiple: true }>;
type SingleKeys<D extends ResourceDeclaration> = Exclude<keyof D['relationships'], NullableKeys<D> | MultipleKeys<D>>;

export class ResourceContainer<
    T extends
        | (ResourcePresenter<any> | PickedResourcePresenter<any, any>)
        | (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[],
    M extends Meta = Meta,
> {
    private data: T;

    private includedResources: (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[];

    constructor(data: T, included: (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[] = []) {
        this.data = data;
        this.includedResources = included;
    }

    get(): T extends (infer D)[] ? MetaResource<D, M>[] : MetaResource<T, M> {
        return this.data as any;
    }

    getRalationship<
        D extends ResourceDeclaration,
        RD extends ResourcePresenter<any> | PickedResourcePresenter<any, any>,
    >(type: D['type'], id: string, relationship: SingleKeys<D>): MetaResource<RD, M>;
    getRalationship<
        D extends ResourceDeclaration,
        RD extends ResourcePresenter<any> | PickedResourcePresenter<any, any>,
    >(type: D['type'], id: string, relationship: NullableKeys<D>): MetaResource<RD, M> | null;
    getRalationship<
        D extends ResourceDeclaration,
        RD extends ResourcePresenter<any> | PickedResourcePresenter<any, any>,
    >(type: D['type'], id: string, relationship: MultipleKeys<D>): MetaResource<RD, M>[];
    getRalationship<
        D extends ResourceDeclaration,
        RD extends ResourcePresenter<any> | PickedResourcePresenter<any, any>,
    >(
        type: D['type'],
        id: string,
        relationship: keyof D['relationships'],
    ): MetaResource<RD, M> | MetaResource<RD, M>[] | null {
        const mainResource =
            (Array.isArray(this.data) ? this.data : [this.data]).find(
                (resource) => resource.type === type && resource.id === id,
            ) ?? this.includedResources.find((resource) => resource.type === type && resource.id === id);
        if (!mainResource) {
            throw new Error(`Cannot find resource with type "${type}" and id "${id}"`);
        }
        if (!mainResource.relationships[relationship]) {
            throw new Error(
                `Cannot relationships "${String(relationship)}" for resource with type "${type}" and id "${id}"`,
            );
        }
        const relationships = mainResource.relationships[relationship].data;
        if (relationships === null) {
            return null;
        }
        if (Array.isArray(relationships)) {
            return relationships
                .map((relationshipResourceIdentifier) => {
                    return this.includedResources.find(
                        (resource) =>
                            resource.type === relationshipResourceIdentifier.type &&
                            resource.id === relationshipResourceIdentifier.id,
                    );
                })
                .filter(Boolean) as MetaResource<RD, M>[];
        }
        return this.includedResources.find(
            (resource) => resource.type === relationships.type && resource.id === relationships.id,
        ) as MetaResource<RD, M>;
    }
}
