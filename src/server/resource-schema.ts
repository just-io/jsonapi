import { ErrorSet, Result, Schema } from '@just-io/schema';
import {
    AttributeDeclaration,
    FilterDeclaration,
    RelationshipDeclaration,
    ResourceDeclaration,
} from '../types/resource-declaration';
import { DataList, ResourceIdentifier } from '../types/common';
import { CommonError } from '../types/formats';
import { ErrorFormatter } from './error-formatter';

export type AttributeFieldSchema<A extends AttributeDeclaration<unknown>> = (A['mode'] extends 'readonly'
    ? {
          mode: 'readonly';
      }
    : {
          mode: A['mode'];
          schema: Schema<A['type']>;
      }) &
    (A extends { optional: true }
        ? {
              optional: true;
          }
        : {
              optional?: false;
          });

export type CommonAttributeFieldSchema<T> =
    | AttributeFieldSchema<{ type: T; mode: 'readonly' }>
    | AttributeFieldSchema<{ type: T; mode: 'unchangeable' | 'editable' }>;

export type AttributeSchema<D extends ResourceDeclaration> = {
    [K in keyof D['attributes']]: AttributeFieldSchema<D['attributes'][K]>;
};

export interface RelationshipOptions<P> {
    page?: P;
    asMain: boolean;
}

export type RelationshipFieldSchema<R extends RelationshipDeclaration<string>, C, P> = {
    types: R['types'][];
    mode: R['mode'];
} & (R extends { optional: true }
    ? {
          optional: true;
      }
    : {
          optional?: false;
      }) &
    (R['multiple'] extends true
        ? R['mode'] extends 'readonly' | 'unchangeable'
            ? {
                  multiple: true;
                  nullable?: false;
                  get: (
                      context: C,
                      resourceIds: string[],
                      options: RelationshipOptions<P>,
                  ) => Promise<Record<string, DataList<ResourceIdentifier<R['types']>>>>;
              }
            : {
                  multiple: true;
                  nullable?: false;
                  get: (
                      context: C,
                      resourceIds: string[],
                      options: RelationshipOptions<P>,
                  ) => Promise<Record<string, DataList<ResourceIdentifier<R['types']>>>>;
                  add: (
                      context: C,
                      resourceId: string,
                      resourceIdentifiers: ResourceIdentifier<R['types']>[],
                      errorFormatter: ErrorFormatter,
                  ) => Promise<Result<void, ErrorSet<CommonError>>>;
                  update: (
                      context: C,
                      resourceId: string,
                      resourceIdentifiers: ResourceIdentifier<R['types']>[],
                      errorFormatter: ErrorFormatter,
                  ) => Promise<Result<void, ErrorSet<CommonError>>>;
                  remove: (
                      context: C,
                      resourceId: string,
                      resourceIdentifiers: ResourceIdentifier<R['types']>[],
                      errorFormatter: ErrorFormatter,
                  ) => Promise<Result<void, ErrorSet<CommonError>>>;
              }
        : R['nullable'] extends true
        ? R['mode'] extends 'readonly' | 'unchangeable'
            ? {
                  multiple?: false;
                  nullable: true;
                  get: (
                      context: C,
                      resourceIds: string[],
                  ) => Promise<Record<string, ResourceIdentifier<R['types']> | null>>;
              }
            : {
                  multiple?: false;
                  nullable: true;
                  get: (
                      context: C,
                      resourceIds: string[],
                  ) => Promise<Record<string, ResourceIdentifier<R['types']> | null>>;
                  update: (
                      context: C,
                      resourceId: string,
                      resourceIdentifier: ResourceIdentifier<R['types']> | null,
                      errorFormatter: ErrorFormatter,
                  ) => Promise<Result<void, ErrorSet<CommonError>>>;
              }
        : R['mode'] extends 'readonly' | 'unchangeable'
        ? {
              multiple?: false;
              nullable?: false;
              get: (context: C, resourceIds: string[]) => Promise<Record<string, ResourceIdentifier<R['types']>>>;
          }
        : {
              multiple?: false;
              nullable?: false;
              get: (context: C, resourceIds: string[]) => Promise<Record<string, ResourceIdentifier<R['types']>>>;
              update: (
                  context: C,
                  resourceId: string,
                  resourceIdentifier: ResourceIdentifier<R['types']>,
                  errorFormatter: ErrorFormatter,
              ) => Promise<Result<void, ErrorSet<CommonError>>>;
          });

export type CommonRelationshipFieldSchema<C, P> =
    | RelationshipFieldSchema<{ types: string; multiple: true; mode: 'readonly'; nullable?: false }, C, P>
    | RelationshipFieldSchema<{ types: string; multiple: false; mode: 'readonly'; nullable?: boolean }, C, P>
    | RelationshipFieldSchema<
          { types: string; multiple: true; mode: 'editable' | 'unchangeable'; nullable?: false; optional?: false },
          C,
          P
      >
    | RelationshipFieldSchema<
          { types: string; multiple: true; mode: 'editable' | 'unchangeable'; nullable?: false; optional: true },
          C,
          P
      >
    | RelationshipFieldSchema<
          { types: string; multiple: false; mode: 'editable' | 'unchangeable'; nullable?: boolean; optional?: false },
          C,
          P
      >
    | RelationshipFieldSchema<
          { types: string; multiple: false; mode: 'editable' | 'unchangeable'; nullable?: boolean; optional: true },
          C,
          P
      >;

export type RelationshipSchema<D extends ResourceDeclaration, C, P> = {
    [K in keyof D['relationships']]: RelationshipFieldSchema<D['relationships'][K], C, P>;
};

export type FilterFieldSchema<F extends FilterDeclaration<unknown>> = F extends { multiple: true }
    ? {
          multiple: true;
          transformer: (values: string[], errorFormatter: ErrorFormatter) => Result<F['type'], ErrorSet<CommonError>>;
      }
    : {
          multiple?: false;
          transformer: (values: string, errorFormatter: ErrorFormatter) => Result<F['type'], ErrorSet<CommonError>>;
      };

export type FilterSchema<D extends ResourceDeclaration> = {
    [K in keyof D['listable']['filter']]: FilterFieldSchema<D['listable']['filter'][K]>;
};

export type ResourceSchema<D extends ResourceDeclaration, C, P> = {
    type: D['type'];
    attributes: AttributeSchema<D>;
    relationships: RelationshipSchema<D, C, P>;
    addable: D['addable'];
    updatable: D['updatable'];
    removable: D['removable'];
} & (D extends { listable: false }
    ? {
          listable: false;
      }
    : {
          listable: true;
          filter: FilterSchema<D>;
          sort: D['listable']['sort'];
      });
