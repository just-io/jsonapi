import { MultipleKeys, ResourceDeclaration } from '../types/resource-declaration';
import {
    AddRelationshipsOperation,
    AddResourceOperation,
    RemoveRelationshipsOperation,
    RemoveResourceOperation,
    UpdateRelationshipsOperation,
    UpdateResourceOperation,
} from '../types/common';

export const operation = {
    add<D extends ResourceDeclaration>(data: AddResourceOperation<D>['data']): AddResourceOperation<D> {
        return {
            op: 'add',
            data,
        };
    },
    update<D extends ResourceDeclaration>(data: UpdateResourceOperation<D>['data']): UpdateResourceOperation<D> {
        return {
            op: 'update',
            data,
        };
    },
    remove<D extends ResourceDeclaration>(ref: RemoveResourceOperation<D>['ref']): RemoveResourceOperation<D> {
        return {
            op: 'remove',
            ref,
        };
    },
    addRelationships<D extends ResourceDeclaration, R extends MultipleKeys<D>>(
        ref: AddRelationshipsOperation<D, R>['ref'],
        data: AddRelationshipsOperation<D, R>['data'],
    ): AddRelationshipsOperation<D, R> {
        return {
            op: 'add-relationships',
            ref,
            data,
        };
    },
    updateRelationships<D extends ResourceDeclaration, R extends MultipleKeys<D>>(
        ref: UpdateRelationshipsOperation<D, R>['ref'],
        data: UpdateRelationshipsOperation<D, R>['data'],
    ): UpdateRelationshipsOperation<D, R> {
        return {
            op: 'update-relationships',
            ref,
            data,
        };
    },
    removeRelationships<D extends ResourceDeclaration, R extends MultipleKeys<D>>(
        ref: RemoveRelationshipsOperation<D, R>['ref'],
        data: RemoveRelationshipsOperation<D, R>['data'],
    ): RemoveRelationshipsOperation<D, R> {
        return {
            op: 'remove-relationships',
            ref,
            data,
        };
    },
};
