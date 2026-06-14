import { ResourceIdentifier } from './common';

export type ObservationQueryResourceOptions = {
    relationships?: {
        [relationship: string]: boolean;
    };
    outer?: boolean;
};

export type ObservationQuery = {
    types?: {
        [type: string]: {
            adding?: boolean;
            updating?: boolean;
        };
    };
    resources?: {
        [type: string]: {
            [id: string]: ObservationQueryResourceOptions;
        };
    };
};

export type ObservationEvent = {
    id: string;
    type: 'add' | 'update' | 'remove' | 'outer-update';
    resourceIdentifier: ResourceIdentifier<string>;
};
