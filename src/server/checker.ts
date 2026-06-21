import { defaultErrorFormatter, ErrorSet, Pointer } from '@just-io/schema';

import { ErrorFactory } from './errors';
import { CommonEditableResource, CommonNewResource, ResourceDeclaration } from '../types/resource-declaration';
import { ResourceKeeper } from './resource-keeper';
import { CommonAttributeFieldSchema, CommonRelationshipFieldSchema } from './resource-schema';
import {
    FilterFields,
    ResourceIdentifier,
    SortField,
    Query,
    QueryRef,
    OperationRelationshipValue,
} from '../types/common';
import { CommonError } from '../types/formats';
import { ObservationQuery } from '../types/observer';
import { ErrorFormatter } from './error-formatter';
import { PageProvider } from './types';

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
        checkMethod: boolean,
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const resourceKeeper = this.#resourceKeepers[ref.type];
        if (!resourceKeeper) {
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeInvalidResourceTypeError(errorFormatter, ref.type, 'query'),
            );
        }
        if (!checkMethod) {
            return new ErrorSet<CommonError>();
        }
        if (method === 'list' && !resourceKeeper.schema.listable) {
            return new ErrorSet<CommonError>().add(ErrorFactory.makeMethodNotAllowedError(errorFormatter, 'get'));
        }
        if (method === 'add' && !resourceKeeper.schema.addable) {
            return new ErrorSet<CommonError>().add(ErrorFactory.makeMethodNotAllowedError(errorFormatter, 'post'));
        }
        if (method === 'update' && !resourceKeeper.schema.updatable) {
            return new ErrorSet<CommonError>().add(ErrorFactory.makeMethodNotAllowedError(errorFormatter, 'patch'));
        }
        if (method === 'remove' && !resourceKeeper.schema.removable) {
            return new ErrorSet<CommonError>().add(ErrorFactory.makeMethodNotAllowedError(errorFormatter, 'delete'));
        }

        return new ErrorSet<CommonError>();
    }

    checkResourceMethod<D extends ResourceDeclaration>(
        method: 'get' | 'list' | 'add' | 'update' | 'remove',
        ref: QueryRef<D, 'list' | 'id' | 'relationship'>,
        location: Pointer,
        checkMethod: boolean,
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const resourceKeeper = this.#resourceKeepers[ref.type];
        if (!resourceKeeper) {
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeInvalidResourceTypeError(errorFormatter, ref.type, location),
            );
        }
        if (!checkMethod) {
            return new ErrorSet<CommonError>();
        }
        if (method === 'list' && !resourceKeeper.schema.listable) {
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeMethodNotAllowedErrorByPointer(errorFormatter, 'list', ref.type, location),
            );
        }
        if (method === 'add' && !resourceKeeper.schema.addable) {
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeMethodNotAllowedErrorByPointer(errorFormatter, 'add', ref.type, location),
            );
        }
        if (method === 'update' && !resourceKeeper.schema.updatable) {
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeMethodNotAllowedErrorByPointer(errorFormatter, 'update', ref.type, location),
            );
        }
        if (method === 'remove' && !resourceKeeper.schema.removable) {
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeMethodNotAllowedErrorByPointer(errorFormatter, 'remove', ref.type, location),
            );
        }

        return new ErrorSet<CommonError>();
    }

    #checkPage(page: P, errorFormatter: ErrorFormatter): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const result = this.#pageProvider.schema.validate(page, new Pointer(), defaultErrorFormatter, false);
        if (!result.ok) {
            result.error.errors.forEach((error) => {
                errorSet.add(ErrorFactory.makeInvalidQueryParameterError(errorFormatter, 'page', error.detail));
            });
        }

        return errorSet;
    }

    checkQuery<D extends ResourceDeclaration, I extends ResourceDeclaration[]>(
        method: 'get' | 'list' | 'add' | 'update' | 'remove',
        query: Query<P, D, I, 'list' | 'id' | 'relationship'>,
        checkMethod: boolean,
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const resourceKeeper = this.#resourceKeepers[query.ref.type];
        if (!resourceKeeper) {
            return new ErrorSet<CommonError>().add(
                ErrorFactory.makeInvalidResourceTypeError(errorFormatter, query.ref.type, 'query'),
            );
        }
        const errorSet = this.#checkRef(method, query.ref, checkMethod, errorFormatter);
        if (query.params?.fields) {
            errorSet.append(
                this.#checkPresenceOfFields(query.params.fields as Record<string, string[]>, errorFormatter),
            );
        }
        if (query.params?.sort) {
            errorSet.append(this.#checkSortFields(query.ref.type, query.params.sort as SortField[], errorFormatter));
        }
        if (query.params?.filter) {
            errorSet.append(
                this.#checkFilterFields(query.ref.type, query.params.filter as FilterFields, errorFormatter),
            );
        }
        if (query.params?.include) {
            errorSet.append(this.#checkInclude(query.ref.type, query.params.include, errorFormatter));
        }
        if (query.params?.page) {
            errorSet.append(this.#checkPage(query.params.page, errorFormatter));
        }

        return errorSet;
    }

    #checkInclude(type: string, include: string[][], errorFormatter: ErrorFormatter): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();

        for (const list of include) {
            let resourceKeepers = [this.#resourceKeepers[type]];
            for (const item of list) {
                if (!resourceKeepers.length) {
                    errorSet.add(ErrorFactory.makeInvalidQueryParameterError(errorFormatter, 'include'));
                    break;
                }
                if (resourceKeepers.some((resourceKeeper) => !resourceKeeper.schema.relationships[item])) {
                    errorSet.add(ErrorFactory.makeInvalidQueryParameterError(errorFormatter, 'include'));
                    break;
                }
                resourceKeepers = resourceKeepers.flatMap((resourceKeeper) =>
                    resourceKeeper.schema.relationships[item].types.map(
                        (relationshipsTypes) => this.#resourceKeepers[relationshipsTypes],
                    ),
                );
            }
        }

        return errorSet;
    }

    #checkPresenceOfFields(fields: Record<string, string[]>, errorFormatter: ErrorFormatter): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();

        Object.keys(fields).forEach((type) => {
            const fieldResourceKeeper = this.#resourceKeepers[type];
            if (!fieldResourceKeeper) {
                errorSet.add(
                    ErrorFactory.makeInvalidQueryParameterError(
                        errorFormatter,
                        'fields',
                        errorFormatter.resource.invalidResourceType(type),
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
                            errorFormatter,
                            'fields',
                            errorFormatter.resource.invalidResourceField(type, field),
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
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];

        const attributeFieldSchema = resourceKeeper.schema.attributes[attribute] as CommonAttributeFieldSchema<unknown>;
        if (attributeFieldSchema === undefined) {
            return errorSet.add(ErrorFactory.makeContainingFieldError(errorFormatter, pointer, type, attribute));
        }
        if (attributeFieldSchema.mode === 'readonly') {
            if (value === undefined) {
                return errorSet;
            }
            return errorSet.add(
                ErrorFactory.makeFieldError(errorFormatter, pointer, errorFormatter.resource.attributeIsReadonly()),
            );
        }
        if (value === undefined) {
            if (isNew) {
                if (attributeFieldSchema.optional) {
                    return errorSet;
                } else {
                    return errorSet.add(
                        ErrorFactory.makeFieldError(
                            errorFormatter,
                            pointer,
                            errorFormatter.resource.attributeShouldBeExisted(),
                        ),
                    );
                }
            }
            return errorSet;
        }
        if (value !== undefined && attributeFieldSchema.mode === 'unchangeable' && !isNew) {
            return errorSet.add(
                ErrorFactory.makeFieldError(errorFormatter, pointer, errorFormatter.resource.attributeIsUnchangeable()),
            );
        }

        const result = attributeFieldSchema.schema.validate(value, pointer, defaultErrorFormatter, false);
        if (!result.ok) {
            result.error.errors.forEach((error) => {
                errorSet.add(ErrorFactory.makeFieldError(errorFormatter, error.pointer, error.detail));
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
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];

        if (!resourceKeeper) {
            return errorSet.add(ErrorFactory.makeInvalidResourceTypeError(errorFormatter, type, 'query'));
        }

        const relationshipFieldSchema = resourceKeeper.schema.relationships[
            relationship
        ] as CommonRelationshipFieldSchema<C, P>;
        if (relationshipFieldSchema === undefined) {
            return errorSet.add(ErrorFactory.makeContainingFieldError(errorFormatter, pointer, type, relationship));
        }
        if (relationshipFieldSchema.mode === 'readonly') {
            return errorSet.add(
                ErrorFactory.makeFieldError(errorFormatter, pointer, errorFormatter.resource.relationshipIsReadonly()),
            );
        }
        if (resourceIdentifiers === undefined) {
            if (isNew) {
                if (relationshipFieldSchema.optional) {
                    return errorSet;
                } else {
                    return errorSet.add(
                        ErrorFactory.makeFieldError(
                            errorFormatter,
                            pointer,
                            errorFormatter.resource.relationshipShouldBeExisted(),
                        ),
                    );
                }
            }
            return errorSet;
        }
        if (relationshipFieldSchema.mode === 'unchangeable' && !isNew) {
            return errorSet.add(
                ErrorFactory.makeFieldError(
                    errorFormatter,
                    pointer,
                    errorFormatter.resource.relationshipIsUnchangeable(),
                ),
            );
        }
        if (relationshipFieldSchema.multiple) {
            if (!Array.isArray(resourceIdentifiers)) {
                errorSet.add(
                    ErrorFactory.makeFieldError(
                        errorFormatter,
                        pointer,
                        errorFormatter.resource.relationshipShouldBeArray(),
                    ),
                );
                return errorSet;
            }
            resourceIdentifiers.forEach((resourceIdentifier, i) => {
                if (!relationshipFieldSchema.types.includes(resourceIdentifier.type)) {
                    errorSet.add(
                        ErrorFactory.makeFieldError(
                            errorFormatter,
                            pointer.concat(i, 'type'),
                            errorFormatter.resource.invalidRelationshipType(relationship, resourceIdentifier.type),
                        ),
                    );
                }
            });
        } else {
            if (Array.isArray(resourceIdentifiers)) {
                return errorSet.add(
                    ErrorFactory.makeFieldError(
                        errorFormatter,
                        pointer,
                        errorFormatter.resource.relationshipShouldNotBeArray(),
                    ),
                );
            }
            if (!relationshipFieldSchema.nullable && resourceIdentifiers === null) {
                return errorSet.add(
                    ErrorFactory.makeFieldError(
                        errorFormatter,
                        pointer,
                        errorFormatter.resource.relationshipShouldBeObject(),
                    ),
                );
            }
            if (resourceIdentifiers && !relationshipFieldSchema.types.includes(resourceIdentifiers.type)) {
                errorSet.add(
                    ErrorFactory.makeFieldError(
                        errorFormatter,
                        pointer.concat('type'),
                        errorFormatter.resource.invalidRelationshipType(relationship, resourceIdentifiers.type),
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
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];

        if (!resourceKeeper) {
            return errorSet.add(ErrorFactory.makeInvalidResourceTypeError(errorFormatter, type, 'query'));
        }

        Object.keys(resource.attributes).forEach((field) => {
            const errors = this.#checkResourceAttributeValue(
                pointer.concat('attributes', field),
                type,
                field,
                resource.attributes[field],
                isNew,
                errorFormatter,
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
                errorFormatter,
            );
            errorSet.append(errors);
        });

        return errorSet;
    }

    checkResourceFieldsForExisting(
        pointer: Pointer,
        type: string,
        resource: Omit<CommonNewResource, 'id'>,
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];

        if (!resourceKeeper) {
            return errorSet.add(ErrorFactory.makeInvalidResourceTypeError(errorFormatter, type, 'query'));
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
                    ErrorFactory.makeFieldError(
                        errorFormatter,
                        pointer.concat('attributes', attribute),
                        errorFormatter.resource.attributeShouldBeExisted(),
                    ),
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
                        errorFormatter,
                        pointer.concat('relationships', relationship),
                        errorFormatter.resource.relationshipShouldBeExisted(),
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
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                const item = value[i];
                if ('lid' in item && !lidMap.has(item.lid)) {
                    errorSet.add(ErrorFactory.makeInvalidResourceLidError(errorFormatter, pointer.concat(i, 'lid')));
                }
            }
        } else if (value !== null) {
            if ('lid' in value && !lidMap.has(value.lid)) {
                errorSet.add(ErrorFactory.makeInvalidResourceLidError(errorFormatter, pointer.concat('lid')));
            }
        }

        return errorSet;
    }

    #checkSortField(type: string, sortField: SortField, errorFormatter: ErrorFormatter): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];
        if (!resourceKeeper.schema.listable) {
            throw new Error('Invalid');
        }
        if (!resourceKeeper.schema.sort[sortField.field]) {
            return errorSet.add(
                ErrorFactory.makeInvalidQueryParameterError(
                    errorFormatter,
                    'sort',
                    errorFormatter.query.invalidSortField(sortField.field, type),
                ),
            );
        }
        if (resourceKeeper.schema.sort[sortField.field].dir === 'asc' && !sortField.asc) {
            return errorSet.add(
                ErrorFactory.makeInvalidQueryParameterError(
                    errorFormatter,
                    'sort',
                    errorFormatter.query.invalidSortDirDesc(sortField.field, type),
                ),
            );
        }
        if (resourceKeeper.schema.sort[sortField.field].dir === 'desc' && sortField.asc) {
            return errorSet.add(
                ErrorFactory.makeInvalidQueryParameterError(
                    errorFormatter,
                    'sort',
                    errorFormatter.query.invalidSortDirAsc(sortField.field, type),
                ),
            );
        }

        return errorSet;
    }

    #checkSortFields(type: string, sortFields: SortField[], errorFormatter: ErrorFormatter): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        for (let i = 0; i < sortFields.length; i++) {
            errorSet.append(this.#checkSortField(type, sortFields[i], errorFormatter));
        }

        return errorSet;
    }

    #checkFilterField(
        type: string,
        field: string,
        values: string[],
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        const resourceKeeper = this.#resourceKeepers[type];
        if (!resourceKeeper.schema.listable) {
            throw new Error('Invalid');
        }
        if (!resourceKeeper.schema.filter[field]) {
            return errorSet.add(
                ErrorFactory.makeInvalidQueryParameterError(
                    errorFormatter,
                    'filter',
                    errorFormatter.query.invalidFilterField(field, type),
                ),
            );
        }
        if (!resourceKeeper.schema.filter[field].multiple && values.length > 1) {
            return errorSet.add(
                ErrorFactory.makeInvalidQueryParameterError(
                    errorFormatter,
                    'filter',
                    errorFormatter.query.invalidMultipleFilterField(field, type),
                ),
            );
        }

        return errorSet;
    }

    #checkFilterFields(
        type: string,
        filterFields: FilterFields,
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        for (const field in filterFields) {
            errorSet.append(this.#checkFilterField(type, field, filterFields[field], errorFormatter));
        }

        return errorSet;
    }

    checkObservationQuery(
        pointer: Pointer,
        observationQuery: ObservationQuery,
        errorFormatter: ErrorFormatter,
    ): ErrorSet<CommonError> {
        const errorSet = new ErrorSet<CommonError>();
        if (observationQuery.types) {
            for (const type of Object.keys(observationQuery.types)) {
                if (!this.#resourceKeepers[type]) {
                    errorSet.add(
                        ErrorFactory.makeInvalidResourceTypeError(errorFormatter, type, pointer.concat('types', type)),
                    );
                }
            }
        }
        if (observationQuery.resources) {
            for (const type of Object.keys(observationQuery.resources)) {
                const resourceKeeper = this.#resourceKeepers[type];
                if (!resourceKeeper) {
                    errorSet.add(
                        ErrorFactory.makeInvalidResourceTypeError(
                            errorFormatter,
                            type,
                            pointer.concat('resources', type),
                        ),
                    );
                    continue;
                }
                for (const id of Object.keys(observationQuery.resources[type])) {
                    if (!observationQuery.resources[type][id].relationships) {
                        continue;
                    }
                    for (const relationship of Object.keys(observationQuery.resources[type][id].relationships)) {
                        const relationshipFieldSchema = resourceKeeper.schema.relationships[
                            relationship
                        ] as CommonRelationshipFieldSchema<C, P>;
                        if (relationshipFieldSchema === undefined) {
                            return errorSet.add(
                                ErrorFactory.makeContainingFieldError(
                                    errorFormatter,
                                    pointer.concat('resources', type, id, relationship),
                                    type,
                                    relationship,
                                ),
                            );
                        }
                    }
                }
            }
        }

        return errorSet;
    }
}
