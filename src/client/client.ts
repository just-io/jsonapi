import {
    EditableResource,
    MultipleRelationshipKeys,
    NewRelationshipValue,
    NewResource,
    ResourceDeclaration,
} from '../resource-declaration';
import { Operation } from '../types';
import AddQueryBuilder from './add-query-builder';
import AddRelationshipQueryBuilder from './add-relationship-query-builder';
import GetQueryBuilder from './get-query-builder';
import ListQueryBuilder from './list-query-builder';
import OperationsQueryBuilder from './operations-query-builder';
import RelationshipQueryBuilder from './relationship-query-builder';
import RemoveQueryBuilder from './remove-query-builder';
import RemoveRelationshipQueryBuilder from './remove-relationship-query-builder';
import { Fetcher, Options, ClientPageProvider } from './types';
import UpdateQueryBuilder from './update-query-builder';
import UpdateRelationshipQueryBuilder from './update-relationship-query-builder';

export class Client<C, P, M> {
    #options: Options<C, P>;

    constructor(pageProvider: ClientPageProvider<P>, fetcher: Fetcher<C, P>) {
        this.#options = {
            domain: '',
            prefix: '',
            pageProvider: pageProvider,
            fetcher: fetcher,
        };
    }

    setPrefix(prefix: string): this {
        this.#options.prefix = prefix;
        return this;
    }

    setDomain(domain: string): this {
        this.#options.domain = domain;
        return this;
    }

    get<D extends ResourceDeclaration>(type: D['type'], id: string): GetQueryBuilder<D, C, P, M, []> {
        return new GetQueryBuilder(type, id, this.#options);
    }

    list<D extends ResourceDeclaration>(
        type: D['type'],
    ): D['listable']['status'] extends true ? ListQueryBuilder<D, C, P, M, []> : never {
        return new ListQueryBuilder(type, this.#options) as D['listable']['status'] extends true
            ? ListQueryBuilder<D, C, P, M, []>
            : never;
    }

    relationship<D extends ResourceDeclaration, R extends keyof D['relationships'] & string>(
        type: D['type'],
        id: string,
        relationship: R,
    ): RelationshipQueryBuilder<D, R, C, P, M, []> {
        return new RelationshipQueryBuilder(type, id, relationship, this.#options);
    }

    add<D extends ResourceDeclaration>(newResource: NewResource<D>): AddQueryBuilder<D, C, P, M, []> {
        return new AddQueryBuilder(newResource, this.#options);
    }

    update<D extends ResourceDeclaration>(editableResource: EditableResource<D>): UpdateQueryBuilder<D, C, P, M, []> {
        return new UpdateQueryBuilder(editableResource, this.#options);
    }

    remove<D extends ResourceDeclaration>(type: D['type'], id: string): RemoveQueryBuilder<D, C, P> {
        return new RemoveQueryBuilder(type, id, this.#options);
    }

    addRelationship<D extends ResourceDeclaration, R extends MultipleRelationshipKeys<D> & string>(
        type: D['type'],
        id: string,
        relationship: R,
        value: NewRelationshipValue<D['relationships'][R], 'single'>,
    ): AddRelationshipQueryBuilder<D, R, C, P, M, []> {
        return new AddRelationshipQueryBuilder(type, id, relationship, value, this.#options);
    }

    updateRelationship<D extends ResourceDeclaration, R extends keyof D['relationships'] & string>(
        type: D['type'],
        id: string,
        relationship: R,
        value: NewRelationshipValue<D['relationships'][R], 'single'>,
    ): UpdateRelationshipQueryBuilder<D, R, C, P, M, []> {
        return new UpdateRelationshipQueryBuilder(type, id, relationship, value, this.#options);
    }

    removeRelationship<D extends ResourceDeclaration, R extends MultipleRelationshipKeys<D> & string>(
        type: D['type'],
        id: string,
        relationship: R,
        value: NewRelationshipValue<D['relationships'][R], 'single'>,
    ): RemoveRelationshipQueryBuilder<D, R, C, P, M, []> {
        return new RemoveRelationshipQueryBuilder(type, id, relationship, value, this.#options);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operations<const OA extends Operation<any, any>[]>(operations: OA): OperationsQueryBuilder<C, P, M, OA> {
        return new OperationsQueryBuilder(operations, this.#options);
    }
}
