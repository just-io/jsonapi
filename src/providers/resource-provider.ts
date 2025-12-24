/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { CommonError } from '../errors';
import { Attributes, EditableResource, NewResource, ResourceDeclaration } from '../resource-declaration';
import { ResourceIdentifier } from '../types';

export type Meta = {
    list: Record<string, unknown>;
    single: Record<string, unknown>;
    root: Record<string, unknown>;
};

type MetaRelationship<T, M extends Meta> = T extends { data: unknown[] }
    ? T & { meta: M['list'] }
    : T & { meta: M['single'] };

export type MetaResource<T, M extends Meta> = T extends { relationships: Record<string, unknown> }
    ? Omit<T, 'relationships'> & {
          meta: M['single'];
          relationships: {
              [K in keyof T['relationships']]: MetaRelationship<T['relationships'][K], M>;
          };
      }
    : T & { meta: M['single'] };

type MetaResponse<T, M extends Meta> = T extends { data: (infer D)[] }
    ? Omit<T, 'data'> & {
          meta: M['root'] & M['list'];
          data: MetaResource<D, M>[];
      }
    : T extends { data: infer D }
    ? Omit<T, 'data'> & {
          meta: M['root'];
          data: MetaResource<D, M> | null;
      }
    : never;

type ComposedResult<T, M extends Meta> = T extends { included: (infer F)[][] }
    ? MetaResponse<Omit<T, 'included'> & { included: MetaResource<F, M>[] }, M>
    : MetaResponse<T, M>;

export type Result<T, M extends Meta> =
    | {
          errors: CommonError[];
      }
    | ComposedResult<T, M>;

type MetaOperations<O extends unknown[], M extends Meta> = O extends [infer T, ...infer RR]
    ? RR extends unknown[]
        ? [ComposedResult<T, M>, ...MetaOperations<RR, M>]
        : []
    : [];

export type OperationResult<O extends unknown[], M extends Meta> =
    | {
          errors: CommonError[];
      }
    | {
          operations: MetaOperations<O, M>;
      };

export type SortField<D extends ResourceDeclaration> = {
    field: keyof D['sort'];
    asc: boolean;
};

export type FilterField<D extends ResourceDeclaration> = {
    [K in keyof D['filter']]?: D['filter'][K] extends { multiple: true } ? string[] : string;
};

export type TypedKeys<Obj, T> = {
    [K in keyof Obj]: Obj[K] extends T ? K : never;
}[keyof Obj];

export type FilterRecord<Obj, T> = Pick<Obj, TypedKeys<Obj, T>>;
export type InvertedFilterRecord<Obj, T> = Omit<Obj, TypedKeys<Obj, T>>;

export type AdditionalRequestParams<P> = {
    params: {
        page?: P;
    };
};

export type AdditionalResourceInfo = {
    lid?: string;
    links?: {
        self: string;
    };
};

export type RelationshipsPresenter<D extends ResourceDeclaration> = {
    [K in keyof D['relationships']]: D['relationships'][K] extends { multiple: true }
        ? {
              data: ResourceIdentifier<D['relationships'][K]['types']>[];
              links: {
                  self: string;
                  related: string;
                  next?: string;
                  prev?: string;
                  first?: string;
                  last?: string;
              };
          }
        : {
              data: D['relationships'][K] extends { nullable: true }
                  ? ResourceIdentifier<D['relationships'][K]['types']> | null
                  : ResourceIdentifier<D['relationships'][K]['types']>;
              links: {
                  self: string;
                  related: string;
              };
          };
};

export type ResourcePresenter<D extends ResourceDeclaration> = {
    type: D['type'];
    id: string;
    // optional, but set required for type infering
    lid: string;
    attributes: Attributes<D>;
    relationships: RelationshipsPresenter<D>;
} & AdditionalResourceInfo;

export type PickedResourcePresenter<
    D extends ResourceDeclaration,
    K extends keyof Attributes<D> | keyof RelationshipsPresenter<D>,
> = {
    type: D['type'];
    id: string;
    attributes: Pick<Attributes<D>, K extends keyof Attributes<D> ? K : never>;
    relationships: Pick<RelationshipsPresenter<D>, K extends keyof RelationshipsPresenter<D> ? K : never>;
} & AdditionalResourceInfo;

export type GetResourceResponse<
    R extends ResourcePresenter<any> | PickedResourcePresenter<any, any>,
    IRS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[] = [],
> = {
    data: R | null;
    links: {
        self: string;
    };
    included: IRS[];
};

export type GetResourcesResponse<
    R extends ResourcePresenter<any> | PickedResourcePresenter<any, any>,
    IRS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[] = [],
> = {
    data: R[];
    links: {
        self: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
    included: IRS[];
};

export type GetRelationshipResponse<
    D extends ResourceDeclaration,
    K extends string & keyof D['relationships'],
    IRS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[] = [],
> = {
    data: D['relationships'][K] extends { multiple: true } ? ResourceIdentifier<K>[] : ResourceIdentifier<K> | null;
    links: D['relationships'][K] extends { multiple: true }
        ? {
              self: string;
              next?: string;
              prev?: string;
              first?: string;
              last?: string;
          }
        : {
              self: string;
          };
    included: IRS[];
};

export type AddResourceResponse<
    D extends ResourceDeclaration,
    IRS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[] = [],
> = {
    data: ResourcePresenter<D>;
    links: {
        self: string;
    };
    included: IRS[];
};

export type AddRelationshipResponse<
    D extends ResourceDeclaration,
    K extends string & keyof FilterRecord<D['relationships'], { multiple: true; mode: 'editable' }>,
    IRS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[] = [],
> = {
    data: ResourceIdentifier<K>[];
    links: {
        self: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
    included: IRS[];
};

export type UpdateResourceResponse<
    D extends ResourceDeclaration,
    IRS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[] = [],
> = {
    data: ResourcePresenter<D>;
    links: {
        self: string;
    };
    included: IRS[];
};

export type UpdateRelationshipResponse<
    D extends ResourceDeclaration,
    K extends string & keyof FilterRecord<D['relationships'], { mode: 'editable' }>,
    IRS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[] = [],
> = {
    data: D['relationships'][K] extends { multiple: true } ? ResourceIdentifier<K>[] : ResourceIdentifier<K> | null;
    links: D['relationships'][K] extends { multiple: true }
        ? {
              self: string;
              next?: string;
              prev?: string;
              first?: string;
              last?: string;
          }
        : {
              self: string;
          };
    included: IRS[];
};

export type RemoveResourceResponse<D extends ResourceDeclaration> = {
    data: null;
    links: {
        self: string;
    };
};

export type RemoveRelationshipResponse<
    D extends ResourceDeclaration,
    K extends string & keyof FilterRecord<D['relationships'], { multiple: true; mode: 'editable' }>,
    IRS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[] = [],
> = {
    data: ResourceIdentifier<K>[];
    links: {
        self: string;
        next?: string;
        prev?: string;
        first?: string;
        last?: string;
    };
    included: IRS[];
};

// type ExtractedFields<RS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[]> = RS extends [
//     infer R,
//     ...infer RR,
// ]
//     ? R extends PickedResourcePresenter<infer RD, infer K>
//         ? RR extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[]
//             ? { [T in R['type']]: K[] } & ExtractedFields<RR>
//             : never
//         : unknown
//     : unknown;
type ExtractedFields<RS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[]> = RS extends [
    infer R,
    ...infer RR,
]
    ? R extends ResourcePresenter<infer RD>
        ? RR extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[]
            ? ExtractedFields<RR>
            : never
        : R extends PickedResourcePresenter<infer RD, infer K>
        ? RR extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[]
            ? { [T in R['type']]: K[] } & ExtractedFields<RR>
            : never
        : never
    : unknown;

type TF0 = ExtractedFields<[ResourcePresenter<NoteDeclaration>]>;
type TF = ExtractedFields<[PickedResourcePresenter<NoteDeclaration, 'author' | 'tags'>]>;
type TFF = ExtractedFields<[PickedResourcePresenter<TagDeclaration, 'note' | 'name'>]>;
type TFFF = ExtractedFields<
    [PickedResourcePresenter<UserDeclaration, 'login'>, PickedResourcePresenter<TagDeclaration, 'name'>]
>;
type TF1 = ExtractedFields<
    [PickedResourcePresenter<NoteDeclaration, 'author' | 'tags'>, ResourcePresenter<TagDeclaration>]
>;
type TF2 = ExtractedFields<
    [ResourcePresenter<TagDeclaration>, PickedResourcePresenter<NoteDeclaration, 'author' | 'tags'>]
>;

export type PickedResourceFields<RS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[]> =
    InvertedFilterRecord<ExtractedFields<RS>, never[]>;

export type Fields<
    R extends ResourcePresenter<any> | PickedResourcePresenter<any, any>,
    IRS extends (ResourcePresenter<any> | PickedResourcePresenter<any, any>)[] = [],
> = R extends ResourcePresenter<infer RD>
    ? PickedResourceFields<IRS>
    : R extends PickedResourcePresenter<infer RD, infer RK>
    ? InvertedFilterRecord<{ [T in R['type']]: RK[] }, never[]> & PickedResourceFields<IRS>
    : PickedResourceFields<IRS>;

type F1 = ExtractedFields<[PickedResourcePresenter<TagDeclaration, 'name'>]>;
type FF = Fields<
    ResourcePresenter<NoteDeclaration>,
    [ResourcePresenter<UserDeclaration>, PickedResourcePresenter<TagDeclaration, 'name'>]
> extends infer R
    ? // Prettifies object types for IDE: display as regular object.
      { [RK in keyof R]: R[RK] }
    : never;
const f: FF = {
    // notes: ['author', 'tags'],
    tags: ['name'],
};

export type GetResourseRequest<GRR extends GetResourceResponse<any, any>> = GRR extends GetResourceResponse<
    infer R,
    infer IRS
>
    ? {
          ref: {
              type: R['type'];
              id: string;
          };
          params: {
              //   fields: R extends PickedResourcePresenter<infer RD, infer RK>
              //       ? InvertedFilterRecord<{ [T in R['type']]: RK[] }, never[]> & PickedResourceFields<IRS>
              //       : PickedResourceFields<IRS>;
              fields: Fields<R, IRS>;
              include: R extends ResourcePresenter<infer RD> | PickedResourcePresenter<infer RD, infer RK>
                  ? [keyof RD['relationships'], ...string[]][]
                  : string[][];
          };
      }
    : never;

export type GetResoursesRequest<GRR extends GetResourcesResponse<any, any>> = GRR extends GetResourcesResponse<
    infer R,
    infer IRS
>
    ? {
          ref: {
              type: R['type'];
          };
          params: {
              //   fields: R extends PickedResourcePresenter<infer RD, infer RK>
              //       ? InvertedFilterRecord<{ [T in R['type']]: RK[] }, never[]> & PickedResourceFields<IRS>
              //       : PickedResourceFields<IRS>;
              fields: Fields<R, IRS>;
              sort?: R extends PickedResourcePresenter<infer RD, infer RK> ? SortField<RD>[] : [];
              filter?: R extends ResourcePresenter<infer RD> | PickedResourcePresenter<infer RD, infer RK>
                  ? FilterField<RD>
                  : Record<string, never>;
              include: R extends ResourcePresenter<infer RD> | PickedResourcePresenter<infer RD, infer RK>
                  ? [keyof RD['relationships'], ...string[]][]
                  : string[][];
          };
      }
    : never;

export type GetRelationshipRequest<GRR extends GetRelationshipResponse<any, any, any>> =
    GRR extends GetRelationshipResponse<infer D, infer K, infer IRS>
        ? {
              ref: {
                  type: D['type'];
                  id: string;
                  relationship: K;
              };
              params: {
                  fields: PickedResourceFields<IRS>;
                  include: [K, ...string[]][];
              };
          }
        : never;

export type AddResourseRequest<ARR extends AddResourceResponse<any, any>> = ARR extends AddResourceResponse<
    infer D,
    infer IRS
>
    ? {
          ref: {
              type: D['type'];
          };
          params: {
              fields: PickedResourceFields<IRS>;
              include: [keyof D['relationships'], ...string[]][];
          };
          data: NewResource<D>;
      }
    : never;

export type AddRelationshipRequest<ARR extends AddRelationshipResponse<any, any, any>> =
    ARR extends AddRelationshipResponse<infer D, infer K, infer IRS>
        ? {
              ref: {
                  type: D['type'];
                  id: string;
                  relationship: K;
              };
              params: {
                  fields: PickedResourceFields<IRS>;
                  include: [K, ...string[]][];
              };
              data: ResourceIdentifier<K>[];
          }
        : never;

export type UpdateResourseRequest<URR extends UpdateResourceResponse<any, any>> = URR extends UpdateResourceResponse<
    infer D,
    infer IRS
>
    ? {
          ref: {
              type: D['type'];
              id: string;
          };
          params: {
              fields: PickedResourceFields<IRS>;
              include: [keyof D['relationships'], ...string[]][];
          };
          data: EditableResource<D>;
      }
    : never;

export type UpdateRelationshipRequest<URR extends UpdateRelationshipResponse<any, any, any>> =
    URR extends UpdateRelationshipResponse<infer D, infer K, infer IRS>
        ? {
              ref: {
                  type: D['type'];
                  id: string;
                  relationship: K;
              };
              params: {
                  fields: PickedResourceFields<IRS>;
                  include: [K, ...string[]][];
              };
              data: D['relationships'][K] extends { multiple: true }
                  ? ResourceIdentifier<K>[]
                  : ResourceIdentifier<K> | null;
          }
        : never;

export type RemoveResourseRequest<RRR extends RemoveResourceResponse<any>> = RRR extends RemoveResourceResponse<infer D>
    ? {
          ref: {
              type: D['type'];
              id: string;
          };
          params: Record<string, never>;
          data: null;
      }
    : never;

export type RemoveRelationshipRequest<RRR extends RemoveRelationshipResponse<any, any, any>> =
    RRR extends RemoveRelationshipResponse<infer D, infer K, infer IRS>
        ? {
              ref: {
                  type: D['type'];
                  id: string;
                  relationship: K;
              };
              params: {
                  fields: PickedResourceFields<IRS>;
                  include: [K, ...string[]][];
              };
              data: ResourceIdentifier<K>[];
          }
        : never;

export type Response =
    | GetResourceResponse<any, any>
    | GetResourcesResponse<any, any>
    | GetRelationshipResponse<any, any, any>
    | AddResourceResponse<any, any>
    | AddRelationshipResponse<any, any, any>
    | UpdateResourceResponse<any, any>
    | UpdateRelationshipResponse<any, any, any>
    | RemoveResourceResponse<any>
    | RemoveRelationshipResponse<any, any, any>;

export type Request<T> = T extends GetResourceResponse<infer R, infer IR>
    ? GetResourseRequest<T>
    : T extends GetResourcesResponse<infer R, infer IR>
    ? GetResoursesRequest<T>
    : T extends GetRelationshipResponse<infer R, infer K, infer IR>
    ? GetRelationshipRequest<T>
    : T extends AddResourceResponse<infer D, infer IRS>
    ? AddResourseRequest<T>
    : T extends AddRelationshipResponse<infer D, infer K, infer IRS>
    ? AddRelationshipRequest<T>
    : T extends UpdateResourceResponse<infer D, infer IRS>
    ? UpdateResourseRequest<T>
    : T extends UpdateRelationshipResponse<infer D, infer K, infer IRS>
    ? UpdateRelationshipRequest<T>
    : T extends RemoveResourceResponse<infer D>
    ? RemoveResourseRequest<T>
    : T extends RemoveRelationshipResponse<infer D, infer K, infer IRS>
    ? RemoveRelationshipRequest<T>
    : never;

// type TR = Request<GetRelationshipResponse<any, any, any>>;

export type Operations<T extends any[], P> = T extends [infer R, ...infer RR]
    ? [Request<R> & AdditionalRequestParams<P>, ...Operations<RR, P>]
    : [];

export default interface ResourceProvider<P, M extends Meta = Meta> {
    getResourse<GRR extends GetResourceResponse<any, any>>(
        query: GetResourseRequest<GRR> & AdditionalRequestParams<P>,
    ): Promise<Result<GRR, M>>;
    getResourses<GRR extends GetResourcesResponse<any, any>>(
        query: GetResoursesRequest<GRR> & AdditionalRequestParams<P>,
    ): Promise<Result<GRR, M>>;
    getRelationship<GRR extends GetRelationshipResponse<any, any, any>>(
        query: GetRelationshipRequest<GRR> & AdditionalRequestParams<P>,
    ): Promise<Result<GRR, M>>;
    addResourse<ARR extends AddResourceResponse<any, any>>(
        query: AddResourseRequest<ARR> & AdditionalRequestParams<P>,
    ): Promise<Result<ARR, M>>;
    addRelationship<ARR extends AddRelationshipResponse<any, any, any>>(
        query: AddRelationshipRequest<ARR> & AdditionalRequestParams<P>,
    ): Promise<Result<ARR, M>>;
    updateResourse<URR extends UpdateResourceResponse<any, any>>(
        query: UpdateResourseRequest<URR> & AdditionalRequestParams<P>,
    ): Promise<Result<URR, M>>;
    updateRelationship<URR extends UpdateRelationshipResponse<any, any, any>>(
        query: UpdateRelationshipRequest<URR> & AdditionalRequestParams<P>,
    ): Promise<Result<URR, M>>;
    removeResourse<RRR extends RemoveResourceResponse<any>>(
        query: RemoveResourseRequest<RRR> & AdditionalRequestParams<P>,
    ): Promise<Result<RRR, M>>;
    removeRelationship<RRR extends RemoveRelationshipResponse<any, any, any>>(
        query: RemoveRelationshipRequest<RRR> & AdditionalRequestParams<P>,
    ): Promise<Result<RRR, M>>;
    bulk<OR extends Response[]>(query: Operations<OR, P>): Promise<OperationResult<OR, M>>;
}

export interface ResourceProviderWithContext<C, P, M extends Meta = Meta> extends ResourceProvider<P, M> {
    withContext(context: C): ResourceProvider<P, M>;
}

type UserDeclaration = {
    type: 'users';
    attributes: {
        login: {
            type: string;
            mode: 'readonly';
        };
    };
    relationships: {
        notes: {
            types: 'notes';
            multiple: true;
            mode: 'readonly';
        };
    };
    filter: Record<string, never>;
    sort: Record<string, never>;
    getable: true;
    listable: true;
    addable: false;
    updatable: false;
    removable: false;
};

type NoteDeclaration = {
    type: 'notes';
    attributes: {
        title: {
            type: string;
            mode: 'editable';
        };
        text: {
            type: string;
            mode: 'editable';
        };
    };
    relationships: {
        author: {
            types: 'users';
            mode: 'unchangeable';
        };
        tags: {
            types: 'tags';
            multiple: true;
            mode: 'editable';
        };
    };
    filter: Record<string, never>;
    sort: Record<string, never>;
    getable: true;
    listable: true;
    addable: false;
    updatable: false;
    removable: false;
};

type TagDeclaration = {
    type: 'tags';
    attributes: {
        name: {
            type: string;
            mode: 'editable';
        };
    };
    relationships: {
        note: {
            types: 'notes';
            mode: 'unchangeable';
        };
    };
    filter: Record<string, never>;
    sort: Record<string, never>;
    getable: true;
    listable: true;
    addable: false;
    updatable: false;
    removable: false;
};

// type FRD = Fields<[NoteDeclaration, TagDeclaration]>;
// type RR = ResourceRequest<UserDeclaration, [NoteDeclaration, TagDeclaration]>;

// type TT = [NoteDeclaration, TagDeclaration][number]['type'];

type EFO = PickedResourceFields<[ResourcePresenter<TagDeclaration>]>;
type EF = PickedResourceFields<
    [ResourcePresenter<TagDeclaration>, PickedResourcePresenter<NoteDeclaration, 'author' | 'tags'>]
>;

type ORResponse = GetResourceResponse<
    PickedResourcePresenter<UserDeclaration, 'login' | 'notes'>,
    [PickedResourcePresenter<NoteDeclaration, 'author' | 'tags'>, ResourcePresenter<TagDeclaration>]
>;
type ORRequest = GetResourseRequest<ORResponse>;

type PRF = PickedResourceFields<
    [PickedResourcePresenter<NoteDeclaration, 'author' | 'tags'>, ResourcePresenter<TagDeclaration>]
>;

type MR = MetaResource<GetResourceResponse<ResourcePresenter<UserDeclaration>>['data'], Meta>['relationships'];
type MRe = MetaResponse<GetResourcesResponse<ResourcePresenter<UserDeclaration>>, Meta>;

declare const mre: MRe;

const a = mre.meta.as;

const r: ORRequest = {
    ref: {
        type: 'users',
        id: '12',
    },
    params: {
        fields: {
            notes: ['author', 'tags'],
            users: ['login', 'notes'],
            // tags: [],
        },
        include: [['notes']],
    },
};

declare const rp: ResourceProvider<any, any>;

rp.getResourse<ORResponse>({
    ref: {
        type: 'users',
        id: '12',
    },
    params: {
        fields: {
            notes: ['author', 'tags'],
            users: ['login', 'notes'],
            // tags: [],
        },
        include: [['notes']],
    },
}).then((result) => {
    if ('data' in result) {
        const d = result.data?.attributes.login;
        const m = result.data?.relationships.notes.meta;
        const i = result.included[0].relationships;
    }
});

type TT = GetResourseRequest<
    GetResourceResponse<ResourcePresenter<UserDeclaration>, [ResourcePresenter<NoteDeclaration>]>
>;
type TR = ResourcePresenter<UserDeclaration>;

rp.getResourse<GetResourceResponse<ResourcePresenter<UserDeclaration>, [ResourcePresenter<NoteDeclaration>]>>({
    ref: {
        type: 'users',
        id: '12',
    },
    params: {
        fields: {
            notes: ['author', 'tags'],
            users: ['login', 'notes'],
        },
        include: [['notes']],
    },
}).then((result) => {
    if ('data' in result) {
        const d = result.data?.attributes.login;
        const m = result.data?.relationships.notes.meta;
        const i = result.included[0].relationships;
    }
});

rp.getResourses<GetResourcesResponse<PickedResourcePresenter<UserDeclaration, 'login'>>>({
    ref: {
        type: 'users',
    },
    params: {
        fields: {
            users: ['login'],
        },
        include: [],
    },
}).then((result) => {
    if ('data' in result) {
        const d = result.data[0].attributes.login;
    }
});

rp.getResourse<GetResourceResponse<ResourcePresenter<UserDeclaration>>>({
    ref: {
        type: 'users',
        id: 'me',
    },
    params: {
        fields: {},
        include: [],
    },
}).then((result) => {
    if ('data' in result) {
        const d = result.data?.attributes.login;
    }
});

rp.getRelationship<GetRelationshipResponse<UserDeclaration, 'notes'>>({
    ref: {
        type: 'users',
        id: '12',
        relationship: 'notes',
    },
    params: {
        fields: {},
        include: [],
    },
}).then((result) => {
    if ('data' in result) {
        const d = result.data[0].id;
    }
});

rp.addResourse<AddResourceResponse<NoteDeclaration>>({
    ref: {
        type: 'notes',
    },
    params: {
        fields: {},
        include: [],
    },
    data: {
        type: 'notes',
        attributes: {
            title: '12',
            text: '123',
        },
        relationships: {
            author: {
                type: 'users',
                id: '123',
            },
            tags: [],
        },
    },
}).then((result) => {
    if ('data' in result) {
        const d = result.data?.attributes.text;
    }
});

rp.addRelationship<AddRelationshipResponse<NoteDeclaration, 'tags'>>({
    ref: {
        type: 'notes',
        id: '12',
        relationship: 'tags',
    },
    params: {
        fields: {},
        include: [],
    },
    data: [
        {
            type: 'tags',
            id: '1234',
        },
    ],
}).then((result) => {
    if ('data' in result) {
        const d = result.data[0].id;
    }
});

rp.updateResourse<UpdateResourceResponse<NoteDeclaration>>({
    ref: {
        type: 'notes',
        id: '12',
    },
    params: {
        fields: {},
        include: [],
    },
    data: {
        type: 'notes',
        id: '12',
        attributes: {
            text: '123',
        },
        relationships: {
            tags: [],
        },
    },
}).then((result) => {
    if ('data' in result) {
        const d = result.data?.attributes.text;
    }
});

rp.updateRelationship<UpdateRelationshipResponse<NoteDeclaration, 'tags'>>({
    ref: {
        type: 'notes',
        id: '12',
        relationship: 'tags',
    },
    params: {
        fields: {},
        include: [],
    },
    data: [
        {
            type: 'tags',
            id: '1234',
        },
    ],
}).then((result) => {
    if ('data' in result) {
        const d = result.data[0].id;
    }
});

rp.removeResourse<RemoveResourceResponse<NoteDeclaration>>({
    ref: {
        type: 'notes',
        id: '12',
    },
    params: {},
    data: null,
}).then((result) => {
    if ('data' in result) {
        const d = result.data;
    }
});

rp.removeRelationship<RemoveRelationshipResponse<NoteDeclaration, 'tags'>>({
    ref: {
        type: 'notes',
        id: '12',
        relationship: 'tags',
    },
    params: {
        fields: {},
        include: [],
    },
    data: [
        {
            type: 'tags',
            id: '1234',
        },
    ],
}).then((result) => {
    if ('data' in result) {
        const d = result.data[0].id;
    }
});

rp.bulk<[RemoveResourceResponse<NoteDeclaration>, RemoveRelationshipResponse<NoteDeclaration, 'tags'>]>([
    {
        ref: {
            type: 'notes',
            id: '12',
        },
        params: {},
        data: null,
    },
    {
        ref: {
            type: 'notes',
            id: '12',
            relationship: 'tags',
        },
        params: {
            fields: {},
            include: [],
        },
        data: [
            {
                type: 'tags',
                id: '1234',
            },
        ],
    },
]).then((result) => {
    if ('errors' in result) {
        const err = result.errors;
    }
    if ('operations' in result) {
        const [o1, o2] = result.operations;
        const d1 = o1.data;
        const d2 = o2.data;
    }
});

type D = {
    include: {
        page: string;
    };
} & {
    include: {
        filter: string;
    };
};

const d: D = {
    include: {
        filter: '12',
        page: '12',
    },
};
