// /* eslint-disable @typescript-eslint/no-unused-vars */
// import { DefaultPage, metaProvider, pageProvider } from './defaults';
// import { ErrorFactory } from './errors';
// import { EditableResource, NewResource, ResourceWithSingleRelationships } from './resource-declaration';
// import { FetchableResourceKeeper, ResourceOptions } from './resource-keeper';
// import { ResourceManager } from './resource-manager';
// import {
//     RelationshipDataList,
//     RelationshipOptions,
//     RelationshipResourceIdentifier,
//     ResourceSchema,
// } from './resource-schema';
// import { ServerHandler } from './server-handler';
// import { DataList, ResourceIdentifier } from './types';
// import { validators } from './validators';

// type User = {
//     id: string;
//     login: string;
// };

// type Note = {
//     id: string;
//     title: string;
//     text: string;
//     user_id: string;
// };

// type Tag = {
//     id: string;
//     name: string;
//     note_id: string;
// };

// type UserDeclaration = {
//     type: 'users';
//     attributes: {
//         login: {
//             type: string;
//             mode: 'readonly';
//         };
//     };
//     relationships: {
//         notes: {
//             types: 'notes';
//             multiple: true;
//             mode: 'readonly';
//         };
//     };
//     filter: {
//         login: {
//             multiple: true;
//             type: string[];
//         };
//     };
//     sort: Record<string, never>;
//     getable: true;
//     listable: true;
//     addable: false;
//     updatable: false;
//     removable: false;
// };

// type NoteDeclaration = {
//     type: 'notes';
//     attributes: {
//         title: {
//             type: string;
//             mode: 'editable';
//         };
//         text: {
//             type: string;
//             mode: 'optional';
//         };
//     };
//     relationships: {
//         author: {
//             types: 'users';
//             mode: 'unchangeable';
//         };
//         tags: {
//             types: 'tags';
//             multiple: true;
//             mode: 'editable';
//         };
//     };
//     filter: Record<string, never>;
//     sort: Record<string, never>;
//     getable: true;
//     listable: true;
//     addable: true;
//     updatable: true;
//     removable: true;
// };

// type TagDeclaration = {
//     type: 'tags';
//     attributes: {
//         name: {
//             type: string;
//             mode: 'editable';
//         };
//     };
//     relationships: {
//         note: {
//             types: 'notes';
//             mode: 'unchangeable';
//         };
//     };
//     filter: Record<string, never>;
//     sort: Record<string, never>;
//     getable: true;
//     listable: true;
//     addable: true;
//     updatable: true;
//     removable: true;
// };

// const users: User[] = [
//     {
//         id: '11',
//         login: 'user',
//     },
// ];

// const notes: Note[] = [
//     {
//         id: '12',
//         title: 'First Note',
//         text: 'This is the big note',
//         user_id: '11',
//     },
// ];

// const tags: Tag[] = [
//     {
//         id: '23',
//         name: 'action',
//         note_id: '12',
//     },
//     {
//         id: '24',
//         name: 'movie',
//         note_id: '12',
//     },
//     {
//         id: '25',
//         name: 'fantasy',
//         note_id: '12',
//     },
//     {
//         id: '26',
//         name: 'drama',
//         note_id: '12',
//     },
//     {
//         id: '27',
//         name: 'comedy',
//         note_id: '12',
//     },
// ];

// function makeID(): string {
//     return Math.random().toString().slice(2);
// }

// interface Context {}

// function fetchTagsByNoteId(nodeId: string, limit: number, offset: number): DataList<ResourceIdentifier<'tags'>> {
//     const note = notes.find((aNote) => aNote.id === nodeId);
//     if (!note) {
//         return { items: [], total: 0, limit, offset: 0 };
//     }
//     const noteTags = tags.filter((tag) => tag.note_id === nodeId);

//     return {
//         items: noteTags.map((tag) => ({ id: tag.id, type: 'tags' as const })).slice(offset, offset + limit),
//         total: noteTags.length,
//         limit,
//         offset,
//     };
// }

// class NotesResourceKeeper extends FetchableResourceKeeper<NoteDeclaration, Context, DefaultPage> {
//     schema: ResourceSchema<NoteDeclaration, Context, DefaultPage> = {
//         type: 'notes',
//         attributes: {
//             title: {
//                 validator: validators.string(),
//                 mode: 'editable',
//             },
//             text: {
//                 validator: validators.string(),
//                 mode: 'optional',
//             },
//         },
//         relationships: {
//             tags: {
//                 types: ['tags'],
//                 multiple: true,
//                 mode: 'editable',
//                 get: (
//                     context: Context,
//                     ids: string[],
//                     options: RelationshipOptions<DefaultPage>
//                 ): Promise<RelationshipDataList<ResourceIdentifier<'tags'>>[]> => {
//                     const limit = options.asMain
//                         ? options.page?.size ?? 4
//                         : options.page?.relationships?.tags?.size ?? 4;
//                     const offset = options.asMain ? (options.page?.number ?? 0) * limit : 0;

//                     return Promise.resolve(
//                         ids.map((id) => {
//                             return {
//                                 resourceId: id,
//                                 ...fetchTagsByNoteId(id, limit, offset),
//                             };
//                         })
//                     );
//                 },
//                 add: (
//                     context: Context,
//                     id: string,
//                     resourceIdentifiers: ResourceIdentifier<'tags'>[]
//                 ): Promise<void> => {
//                     const ids = resourceIdentifiers.map((rId) => rId.id);
//                     tags.forEach((tag) => {
//                         if (ids.includes(tag.id)) {
//                             tag.note_id = id;
//                         }
//                     });

//                     return Promise.resolve();
//                 },
//                 update: (
//                     context: Context,
//                     id: string,
//                     resourceIdentifiers: ResourceIdentifier<'tags'>[]
//                 ): Promise<void> => {
//                     const ids = resourceIdentifiers.map((rId) => rId.id);
//                     for (let i = 0; i < tags.length; i++) {
//                         if (tags[i].note_id === id && !ids.includes(tags[i].id)) {
//                             tags.splice(i, 1);
//                             i--;
//                             continue;
//                         }
//                         if (ids.includes(tags[i].id)) {
//                             tags[i].note_id = id;
//                         }
//                     }

//                     return Promise.resolve();
//                 },
//                 remove: (
//                     context: Context,
//                     id: string,
//                     resourceIdentifiers: ResourceIdentifier<'tags'>[]
//                 ): Promise<void> => {
//                     const ids = resourceIdentifiers.map((rId) => rId.id);
//                     for (let i = 0; i < tags.length; i++) {
//                         if (ids.includes(tags[i].id)) {
//                             tags.splice(i, 1);
//                             i--;
//                             continue;
//                         }
//                     }

//                     return Promise.resolve();
//                 },
//             },
//             author: {
//                 types: ['users'],
//                 mode: 'unchangeable',
//                 get(context: Context, ids: string[]): Promise<RelationshipResourceIdentifier<'users'>[]> {
//                     return Promise.resolve(
//                         ids
//                             .map((id) => {
//                                 const note = notes.find((aNote) => aNote.id === id);
//                                 if (!note) {
//                                     return null;
//                                 }
//                                 return {
//                                     resourceId: id,
//                                     type: 'users',
//                                     id: note.user_id,
//                                 };
//                             })
//                             .filter(Boolean) as RelationshipResourceIdentifier<'users'>[]
//                     );
//                 },
//             },
//         },
//         filter: {},
//         sort: {},
//         getable: true,
//         listable: true,
//         addable: true,
//         updatable: true,
//         removable: true,
//     };

//     exists(context: Context, id: string): Promise<boolean> {
//         return Promise.resolve(notes.find((aNote) => aNote.id === id) !== undefined);
//     }

//     listIds(context: Context, options: ResourceOptions<NoteDeclaration, DefaultPage>): Promise<DataList<string>> {
//         return Promise.resolve({
//             items: notes.map((aNote) => aNote.id),
//             total: notes.length,
//             limit: 10,
//             offset: 0,
//         });
//     }

//     getBase(
//         context: Context,
//         ids: string[],
//         options: Pick<ResourceOptions<NoteDeclaration, DefaultPage>, 'fields' | 'page'>
//     ): Promise<ResourceWithSingleRelationships<NoteDeclaration>[]> {
//         return Promise.resolve(
//             ids
//                 .map((id) => {
//                     const note = notes.find((aNote) => aNote.id === id);
//                     if (!note) {
//                         return null;
//                     }
//                     return {
//                         id,
//                         type: 'notes',
//                         attributes: {
//                             title: note.title,
//                             text: note.text,
//                         },
//                         relationships: {
//                             author: {
//                                 type: 'users',
//                                 id: note.user_id,
//                             },
//                         },
//                     } satisfies ResourceWithSingleRelationships<NoteDeclaration>;
//                 })
//                 .filter(Boolean) as ResourceWithSingleRelationships<NoteDeclaration>[]
//         );
//     }

//     add(context: Context, resource: NewResource<NoteDeclaration>): Promise<string> {
//         const id = resource.id ?? makeID();
//         const note: Note = {
//             id,
//             title: resource.attributes.title,
//             text: resource.attributes.text ?? '',
//             user_id: resource.relationships.author.id,
//         };
//         notes.push(note);

//         return Promise.resolve(id);
//     }

//     update(context: Context, resource: EditableResource<NoteDeclaration>): Promise<void> {
//         const note = notes.find((aNote) => aNote.id === resource.id);
//         if (!note) {
//             return Promise.reject(ErrorFactory.makeNotFoundError());
//         }
//         if (resource.attributes.text) {
//             note.text = resource.attributes.text;
//         }
//         if (resource.attributes.title) {
//             note.title = resource.attributes.title;
//         }

//         return Promise.resolve();
//     }

//     remove(context: Context, id: string): Promise<void> {
//         const i = notes.findIndex((note) => note.id !== id);
//         if (i !== -1) {
//             notes.splice(i, 1);
//         }
//         return Promise.resolve();
//     }
// }

// class TagsResourceKeeper extends FetchableResourceKeeper<TagDeclaration, Context, DefaultPage> {
//     readonly schema: ResourceSchema<TagDeclaration, Context, DefaultPage> = {
//         type: 'tags',
//         attributes: {
//             name: {
//                 validator: validators.string(),
//                 mode: 'editable',
//             },
//         },
//         relationships: {
//             note: {
//                 types: ['notes'],
//                 mode: 'unchangeable',
//                 get(context: Context, ids: string[]): Promise<RelationshipResourceIdentifier<'notes'>[]> {
//                     return Promise.resolve(
//                         ids
//                             .map((id) => {
//                                 const tag = tags.find((aTag) => aTag.id === id);
//                                 if (!tag) {
//                                     return null;
//                                 }
//                                 return {
//                                     resourceId: id,
//                                     type: 'notes',
//                                     id: tag.note_id,
//                                 };
//                             })
//                             .filter(Boolean) as RelationshipResourceIdentifier<'notes'>[]
//                     );
//                 },
//             },
//         },
//         filter: {},
//         sort: {},
//         getable: true,
//         listable: true,
//         addable: true,
//         updatable: true,
//         removable: true,
//     };

//     exists(context: Context, id: string): Promise<boolean> {
//         return Promise.resolve(tags.find((aTag) => aTag.id === id) !== undefined);
//     }

//     listIds(context: Context, options: ResourceOptions<TagDeclaration, DefaultPage>): Promise<DataList<string>> {
//         return Promise.resolve({
//             items: tags.map((aTag) => aTag.id),
//             total: tags.length,
//             limit: 10,
//             offset: 0,
//         });
//     }

//     getBase(
//         context: Context,
//         ids: string[],
//         options: Pick<ResourceOptions<TagDeclaration, DefaultPage>, 'fields' | 'page'>
//     ): Promise<ResourceWithSingleRelationships<TagDeclaration>[]> {
//         return Promise.resolve(
//             ids
//                 .map((id) => {
//                     const tag = tags.find((aTag) => aTag.id === id);
//                     if (!tag) {
//                         return null;
//                     }
//                     return {
//                         id,
//                         type: 'tags',
//                         attributes: {
//                             name: tag.name,
//                         },
//                         relationships: {
//                             note: {
//                                 type: 'notes',
//                                 id: tag.note_id,
//                             },
//                         },
//                     } satisfies ResourceWithSingleRelationships<TagDeclaration>;
//                 })
//                 .filter(Boolean) as ResourceWithSingleRelationships<TagDeclaration>[]
//         );
//     }

//     add(context: Context, resource: NewResource<TagDeclaration>): Promise<string> {
//         return Promise.reject(new Error('Method not implemented.'));
//     }

//     update(context: Context, resource: EditableResource<TagDeclaration>): Promise<void> {
//         return Promise.reject(new Error('Method not implemented.'));
//     }

//     remove(context: Context, id: string): Promise<void> {
//         return Promise.reject(new Error('Method not implemented.'));
//     }
// }

// class UsersResourceKeeper extends FetchableResourceKeeper<UserDeclaration, Context, DefaultPage> {
//     readonly schema: ResourceSchema<UserDeclaration, Context, DefaultPage> = {
//         type: 'users',
//         attributes: {
//             login: {
//                 mode: 'readonly',
//             },
//         },
//         relationships: {
//             notes: {
//                 types: ['notes'],
//                 multiple: true,
//                 mode: 'readonly',
//                 get: (
//                     context: Context,
//                     ids: string[],
//                     options: RelationshipOptions<DefaultPage>
//                 ): Promise<RelationshipDataList<ResourceIdentifier<'notes'>>[]> => {
//                     return Promise.resolve(
//                         ids.map((id) => {
//                             const userNotes = notes.filter((aNote) => aNote.user_id === id);
//                             return {
//                                 resourceId: id,
//                                 items: userNotes.map((aNote) => ({ id: aNote.id, type: 'notes' })),
//                                 total: userNotes.length,
//                                 limit: 10,
//                                 offset: 0,
//                             };
//                         })
//                     );
//                 },
//             },
//         },
//         filter: {
//             login: {
//                 multiple: true,
//                 validator: validators.array(validators.string()),
//                 transformer: (values: string[]) => {
//                     return values;
//                 },
//             },
//         },
//         sort: {},
//         getable: true,
//         listable: true,
//         addable: false,
//         updatable: false,
//         removable: false,
//     };

//     exists(context: Context, id: string): Promise<boolean> {
//         return Promise.resolve(users.find((anUser) => anUser.id === id) !== undefined);
//     }

//     listIds(context: Context, options: ResourceOptions<UserDeclaration, DefaultPage>): Promise<DataList<string>> {
//         return Promise.resolve({
//             items: users.map((anUser) => anUser.id),
//             total: users.length,
//             limit: 10,
//             offset: 0,
//         });
//     }

//     getBase(
//         context: Context,
//         ids: string[],
//         options: Pick<ResourceOptions<UserDeclaration, DefaultPage>, 'fields' | 'page'>
//     ): Promise<ResourceWithSingleRelationships<UserDeclaration>[]> {
//         return Promise.resolve(
//             ids
//                 .map((id) => {
//                     const user = users.find((anUser) => anUser.id === id);
//                     if (!user) {
//                         return null;
//                     }
//                     return {
//                         id,
//                         type: 'users',
//                         attributes: {
//                             login: user.login,
//                         },
//                         relationships: {},
//                     } satisfies ResourceWithSingleRelationships<UserDeclaration>;
//                 })
//                 .filter(Boolean) as ResourceWithSingleRelationships<UserDeclaration>[]
//         );
//     }

//     add(context: Context, resource: NewResource<UserDeclaration>): Promise<never> {
//         return Promise.reject(new Error('Method not implemented.'));
//     }

//     update(context: Context, resource: EditableResource<UserDeclaration>): Promise<never> {
//         return Promise.reject(new Error('Method not implemented.'));
//     }

//     remove(context: Context, id: string): Promise<never> {
//         return Promise.reject(new Error('Method not implemented.'));
//     }
// }

// const resourceManager = new ResourceManager<Context, DefaultPage>(pageProvider, metaProvider);
// resourceManager.setPrefix('/api/v1');
// resourceManager.setDomain('www.example.com');
// resourceManager.addResourceKeeper(new NotesResourceKeeper());
// resourceManager.addResourceKeeper(new TagsResourceKeeper());
// resourceManager.addResourceKeeper(new UsersResourceKeeper());
// resourceManager.init();

// // resourceManager.fetch({}, new ResourceQueryConverter<DefaultPage>(filterProvider, pageProvider).parse('/users?include=notes.tags&fields[notes]&fields[users]=login'))
// //     .then(result => console.log(JSON.stringify(result, null, 2)))
// //     .catch(console.error);

// // resourceManager.fetch({}, new ResourceQueryConverter<DefaultPage>(filterProvider, pageProvider).parse('/tags?include=note,note.user'))
// //     .then(result => console.log(JSON.stringify(result, null, 2)))
// //     .catch(console.error);

// // resourceManager.fetch({}, new ResourceQueryConverter<DefaultPage>(filterProvider, pageProvider).parse('/notes?include=tags'))
// //     .then(result => console.log(JSON.stringify(result, null, 2)))
// //     .catch(console.error);
// // resourceManager
// //     .fetch(
// //         {},
// //         new ResourceQueryConverter<DefaultPage>(filterProvider, pageProvider).parse(
// //             '/notes?page[number]=1&page[relationships][tags][size]=10'
// //         )
// //     )
// //     .then((result) => console.log(JSON.stringify(result, null, 4)))
// //     .catch(console.error);

// const serverHandler = new ServerHandler(resourceManager);

// serverHandler
//     .handleOperations(
//         {},
//         {
//             operations: [
//                 {
//                     op: 'get',
//                     ref: {
//                         type: 'notes',
//                     },
//                 },
//                 {
//                     op: 'get',
//                     ref: {
//                         type: 'tags',
//                     },
//                 },
//             ],
//         }
//     )
//     .then((result) => console.log(JSON.stringify(result, null, 4)));
