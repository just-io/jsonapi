import {
    ErrorFormatter as SchemaErrorFormatter,
    defaultErrorFormatter as defaultSchemaErrorFormatter,
} from '@just-io/schema';

export interface ErrorFormatter {
    lang: string;
    schema: SchemaErrorFormatter;
    server: {
        internalTitle: () => string;
        methodNotAllowed: (method: string) => string;
        methodNotAllowedTitle: () => string;
        methodNotAllowedForResourceType: (method: string, type: string) => string;
    };
    resource: {
        invalidResourceType: (type: string) => string;
        invalidResourceTypeTitle: () => string;
        invalidResourceId: () => string;
        invalidResourceIdTitle: () => string;
        invalidResourceLid: () => string;
        invalidResourceLidTitle: () => string;
        invalidResourceField: (type: string, field: string) => string;
        invalidResourceFieldTitle: () => string;
        forbiddenTitle: () => string;
        notFoundTitle: () => string;
        attributeIsReadonly: () => string;
        attributeShouldBeExisted: () => string;
        attributeIsUnchangeable: () => string;
        relationshipIsReadonly: () => string;
        relationshipShouldBeExisted: () => string;
        relationshipIsUnchangeable: () => string;
        relationshipShouldBeArray: () => string;
        relationshipShouldNotBeArray: () => string;
        relationshipShouldBeObject: () => string;
        invalidRelationshipType: (relationship: string, type: string) => string;
    };
    query: {
        invalidTypeTitle: () => string;
        invalidQueryParameterTitle: () => string;
        invalidPageField: (key: string, value: string) => string;
        invalidSortField: (field: string, type: string) => string;
        invalidSortDirAsc: (field: string, type: string) => string;
        invalidSortDirDesc: (field: string, type: string) => string;
        invalidFilterField: (field: string, type: string) => string;
        invalidMultipleFilterField: (field: string, type: string) => string;
        invalidSearchParam: (key: string, value: string) => string;
        invalidId: () => string;
    };
}

export const defaultErrorFormatter: ErrorFormatter = {
    lang: 'default',
    schema: defaultSchemaErrorFormatter,
    server: {
        internalTitle: () => 'The backend responded with an error',
        methodNotAllowed: (method: string) => `The method "${method}" is not allowed.`,
        methodNotAllowedTitle: () => 'Method Not Allowed',
        methodNotAllowedForResourceType: (method: string, type: string) =>
            `The method "${method}" is not allowed for resource with type '${type}'.`,
    },
    resource: {
        invalidResourceType: (type: string) => `The resource with type "${type}" is not existed.`,
        invalidResourceTypeTitle: () => 'Invalid Resource Type',
        invalidResourceId: () => 'The resource with "id" does not equal query "id".',
        invalidResourceIdTitle: () => 'Invalid Resource Id',
        invalidResourceLid: () => 'The resource with "lid" does not have reference.',
        invalidResourceLidTitle: () => 'Invalid Resource Lid',
        invalidResourceField: (type: string, field: string) =>
            `The resource with type "${type}" does not have field "${field}".`,
        invalidResourceFieldTitle: () => 'Invalid Resource Field',
        forbiddenTitle: () => 'Forbidden',
        notFoundTitle: () => 'Not Found',
        attributeIsReadonly: () => 'Attribute is readonly.',
        attributeShouldBeExisted: () => 'Attribute should be existed.',
        attributeIsUnchangeable: () => 'Attribute is unchangeable.',
        relationshipIsReadonly: () => 'Relationship is readonly.',
        relationshipShouldBeExisted: () => 'Relationship should be existed.',
        relationshipIsUnchangeable: () => 'Relationship is unchangeable.',
        relationshipShouldBeArray: () => 'The relationship data should be array.',
        relationshipShouldNotBeArray: () => 'The relationship data should not be array.',
        relationshipShouldBeObject: () => 'The relationship data should be object.',
        invalidRelationshipType: (relationship: string, type: string) =>
            `Relationship "${relationship}" has incorrected type "${type}".`,
    },
    query: {
        invalidTypeTitle: () => 'Type should be existed',
        invalidQueryParameterTitle: () => 'Invalid Query Parameter',
        invalidPageField: (key: string, value: string) => `Invalid page search param "${key}=${value}"`,
        invalidSortField: (field: string, type: string) =>
            `Sorting by field "${field}" does not support in type "${type}"`,
        invalidSortDirAsc: (field: string, type: string) =>
            `Sorting by field "${field}" does not support ascending order in type "${type}"`,
        invalidSortDirDesc: (field: string, type: string) =>
            `Sorting by field "${field}" does not support descending order in type "${type}"`,
        invalidFilterField: (field: string, type: string) =>
            `Filtering by field "filter[${field}]" does not support in type "${type}"`,
        invalidMultipleFilterField: (field: string, type: string) =>
            `Filtering by field "filter[${field}]" does not support multiple values in type "${type}"`,
        invalidSearchParam: (key: string, value: string) => `Invalid search param "${key}=${value}"`,
        invalidId: () => 'Should not contain resource id',
    },
};
