import { ResourceIdentifier, ResourceKey } from '../types/common';
import { CommonResource } from '../types/resource-declaration';

export function filterResourceFields(resource: CommonResource, fields?: string[]): CommonResource {
    if (!fields) {
        return resource;
    }
    return {
        id: resource.id,
        type: resource.type,
        attributes: Object.fromEntries(
            Object.entries(resource.attributes).filter((entry) => fields.includes(entry[0])),
        ),
        relationships: Object.fromEntries(
            Object.entries(resource.relationships).filter((entry) => fields.includes(entry[0])),
        ),
    };
}

export function makeResourceKey(type: string, id: string): ResourceKey {
    return `${type}/${id}`;
}

export function makeResourceIdentifierByResourceKey(resourceKey: ResourceKey): ResourceIdentifier<string> {
    const [type, id] = resourceKey.split('/') as [string, string];

    return {
        type,
        id,
    };
}
