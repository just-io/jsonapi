import { Client, Fetcher } from '../../client';
import { clientPageProvider } from '../../client/defaults';
import { Observer } from '../../client/observer';
import { DefaultPage, pageProvider, DefaultMeta, metaProvider, makePage } from '../../server/defaults';
import { defaultErrorFormatter } from '../../server/error-formatter';
import { makeResourceInformer, connectToResourceManager } from '../../server/helpers';
import { QueryConverter } from '../../server/query-converter';
import { ResourceManager } from '../../server/resource-manager';
import { ResourceObserver, IncomingEvent } from '../../server/resource-observer';
import { ServerHandler } from '../../server/server-handler';
import { NoteDeclaration, NotesResourceKeeper } from './note-resource-kepper';
import { makeNewStores } from './store';
import { TagDeclaration, TagsResourceKeeper } from './tag-resource-kepper';
import { Context } from './types';
import { UserDeclaration, UsersResourceKeeper } from './user-resource-kepper';

export { Context, NoteDeclaration, TagDeclaration, UserDeclaration };

export function makeResourceManager(): ResourceManager<Context, DefaultPage> {
    const store = makeNewStores();
    const resourceManager = new ResourceManager<Context, DefaultPage>(pageProvider);
    resourceManager.addResourceKeeper(new NotesResourceKeeper(store));
    resourceManager.addResourceKeeper(new TagsResourceKeeper(store));
    resourceManager.addResourceKeeper(new UsersResourceKeeper(store));
    resourceManager.init();

    return resourceManager;
}

export function makeServerHandler(
    resourceManager: ResourceManager<Context, DefaultPage>,
): ServerHandler<Context, DefaultPage, DefaultMeta> {
    const serverHandler = new ServerHandler<Context, DefaultPage, DefaultMeta>(
        resourceManager,
        pageProvider,
        metaProvider,
    );
    serverHandler.setPrefix('/api/v1');
    serverHandler.setDomain('www.example.com');

    return serverHandler;
}

export function makeResourceObserver(
    resourceManager: ResourceManager<Context, DefaultPage>,
): ResourceObserver<Context> {
    const resourceInformer = makeResourceInformer(resourceManager, makePage, defaultErrorFormatter);
    const resourceObserver = new ResourceObserver(resourceInformer);

    connectToResourceManager(resourceManager, (event: IncomingEvent) => {
        resourceObserver.handleEvent(event);
    });

    return resourceObserver;
}

export function makeClient(
    serverHandler: ServerHandler<Context, DefaultPage, DefaultMeta>,
): Client<Context, DefaultPage, DefaultMeta> {
    const queryConverter = new QueryConverter<DefaultPage>(pageProvider);
    queryConverter.setPrefix('/api/v1');
    queryConverter.setDomain('www.example.com');
    const methodMap = {
        get: 'GET',
        add: 'POST',
        operations: 'POST',
        update: 'PATCH',
        remove: 'DELETE',
    };

    const fetcher: Fetcher<Context, DefaultPage> = (context, method, query, body) => {
        const url = queryConverter.make(query);
        return serverHandler.handle(context, methodMap[method], url, body).then((result) => {
            result.eventStore.emit();
            return result.body;
        });
    };

    const client = new Client<Context, DefaultPage, DefaultMeta>(clientPageProvider, fetcher);

    return client;
}

export function makeObserver(initialContext: Context, resourceObserver: ResourceObserver<Context>): Observer<Context> {
    const observer = new Observer(initialContext, (context, observationQuery, callback) => {
        let abortController = new AbortController();
        resourceObserver.observe(initialContext, observationQuery, callback, abortController.signal);

        return {
            updateObservationQuery(newObservationQuery) {
                abortController.abort();
                abortController = new AbortController();
                resourceObserver.observe(context, newObservationQuery, callback, abortController.signal);
            },
            disconnect() {
                abortController.abort();
            },
        };
    });

    return observer;
}
