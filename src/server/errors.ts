import { Pointer, ValidationError } from '@just-io/schema';
import { CommonError } from '../types/formats';
import { ErrorFormatter } from './error-formatter';

export class ErrorFactory {
    static makeInternalError(errorFormatter: ErrorFormatter, detail?: string): CommonError {
        return { title: errorFormatter.server.internalTitle(), status: 500, detail };
    }

    static makeQueryError(title: string, detail?: string): CommonError {
        return { source: { parameter: 'query' }, title, status: 400, detail };
    }

    static makeMethodNotAllowedError(
        errorFormatter: ErrorFormatter,
        method: 'get' | 'post' | 'patch' | 'delete',
    ): CommonError {
        return {
            source: { parameter: 'method' },
            title: errorFormatter.server.methodNotAllowedTitle(),
            status: 405,
            detail: errorFormatter.server.methodNotAllowed(method),
        };
    }

    static makeInvalidMethodError(errorFormatter: ErrorFormatter, method: string): CommonError {
        return {
            source: { parameter: 'method' },
            title: errorFormatter.server.methodNotAllowedTitle(),
            status: 405,
            detail: errorFormatter.server.methodNotAllowed(method),
        };
    }

    static makeMethodNotAllowedErrorByPointer(
        errorFormatter: ErrorFormatter,
        method: 'list' | 'add' | 'update' | 'remove',
        type: string,
        pointer: Pointer,
    ): CommonError {
        return {
            source: { pointer: pointer.toString() },
            title: errorFormatter.server.methodNotAllowedTitle(),
            status: 405,
            detail: errorFormatter.server.methodNotAllowedForResourceType(method, type),
        };
    }

    static makeInvalidQueryParameterError(
        errorFormatter: ErrorFormatter,
        location: 'include' | 'fields' | 'sort' | 'filter' | 'page',
        detail?: string,
    ): CommonError {
        return {
            source: { parameter: location },
            title: errorFormatter.query.invalidQueryParameterTitle(),
            status: 400,
            detail,
        };
    }

    static makeForbiddenError(
        errorFormatter: ErrorFormatter,
        location: 'query' | 'include' | Pointer,
        detail?: string,
    ): CommonError {
        return {
            source: location instanceof Pointer ? { pointer: location.toString() } : { parameter: location },
            title: errorFormatter.resource.forbiddenTitle(),
            status: 403,
            detail,
        };
    }

    static makeNotFoundError(
        errorFormatter: ErrorFormatter,
        location: 'query' | 'include' | Pointer,
        detail?: string,
    ): CommonError {
        return {
            source: location instanceof Pointer ? { pointer: location.toString() } : { parameter: location },
            title: errorFormatter.resource.notFoundTitle(),
            status: 404,
            detail,
        };
    }

    static makeInvalidResourceTypeError(
        errorFormatter: ErrorFormatter,
        type: string,
        location: 'query' | Pointer,
    ): CommonError {
        return {
            source: location instanceof Pointer ? { pointer: location.toString() } : { parameter: location },
            title: errorFormatter.resource.invalidResourceTypeTitle(),
            status: 404,
            detail: errorFormatter.resource.invalidResourceType(type),
        };
    }

    static makeInvalidResourceIdError(errorFormatter: ErrorFormatter, pointer: Pointer): CommonError {
        return {
            source: { pointer: pointer.toString() },
            title: errorFormatter.resource.invalidResourceIdTitle(),
            status: 400,
            detail: errorFormatter.resource.invalidResourceId(),
        };
    }

    static makeInvalidResourceLidError(errorFormatter: ErrorFormatter, pointer: Pointer): CommonError {
        return {
            source: { pointer: pointer.toString() },
            title: errorFormatter.resource.invalidResourceLidTitle(),
            status: 400,
            detail: errorFormatter.resource.invalidResourceLid(),
        };
    }

    static makeFieldError(errorFormatter: ErrorFormatter, pointer: Pointer, detail?: string): CommonError {
        return {
            source: { pointer: pointer.toString() },
            title: errorFormatter.resource.invalidResourceFieldTitle(),
            status: 400,
            detail,
        };
    }

    static makeContainingFieldError(
        errorFormatter: ErrorFormatter,
        pointer: Pointer,
        type: string,
        field: string,
    ): CommonError {
        return {
            source: { pointer: pointer.toString() },
            title: errorFormatter.resource.invalidResourceFieldTitle(),
            status: 400,
            detail: errorFormatter.resource.invalidResourceField(type, field),
        };
    }

    static makeFieldErrorByValidationError(
        errorFormatter: ErrorFormatter,
        validationError: ValidationError,
    ): CommonError {
        return {
            source: { pointer: validationError.pointer.toString('/') },
            title: errorFormatter.resource.invalidResourceFieldTitle(),
            status: 422,
            detail: validationError.detail,
        };
    }
}
