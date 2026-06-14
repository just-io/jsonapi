import { ResourceIdentifier, ResourceKey } from '../types/common';
import { CommonResource } from '../types/resource-declaration';

export function filterResourceFields(resource: CommonResource, fields?: string[]): CommonResource {
    if (!fields) {
        return resource;
    }
    Object.keys(resource.attributes).forEach((key) => {
        if (!fields.includes(key)) {
            delete resource.attributes[key];
        }
    });
    Object.keys(resource.relationships).forEach((key) => {
        if (!fields.includes(key)) {
            delete resource.relationships[key];
        }
    });
    return resource;
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
