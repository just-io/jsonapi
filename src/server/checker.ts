import { defaultErrorFormatter, ErrorKeeper, ErrorSet, Pointer } from '@just-io/schema';

import { ErrorFactory } from './errors';
import { CommonEditableResource, CommonNewResource, ResourceDeclaration } from '../types/resource-declaration';
import { ResourceKeeper } from './resource-keeper';
import { CommonAttributeFieldSchema, CommonRelationshipFieldSchema } from './resource-schema';
import {
    FilterFields,
    PageProvider,
    ResourceIdentifier,
    SortField,
    Query,
    QueryRef,
    OperationRelationshipValue,
} from '../types/common';
import { CommonError } from '../types/formats';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommonResourceKeeper<C, P> = ResourceKeeper<any, C, P>;

export class Checker<C, P> {
    #resourceKeepers: Record<string, CommonResourceKeeper<C, P>> = {};

    #pageProvider: PageProvider<P>;

    constructor(pageProvider: PageProvider<P>) {
        this.#pageProvider = pageProvider;
    }

    addResourceKeeper(resourceKeeper: CommonResourceKeeper<C, P>): this {
        this.#resourceKeepers[resourceKeeper.schema.type] = resourceKeeper;
        return this;
    }

    #checkRef<D extends ResourceDeclaration>(
        method: 'get' | 'list' | 'add' | 'update' | 'remove',
        ref: QueryRef<D, 'list' | 'id' | 'relationship'>,
        location: Pointer | 'query',
        checkMethod: boolean,
    ): ErrorSet<CommonError> {
        const resourceKeeper = this.#resourceKeepers[ref.type];
        if (!resourceKeeper) {
            return new ErrorSet<CommonError>().add(ErrorFactory.makeInvalidResourceTypeError(ref.type, location));
        }
        if (!checkMethod) {
            return new ErrorSet<CommonError>();
        }
        if (method === 'list' && !resourceKeeper.schema.listable) {
            if (location === 'query') {
                return new ErrorSet<CommonError>().add(ErrorFactory.makeMethodNotAllowedError('get'));
            }
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeMethodNotAllowedErrorByPointer('list', ref.type, location),
            );
        }
        if (method === 'add' && !resourceKeeper.schema.addable) {
            if (location === 'query') {
                return new ErrorSet<CommonError>().add(ErrorFactory.makeMethodNotAllowedError('post'));
            }
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeMethodNotAllowedErrorByPointer('add', ref.type, location),
            );
        }
        if (method === 'update' && !resourceKeeper.schema.updatable) {
            if (location === 'query') {
                return new ErrorSet<CommonError>().add(ErrorFactory.makeMethodNotAllowedError('patch'));
            }
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeMethodNotAllowedErrorByPointer('update', ref.type, location),
            );
        }
        if (method === 'remove' && !resourceKeeper.schema.removable) {
            if (location === 'query') {
                return new ErrorSet<CommonError>().add(ErrorFactory.makeMethodNotAllowedError('delete'));
            }
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeMethodNotAllowedErrorByPointer('remove', ref.type, location),
            );
        }

        return new ErrorSet<CommonError>();
    }

    #checkPage(page: P, location: Pointer | 'page'): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const errorKeeper = new ErrorKeeper('default', defaultErrorFormatter);
        if (!this.#pageProvider.schema.is(page, errorKeeper)) {
            errorKeeper.forEach((error) => {
                errorSet.add(ErrorFactory.makeInvalidQueryParameterError(location, error.details));
            });
        }

        return errorSet;
    }

    checkQuery<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        method: 'get' | 'list' | 'add' | 'update' | 'remove',
        query: Query<P, D, I, 'list' | 'id' | 'relationship'>,
        location: Pointer | 'query',
        checkMethod: boolean,
    ): ErrorSet<CommonError> {
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        if (!resourceKeeper) {
            return new ErrorSet<CommonError>().add(ErrorFactory.makeInvalidResourceTypeError(query.ref.type, location));
        }
        const errorSet = this.#checkRef(method, query.ref, location, checkMethod);
        if (query.params?.fields) {
            errorSet.append(
                this.#checkPresenceOfFields(
                    query.params.fields as Record<string, string[]>,
                    location === 'query' ? 'fields' : location.concat('params', 'fields'),
                ),
            );
        }
        if (query.params?.sort) {
            errorSet.append(
                this.#checkSortFields(
                    query.ref.type,
                    query.params.sort as SortField[],
                    location === 'query' ? 'sort' : location.concat('params', 'sort'),
                ),
            );
        }
        if (query.params?.filter) {
            errorSet.append(
                this.#checkFilterFields(
                    query.ref.type,
                    query.params.filter as FilterFields,
                    location === 'query' ? 'filter' : location.concat('params', 'filter'),
                ),
            );
        }
        if (query.params?.include) {
            errorSet.append(
                this.#checkInclude(
                    query.ref.type,
                    query.params.include,
                    location === 'query' ? 'include' : location.concat('params', 'include'),
                ),
            );
        }
        if (query.params?.page) {
            errorSet.append(
                this.#checkPage(query.params.page, location === 'query' ? 'page' : location.concat('params', 'page')),
            );
        }

        return errorSet;
    }

    #checkInclude(type: string, include: string[][], location: Pointer | 'include'): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();

        for (const list of include) {
            let resourceKeepers = [this.#resourceKeepers[type]];
            for (const item of list) {
                if (!resourceKeepers.length) {
                    errorSet.add(ErrorFactory.makeInvalidQueryParameterError(location));
                    break;
                }
                if (resourceKeepers.every((resourceKeeper) => !resourceKeeper.schema.relationships[item])) {
                    errorSet.add(ErrorFactory.makeInvalidQueryParameterError(location));
                    break;
                }
                resourceKeepers = resourceKeepers
                    .map((resourceKeeper) =>
                        resourceKeeper.schema.relationships[item].types.map(
                            (relationshipsTypes) => this.#resourceKeepers[relationshipsTypes],
                        ),
                    )
                    .flat();
            }
        }

        return errorSet;
    }

    #checkPresenceOfFields(fields: Record<string, string[]>, location: Pointer | 'fields'): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();

        Object.keys(fields).forEach((type) => {
            const fieldResourceKeeper = this.#resourceKeepers[type];
            if (!fieldResourceKeeper) {
                errorSet.add(
                    ErrorFactory.makeInvalidQueryParameterError(
                        location,
                        `The resource type '${type}' does not exist.`,
                    ),
                );
                return;
            }
            fields[type]
                .filter(
                    (field) =>
                        fieldResourceKeeper.schema.attributes[field] === undefined &&
                        fieldResourceKeeper.schema.relationships[field] === undefined,
                )
                .forEach((field) => {
                    errorSet.add(
                        ErrorFactory.makeInvalidQueryParameterError(
                            location,
                            `The resource type '${type}' does not have field '${field}'.`,
                        ),
                    );
                });
        });

        return errorSet;
    }

    #checkResourceAttributeValue(
        pointer: Pointer,
        type: string,
        attribute: string,
        value: unknown,
        isNew: boolean,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];

        const attributeFieldSchema = resourceKeeper.schema.attributes[attribute] as CommonAttributeFieldSchema<unknown>;
        if (attributeFieldSchema === undefined) {
            return errorSet.add(ErrorFactory.makeContainingFieldError(pointer, attribute));
        }
        if (attributeFieldSchema.mode === 'readonly') {
            if (value === undefined) {
                return errorSet;
            }
            return errorSet.add(ErrorFactory.makeFieldError(pointer, 'Attribute is readonly.'));
        }
        if (value === undefined) {
            if (isNew) {
                if (attributeFieldSchema.optional) {
                    return errorSet;
                } else {
                    return errorSet.add(ErrorFactory.makeFieldError(pointer, 'Attribute should be existed.'));
                }
            }
            return errorSet;
        }
        if (value !== undefined && attributeFieldSchema.mode === 'unchangeable' && !isNew) {
            return errorSet.add(ErrorFactory.makeFieldError(pointer, 'Attribute is unchangeable.'));
        }

        const errorKeeper = new ErrorKeeper(pointer, 'default', defaultErrorFormatter);

        if (!attributeFieldSchema.schema.is(value, errorKeeper)) {
            errorKeeper.forEach((error) => {
                errorSet.add(ErrorFactory.makeFieldError(error.pointer, error.details));
            });
        }
        return errorSet;
    }

    checkResourceRelationshipValue(
        pointer: Pointer,
        type: string,
        relationship: string,
        resourceIdentifiers: ResourceIdentifier<string> | ResourceIdentifier<string>[] | null | undefined,
        isNew: boolean,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];

        if (!resourceKeeper) {
            return errorSet.add(ErrorFactory.makeInvalidResourceTypeError(type, 'query'));
        }

        const relationshipFieldSchema = resourceKeeper.schema.relationships[
            relationship
        ] as CommonRelationshipFieldSchema<C, P>;
        if (relationshipFieldSchema === undefined) {
            return errorSet.add(ErrorFactory.makeContainingFieldError(pointer, relationship));
        }
        if (relationshipFieldSchema.mode === 'readonly') {
            return errorSet.add(ErrorFactory.makeFieldError(pointer, 'Relationship is readonly.'));
        }
        if (resourceIdentifiers === undefined) {
            if (isNew) {
                if (relationshipFieldSchema.optional) {
                    return errorSet;
                } else {
                    return errorSet.add(ErrorFactory.makeFieldError(pointer, 'Relationship should be existed.'));
                }
            }
            return errorSet;
        }
        if (relationshipFieldSchema.mode === 'unchangeable' && !isNew) {
            return errorSet.add(ErrorFactory.makeFieldError(pointer, 'Relationship is unchangeable.'));
        }
        if (relationshipFieldSchema.multiple) {
            if (!Array.isArray(resourceIdentifiers)) {
                errorSet.add(ErrorFactory.makeFieldError(pointer, 'The relationship data should be array.'));
                return errorSet;
            }
            resourceIdentifiers.forEach((resourceIdentifier, i) => {
                if (!relationshipFieldSchema.types.includes(resourceIdentifier.type)) {
                    errorSet.add(
                        ErrorFactory.makeFieldError(
                            pointer.concat(i, 'type'),
                            `Relationship '${relationship}' has incorrected type '${resourceIdentifier.type}'.`,
                        ),
                    );
                }
            });
        } else {
            if (Array.isArray(resourceIdentifiers)) {
                return errorSet.add(ErrorFactory.makeFieldError(pointer, 'The relationship data should not be array.'));
            }
            if (!relationshipFieldSchema.nullable && resourceIdentifiers === null) {
                return errorSet.add(ErrorFactory.makeFieldError(pointer, 'The relationship data should be object.'));
            }
            if (resourceIdentifiers && !relationshipFieldSchema.types.includes(resourceIdentifiers.type)) {
                errorSet.add(
                    ErrorFactory.makeFieldError(
                        pointer.concat('type'),
                        `Relationship '${relationship}' has incorrected type '${resourceIdentifiers.type}'.`,
                    ),
                );
            }
        }

        return errorSet;
    }

    checkResourceFields(
        pointer: Pointer,
        type: string,
        resource: Omit<CommonNewResource | CommonEditableResource, 'id'>,
        isNew: boolean,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];

        if (!resourceKeeper) {
            return errorSet.add(ErrorFactory.makeInvalidResourceTypeError(type, 'query'));
        }

        Object.keys(resource.attributes).forEach((field) => {
            const errors = this.#checkResourceAttributeValue(
                pointer.concat('attributes', field),
                type,
                field,
                resource.attributes[field],
                isNew,
            );
            errorSet.append(errors);
        });

        Object.keys(resource.relationships).forEach((field) => {
            const errors = this.checkResourceRelationshipValue(
                pointer.concat('relationships', field),
                type,
                field,
                resource.relationships[field]!,
                isNew,
            );
            errorSet.append(errors);
        });

        return errorSet;
    }

    checkResourceFieldsForExisting(
        pointer: Pointer,
        type: string,
        resource: Omit<CommonNewResource, 'id'>,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];

        if (!resourceKeeper) {
            return errorSet.add(ErrorFactory.makeInvalidResourceTypeError(type, 'query'));
        }

        Object.keys(resourceKeeper.schema.attributes).forEach((attribute) => {
            const attributeFieldSchema = resourceKeeper.schema.attributes[
                attribute
            ] as CommonAttributeFieldSchema<unknown>;
            if (
                attributeFieldSchema.mode !== 'readonly' &&
                resource.attributes[attribute] === undefined &&
                !attributeFieldSchema.optional
            ) {
                errorSet.add(
                    ErrorFactory.makeFieldError(pointer.concat('attributes', attribute), 'Attribute should be existed'),
                );
            }
        });

        Object.keys(resourceKeeper.schema.relationships).forEach((relationship) => {
            const relationshipFieldSchema = resourceKeeper.schema.relationships[
                relationship
            ] as CommonRelationshipFieldSchema<C, P>;
            if (
                relationshipFieldSchema.mode !== 'readonly' &&
                resource.relationships[relationship] === undefined &&
                !relationshipFieldSchema.optional
            ) {
                errorSet.add(
                    ErrorFactory.makeFieldError(
                        pointer.concat('relationships', relationship),
                        'Relationship should be existed',
                    ),
                );
            }
        });

        return errorSet;
    }

    checkOperationResourceIdentifier(
        value: OperationRelationshipValue<ResourceDeclaration>,
        lidMap: Map<string, string>,
        pointer: Pointer,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                const item = value[i];
                if ('lid' in item && !lidMap.has(item.lid)) {
                    errorSet.add(ErrorFactory.makeInvalidResourceLidError(pointer.concat(i, 'lid')));
                }
            }
        } else if (value !== null) {
            if ('lid' in value && !lidMap.has(value.lid)) {
                errorSet.add(ErrorFactory.makeInvalidResourceLidError(pointer.concat('lid')));
            }
        }

        return errorSet;
    }

    #checkSortField(type: string, sortField: SortField, location: Pointer | 'sort'): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];
        if (!resourceKeeper.schema.listable) {
            throw new Error('Invalid');
        }
        if (!resourceKeeper.schema.sort[sortField.field]) {
            return errorSet.add(
                ErrorFactory.makeInvalidQueryParameterError(
                    location,
                    `Sorting by field "${sortField.field}" does not support in type "${type}"`,
                ),
            );
        }
        if (resourceKeeper.schema.sort[sortField.field].dir === 'asc' && !sortField.asc) {
            return errorSet.add(
                ErrorFactory.makeInvalidQueryParameterError(
                    location,
                    `Sorting by field "${sortField.field}" does not support descending order in type "${type}"`,
                ),
            );
        }
        if (resourceKeeper.schema.sort[sortField.field].dir === 'desc' && sortField.asc) {
            return errorSet.add(
                ErrorFactory.makeInvalidQueryParameterError(
                    location,
                    `Sorting by field "${sortField.field}" does not support ascending order in type "${type}"`,
                ),
            );
        }

        return errorSet;
    }

    #checkSortFields(type: string, sortFields: SortField[], location: Pointer | 'sort'): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        for (let i = 0; i < sortFields.length; i++) {
            errorSet.append(this.#checkSortField(type, sortFields[i], location));
        }

        return errorSet;
    }

    #checkFilterField(
        type: string,
        field: string,
        values: string[],
        location: Pointer | 'filter',
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];
        if (!resourceKeeper.schema.listable) {
            throw new Error('Invalid');
        }
        if (!resourceKeeper.schema.filter[field]) {
            return errorSet.add(
                ErrorFactory.makeInvalidQueryParameterError(
                    location,
                    `Filtering by field "filter[${field}]" does not support in type "${type}"`,
                ),
            );
        }
        if (!resourceKeeper.schema.filter[field].multiple && values.length > 1) {
            return errorSet.add(
                ErrorFactory.makeInvalidQueryParameterError(
                    location,
                    `Filtering by field "filter[${field}]" does not support multiple values in type "${type}"`,
                ),
            );
        }

        return errorSet;
    }

    #checkFilterFields(type: string, filterFields: FilterFields, location: Pointer | 'filter'): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        for (const field in filterFields) {
            errorSet.append(this.#checkFilterField(type, field, filterFields[field], location));
        }

        return errorSet;
    }
}
