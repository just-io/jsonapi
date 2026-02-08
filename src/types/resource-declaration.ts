import { DataList, FilterRecord, FilterValues, OperationResourceIdentifier, ResourceIdentifier } from './common';

type ModeKeys<V, T extends Record<string, { mode: V } | unknown>> = {
    [K in keyof T]: T[K] extends { mode: V } ? K : never;
}[keyof T];

export type ModeDeclaration =
    | {
          mode: 'readonly';
      }
    | {
          mode: 'unchangeable' | 'editable';
          optional?: false;
      }
    | {
          mode: 'unchangeable' | 'editable';
          optional: true;
      };

export type AttributeDeclaration<T> = ModeDeclaration & {
    type: T;
};

export type RelationshipDeclaration<T> = ModeDeclaration &
    (
        | {
              types: T;
              multiple?: false;
              nullable?: boolean;
          }
        | {
              types: T;
              multiple: true;
              nullable?: false;
          }
    );

export type FilterDeclaration<T> =
    | {
          type: T;
          multiple?: false;
      }
    | {
          type: T;
          multiple: true;
      };

export type SortDeclaration = {
    dir: 'both' | 'asc' | 'desc';
};

export type AttributeDeclarations = Record<string, AttributeDeclaration<unknown>>;
export type RelationshipDeclarations = Record<string, RelationshipDeclaration<string>>;
export type FilterDeclarations = Record<string, FilterDeclaration<unknown>>;
export type SortDeclarations = Record<string, SortDeclaration>;

export type ResourceDeclaration = {
    type: string;
    attributes: AttributeDeclarations;
    relationships: RelationshipDeclarations;
    addable: boolean;
    updatable: boolean;
    removable: boolean;
    listable:
        | {
              status: false;
              filter: Record<string, never>;
              sort: Record<string, never>;
          }
        | {
              status: true;
              filter: FilterDeclarations;
              sort: SortDeclarations;
          };
};

type ReadonlyKeys<T extends Record<string, { mode: 'readonly' } | unknown>> = ModeKeys<'readonly', T>;
type UnchangeableKeys<T extends Record<string, { mode: 'unchangeable' } | unknown>> = ModeKeys<'unchangeable', T>;
type EditableKeys<T extends Record<string, { mode: 'editable' } | unknown>> = ModeKeys<'editable', T>;
type OptionalKeys<T extends Record<string, { mode: 'unchangeable' | 'editable'; optional: true } | unknown>> = {
    [K in keyof T]: T[K] extends { mode: 'unchangeable' | 'editable'; optional: true } ? K : never;
}[keyof T];
type RequiredKeys<T extends Record<string, { mode: 'unchangeable' | 'editable' } | unknown>> = Exclude<
    ModeKeys<'unchangeable' | 'editable', T>,
    OptionalKeys<T>
>;

export type Attributes<D extends ResourceDeclaration> = {
    readonly [K in ReadonlyKeys<D['attributes']> | UnchangeableKeys<D['attributes']>]: D['attributes'][K]['type'];
} & {
    [K in EditableKeys<D['attributes']>]: D['attributes'][K]['type'];
};

export type NewAttributes<D extends ResourceDeclaration> =
    | OptionalKeys<D['attributes']>
    | RequiredKeys<D['attributes']> extends never
    ? Record<string, never>
    : {
          [K in RequiredKeys<D['attributes']>]: D['attributes'][K]['type'];
      } & {
          [K in OptionalKeys<D['attributes']>]?: D['attributes'][K]['type'];
      };

export type EditableAttributes<D extends ResourceDeclaration> = EditableKeys<D['attributes']> extends never
    ? Record<string, never>
    : {
          [K in EditableKeys<D['attributes']>]?: D['attributes'][K]['type'];
      };

export type RelationshipValue<D extends RelationshipDeclaration<string>> = D extends { multiple: true }
    ? DataList<ResourceIdentifier<D['types']>>
    : D extends { nullable: true }
    ? ResourceIdentifier<D['types']> | null
    : ResourceIdentifier<D['types']>;

export type Relationships<D extends ResourceDeclaration> = {
    readonly [K in ReadonlyKeys<D['relationships']> | UnchangeableKeys<D['relationships']>]: RelationshipValue<
        D['relationships'][K]
    >;
} & {
    [K in EditableKeys<D['relationships']>]: RelationshipValue<D['relationships'][K]>;
};

export type NewRelationshipValue<
    D extends RelationshipDeclaration<string>,
    C extends 'single' | 'operation',
> = D extends {
    multiple: true;
}
    ? C extends 'single'
        ? ResourceIdentifier<D['types']>[]
        : OperationResourceIdentifier<D['types']>[]
    : D extends { nullable: true }
    ? (C extends 'single' ? ResourceIdentifier<D['types']> : OperationResourceIdentifier<D['types']>) | null
    : C extends 'single'
    ? ResourceIdentifier<D['types']>
    : OperationResourceIdentifier<D['types']>;

export type NewRelationships<D extends ResourceDeclaration, C extends 'single' | 'operation'> =
    | OptionalKeys<D['relationships']>
    | RequiredKeys<D['relationships']> extends never
    ? Record<string, never>
    : {
          [K in RequiredKeys<D['relationships']>]: NewRelationshipValue<D['relationships'][K], C>;
      } & {
          [K in OptionalKeys<D['relationships']>]?: NewRelationshipValue<D['relationships'][K], C>;
      };

export type EditableRelationships<D extends ResourceDeclaration, C extends 'single' | 'operation'> = EditableKeys<
    D['relationships']
> extends never
    ? Record<string, never>
    : {
          [K in EditableKeys<D['relationships']>]?: NewRelationshipValue<D['relationships'][K], C>;
      };

export type Resource<D extends ResourceDeclaration> = {
    id: string;
    // lid?: string;
    type: D['type'];
    attributes: Attributes<D>;
    relationships: Relationships<D>;
};

export type RawNewResource<D extends ResourceDeclaration, C extends 'single' | 'operation'> = {
    type: D['type'];
    attributes: NewAttributes<D>;
    relationships: NewRelationships<D, C>;
} & (C extends 'single'
    ? {
          id?: string;
      }
    : { id?: string } | { lid?: string });

export type RawEditableResource<D extends ResourceDeclaration, C extends 'single' | 'operation'> = {
    type: D['type'];
    attributes: EditableAttributes<D>;
    relationships: EditableRelationships<D, C>;
} & (C extends 'single'
    ? {
          id: string;
      }
    : { id: string } | { lid: string });

export type NewResource<D extends ResourceDeclaration> = RawNewResource<D, 'single'>;
export type EditableResource<D extends ResourceDeclaration> = RawEditableResource<D, 'single'>;

export type OperationNewResource<D extends ResourceDeclaration> = RawNewResource<D, 'operation'>;
export type OperationEditableResource<D extends ResourceDeclaration> = RawEditableResource<D, 'operation'>;

export type PickedResource<D extends ResourceDeclaration, K extends keyof Attributes<D> | keyof Relationships<D>> = {
    id: string;
    type: D['type'];
    attributes: Pick<Attributes<D>, K extends keyof Attributes<D> ? K : never>;
    relationships: Pick<Relationships<D>, K extends keyof Relationships<D> ? K : never>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommonResource = Resource<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommonNewResource = NewResource<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommonEditableResource = EditableResource<any>;

export type PartialResourceDeclaration<
    D extends ResourceDeclaration,
    K extends keyof D['attributes'] | keyof D['relationships'] = keyof D['attributes'] | keyof D['relationships'],
> = Omit<D, 'attributes' | 'relationships'> & {
    attributes: Exclude<K, keyof D['relationships']> extends never
        ? Record<string, never>
        : Pick<D['attributes'], Exclude<K, keyof D['relationships']>>;
    relationships: Exclude<K, keyof D['attributes']> extends never
        ? Record<string, never>
        : Pick<D['relationships'], Exclude<K, keyof D['attributes']>>;
};

export type NullableKeys<D extends ResourceDeclaration> = keyof FilterRecord<D['relationships'], { nullable: true }> &
    string;
export type MultipleKeys<D extends ResourceDeclaration> = keyof FilterRecord<D['relationships'], { multiple: true }> &
    string;
export type SingleKeys<D extends ResourceDeclaration> = Exclude<keyof D['relationships'], MultipleKeys<D>> & string;
export type SingleNonNullableKeys<D extends ResourceDeclaration> = Exclude<
    keyof D['relationships'],
    NullableKeys<D> | MultipleKeys<D>
> &
    string;

export type MultipleRelationshipTypes<D extends ResourceDeclaration> = FilterValues<
    D['relationships'],
    { multiple: true }
>['types'];
export type SingleRelationshipTypes<D extends ResourceDeclaration> = D['relationships'][Exclude<
    keyof D['relationships'],
    MultipleKeys<D>
>]['types'];
export type MultipleRelationshipKeys<D extends ResourceDeclaration> = keyof FilterRecord<
    D['relationships'],
    { multiple: true }
>;

export type IncludedResources<I extends ResourceDeclaration[]> = I extends [infer F, ...infer R]
    ? F extends ResourceDeclaration
        ? R extends ResourceDeclaration[]
            ? Resource<F> | IncludedResources<R>
            : never
        : never
    : never;
