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
