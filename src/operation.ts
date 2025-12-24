import { MultipleKeys, ResourceDeclaration } from './resource-declaration';
import {
    AddRelationshipsOperation,
    AddResourceOperation,
    RemoveRelationshipsOperation,
    RemoveResourceOperation,
    UpdateRelationshipsOperation,
    UpdateResourceOperation,
} from './types';

export const operation = {
    add<D extends ResourceDeclaration>(op: AddResourceOperation<D>): AddResourceOperation<D> {
        return op;
    },
    update<D extends ResourceDeclaration>(op: UpdateResourceOperation<D>): UpdateResourceOperation<D> {
        return op;
    },
    remove<D extends ResourceDeclaration>(op: RemoveResourceOperation<D>): RemoveResourceOperation<D> {
        return op;
    },
    addRelationships<D extends ResourceDeclaration, R extends MultipleKeys<D>>(
        op: AddRelationshipsOperation<D, R>,
    ): AddRelationshipsOperation<D, R> {
        return op;
    },
    updateRelationships<D extends ResourceDeclaration, R extends MultipleKeys<D>>(
        op: UpdateRelationshipsOperation<D, R>,
    ): UpdateRelationshipsOperation<D, R> {
        return op;
    },
    removeRelationships<D extends ResourceDeclaration, R extends MultipleKeys<D>>(
        op: RemoveRelationshipsOperation<D, R>,
    ): RemoveRelationshipsOperation<D, R> {
        return op;
    },
};
