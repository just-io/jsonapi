import { Pointer } from '@just-io/schema';

export interface CommonError {
    code?: string;
    source?:
        | {
              pointer: string;
              header?: string;
          }
        | {
              parameter: 'include' | 'fields' | 'sort' | 'filter' | 'page' | 'query' | 'method';
              header?: string;
          };
    status: number;
    title: string;
    detail?: string;
}

// add lang
// move to formatters

export class ErrorFactory {
    static makeInternalError(detail?: string): CommonError {
        return { title: 'The backend responded with an error', status: 500, detail };
    }

    static makeQueryError(title: string, detail?: string): CommonError {
        return { source: { parameter: 'query' }, title, status: 400, detail };
    }

    static makeMethodNotAllowedError(method: 'get' | 'post' | 'patch' | 'delete'): CommonError {
        return {
            source: { parameter: 'method' },
            title: 'Method Not Allowed',
            status: 405,
            detail: `The method '${method}' is not allowed.`,
        };
    }

    static makeInvalidMethodError(method: string): CommonError {
        return {
            source: { parameter: 'method' },
            title: 'Method Not Allowed',
            status: 405,
            detail: `The method '${method}' is invalid.`,
        };
    }

    static makeMethodNotAllowedErrorByPointer(
        method: 'list' | 'add' | 'update' | 'remove',
        type: string,
        pointer: Pointer,
    ): CommonError {
        return {
            source: { pointer: pointer.toString() },
            title: 'Method Not Allowed',
            status: 405,
            detail: `The method '${method}' is not allowed for resource with type '${type}'.`,
        };
    }

    static makeInvalidQueryParameterError(
        location: 'include' | 'fields' | 'sort' | 'filter' | 'page' | Pointer,
        detail?: string,
    ): CommonError {
        return {
            source: location instanceof Pointer ? { pointer: location.toString() } : { parameter: location },
            title: 'Invalid Query Parameter',
            status: 400,
            detail,
        };
    }

    static makeForbiddenError(location: 'query' | 'include' | Pointer, detail?: string): CommonError {
        return {
            source: location instanceof Pointer ? { pointer: location.toString() } : { parameter: location },
            title: 'Forbidden',
            status: 403,
            detail,
        };
    }

    static makeNotFoundError(location: 'query' | 'include' | Pointer, detail?: string): CommonError {
        return {
            source: location instanceof Pointer ? { pointer: location.toString() } : { parameter: location },
            title: 'Not found',
            status: 404,
            detail,
        };
    }

    static makeInvalidResourceTypeError(type: string, location: 'query' | Pointer): CommonError {
        return {
            source: location instanceof Pointer ? { pointer: location.toString() } : { parameter: location },
            title: 'Invalid Resource Type',
            status: 404,
            detail: `The resource with type '${type}' is not existed.`,
        };
    }

    static makeInvalidResourceIdError(pointer: Pointer): CommonError {
        return {
            source: { pointer: pointer.toString() },
            title: 'Invalid Resource Id',
            status: 400,
            detail: `The resource with id does not equal query id.`,
        };
    }

    static makeInvalidResourceLidError(pointer: Pointer): CommonError {
        return {
            source: { pointer: pointer.toString() },
            title: 'Invalid Resource Lid',
            status: 400,
            detail: `The resource with lid does not have reference.`,
        };
    }

    static makeFieldError(pointer: Pointer, detail?: string): CommonError {
        return {
            source: { pointer: pointer.toString() },
            title: 'Invalid Field',
            status: 400,
            detail,
        };
    }

    static makeContainingFieldError(pointer: Pointer, field: string): CommonError {
        return {
            source: { pointer: pointer.toString() },
            title: 'Invalid Field',
            status: 400,
            detail: `The resource does not have field '${field}'.`,
        };
    }
}
