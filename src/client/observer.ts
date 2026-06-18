import { ObservationEvent, ObservationQuery } from '../types/observer';

export interface ObserverProvider {
    updateObservationQuery(newObservationQuery: ObservationQuery): void;
    disconnect(): void;
}

type State =
    | {
          observing: false;
      }
    | {
          observing: true;
          provider: ObserverProvider;
      };

export class Observer<C> {
    #context: C;

    #state: State = {
        observing: false,
    };

    #makeObserverProvider: (
        context: C,
        observationQuery: ObservationQuery,
        callback: (events: ObservationEvent[]) => void,
    ) => ObserverProvider;

    #observationQueryMap: Map<ObservationQuery, (events: ObservationEvent[]) => void> = new Map();

    #callback = (events: ObservationEvent[]): void => {
        for (const [observationQuery, callback] of this.#observationQueryMap) {
            const filteredEvents: ObservationEvent[] = [];
            for (const event of events) {
                switch (event.type) {
                    case 'add': {
                        if (observationQuery.types?.[event.resourceIdentifier.type]?.adding) {
                            filteredEvents.push(event);
                        }
                        break;
                    }
                    case 'update': {
                        if (observationQuery.types?.[event.resourceIdentifier.type]?.updating) {
                            filteredEvents.push(event);
                            break;
                        }
                        if (
                            observationQuery.resources?.[event.resourceIdentifier.type]?.[event.resourceIdentifier.id]
                                ?.relationships
                        ) {
                            filteredEvents.push(event);
                        }
                        break;
                    }
                    case 'remove': {
                        if (
                            observationQuery.resources?.[event.resourceIdentifier.type]?.[event.resourceIdentifier.id]
                                ?.relationships
                        ) {
                            filteredEvents.push(event);
                        }
                        break;
                    }
                    case 'outer-update': {
                        if (
                            observationQuery.resources?.[event.resourceIdentifier.type]?.[event.resourceIdentifier.id]
                                ?.outer
                        ) {
                            filteredEvents.push(event);
                        }
                        break;
                    }
                }
            }
            callback(filteredEvents);
        }
    };

    constructor(
        context: C,
        makeObserverProvider: (
            context: C,
            observationQuery: ObservationQuery,
            callback: (events: ObservationEvent[]) => void,
        ) => ObserverProvider,
    ) {
        this.#context = context;
        this.#makeObserverProvider = makeObserverProvider;
    }

    #composeObservationQuery(): ObservationQuery {
        const commonObservationQuery: Required<ObservationQuery> = {
            types: {},
            resources: {},
        };
        for (const observationQuery of this.#observationQueryMap.keys()) {
            if (observationQuery.types) {
                for (const type of Object.keys(observationQuery.types)) {
                    if (!commonObservationQuery.types[type]) {
                        commonObservationQuery.types[type] = {};
                    }
                    if (observationQuery.types[type].adding) {
                        commonObservationQuery.types[type].adding = true;
                    }
                    if (observationQuery.types[type].updating) {
                        commonObservationQuery.types[type].updating = true;
                    }
                }
            }
            if (observationQuery.resources) {
                for (const type of Object.keys(observationQuery.resources)) {
                    for (const id of Object.keys(observationQuery.resources[type])) {
                        if (!commonObservationQuery.resources[type]) {
                            commonObservationQuery.resources[type] = {};
                        }
                        if (!commonObservationQuery.resources[type][id]) {
                            commonObservationQuery.resources[type][id] = {};
                        }
                        if (observationQuery.resources[type][id].relationships) {
                            if (!commonObservationQuery.resources[type][id].relationships) {
                                commonObservationQuery.resources[type][id].relationships = {};
                            }
                            for (const relationship of Object.keys(
                                observationQuery.resources[type][id].relationships,
                            )) {
                                commonObservationQuery.resources[type][id].relationships[relationship] ||=
                                    observationQuery.resources[type][id].relationships[relationship];
                            }
                        }
                        commonObservationQuery.resources[type][id].outer ||=
                            observationQuery.resources[type][id].outer ?? false;
                    }
                }
            }
        }

        return commonObservationQuery;
    }

    observe(observationQuery: ObservationQuery, callback: (events: ObservationEvent[]) => void): () => void {
        this.#observationQueryMap.set(observationQuery, callback);

        if (!this.#state.observing) {
            this.#state = {
                observing: true,
                provider: this.#makeObserverProvider(this.#context, this.#composeObservationQuery(), this.#callback),
            };
        } else {
            this.#state.provider.updateObservationQuery(this.#composeObservationQuery());
        }

        return () => {
            this.#observationQueryMap.delete(observationQuery);
            if (this.#state.observing) {
                if (this.#observationQueryMap.size === 0) {
                    this.#state.provider.disconnect();
                    this.#state = {
                        observing: false,
                    };
                } else {
                    this.#state.provider.updateObservationQuery(this.#composeObservationQuery());
                }
            }
        };
    }
}
