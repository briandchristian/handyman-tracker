/**
 * Unit Tests for Error Handler Utilities
 * Testing: handleApiError, formatErrorAlert, logError
 */

import { handleApiError, formatErrorAlert, logError } from '../errorHandler.js';

describe('handleApiError', () => {
  describe('Network Errors (no response)', () => {
    test('should handle ERR_NETWORK error', () => {
      const error = {
        code: 'ERR_NETWORK',
        message: 'Network Error'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('network');
      expect(result.title).toBe('Cannot Connect to Server');
      expect(result.message).toContain('server is not reachable');
      expect(result.message).toContain('Server is not running');
      expect(result.details).toBe('Network Error');
    });

    test('should handle Network Error in message', () => {
      const error = {
        message: 'Network Error occurred'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('network');
      expect(result.title).toBe('Cannot Connect to Server');
    });

    test('should handle ECONNREFUSED error', () => {
      const error = {
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('connection_refused');
      expect(result.title).toBe('Connection Refused');
      expect(result.message).toContain('server refused the connection');
      expect(result.message).toContain('backend server is running');
    });

    test('should handle ECONNABORTED error', () => {
      const error = {
        code: 'ECONNABORTED',
        message: 'Connection aborted'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('timeout');
      expect(result.title).toBe('Connection Timeout');
      expect(result.message).toContain('took too long to respond');
    });

    test('should handle timeout in message', () => {
      const error = {
        message: 'timeout of 5000ms exceeded'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('timeout');
      expect(result.title).toBe('Connection Timeout');
      expect(result.message).toContain('network connection');
    });

    test('should handle unknown network error', () => {
      const error = {
        message: 'Unknown network issue'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('unknown_network');
      expect(result.title).toBe('Network Error');
      expect(result.message).toContain('Unknown network issue');
    });

    test('should handle error with no code or recognizable message', () => {
      const error = {
        message: 'Something went wrong'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('unknown_network');
      expect(result.message).toContain('Something went wrong');
    });
  });

  describe('HTTP Status Errors (with response)', () => {
    test('should handle 400 Bad Request', () => {
      const error = {
        response: {
          status: 400,
          data: {
            msg: 'Invalid input data'
          }
        },
        message: 'Request failed with status code 400'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('bad_request');
      expect(result.title).toBe('Invalid Request');
      expect(result.message).toBe('Invalid input data');
    });

    test('should handle 400 with default message', () => {
      const error = {
        response: {
          status: 400
        },
        message: 'Bad request'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('bad_request');
      expect(result.message).toBe('The request was invalid or contained errors.');
    });

    test('should handle 401 Unauthorized', () => {
      const error = {
        response: {
          status: 401,
          data: {
            msg: 'Invalid token'
          }
        },
        message: 'Request failed'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('unauthorized');
      expect(result.title).toBe('Authentication Failed');
      expect(result.message).toBe('Invalid token');
    });

    test('should handle 401 with default message', () => {
      const error = {
        response: {
          status: 401
        },
        message: 'Unauthorized'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('unauthorized');
      expect(result.message).toBe('Invalid credentials or session expired.');
    });

    test('should handle 403 Forbidden', () => {
      const error = {
        response: {
          status: 403,
          data: {
            msg: 'Admin access required'
          }
        },
        message: 'Forbidden'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('forbidden');
      expect(result.title).toBe('Access Denied');
      expect(result.message).toBe('Admin access required');
    });

    test('should handle 403 with default message', () => {
      const error = {
        response: {
          status: 403
        },
        message: 'Forbidden'
      };

      const result = handleApiError(error);

      expect(result.message).toBe('You do not have permission to perform this action.');
    });

    test('should handle 404 Not Found', () => {
      const error = {
        response: {
          status: 404,
          data: {
            msg: 'Customer not found'
          }
        },
        message: 'Not found'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('not_found');
      expect(result.title).toBe('Not Found');
      expect(result.message).toBe('Customer not found');
    });

    test('should handle 404 with default message', () => {
      const error = {
        response: {
          status: 404
        },
        message: 'Not found'
      };

      const result = handleApiError(error);

      expect(result.message).toBe('The requested resource was not found.');
    });

    test('should handle 500 Server Error', () => {
      const error = {
        response: {
          status: 500,
          data: {
            msg: 'Database connection failed'
          }
        },
        message: 'Server error'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('server_error');
      expect(result.title).toBe('Server Error');
      expect(result.message).toBe('Database connection failed');
    });

    test('should handle 500 with default message', () => {
      const error = {
        response: {
          status: 500
        },
        message: 'Server error'
      };

      const result = handleApiError(error);

      expect(result.message).toBe('The server encountered an error. Please try again later.');
    });

    test('should handle 502 Bad Gateway', () => {
      const error = {
        response: {
          status: 502
        },
        message: 'Bad gateway'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('bad_gateway');
      expect(result.title).toBe('Bad Gateway');
      expect(result.message).toContain('temporarily unavailable');
      expect(result.message).toContain('backend server might be down');
    });

    test('should handle 503 Service Unavailable', () => {
      const error = {
        response: {
          status: 503
        },
        message: 'Service unavailable'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('service_unavailable');
      expect(result.title).toBe('Service Unavailable');
      expect(result.message).toContain('temporarily unavailable');
    });

    test('should handle unknown status code', () => {
      const error = {
        response: {
          status: 418, // I'm a teapot
          data: {
            msg: 'Unusual error'
          }
        },
        message: 'Unknown error'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('unknown');
      expect(result.title).toBe('Error (418)');
      expect(result.message).toBe('Unusual error');
    });

    test('should handle status with message in different field', () => {
      const error = {
        response: {
          status: 400,
          data: {
            message: 'Error from message field' // Using 'message' instead of 'msg'
          }
        },
        message: 'Bad request'
      };

      const result = handleApiError(error);

      expect(result.message).toBe('Error from message field');
    });

    test('should use error message when no server message', () => {
      const error = {
        response: {
          status: 418,
          data: {}
        },
        message: 'Custom error message'
      };

      const result = handleApiError(error);

      expect(result.message).toBe('Custom error message');
    });

    test('should handle missing data object in response', () => {
      const error = {
        response: {
          status: 400
        },
        message: 'Request failed'
      };

      const result = handleApiError(error);

      expect(result.type).toBe('bad_request');
      expect(result.message).toBe('The request was invalid or contained errors.');
    });
  });

  describe('Edge Cases', () => {
    test('should handle error with both code and response', () => {
      // In practice, if there's a response, code might still exist
      const error = {
        code: 'ERR_NETWORK',
        response: {
          status: 500
        },
        message: 'Error'
      };

      const result = handleApiError(error);

      // Should prioritize response over code
      expect(result.type).toBe('server_error');
    });

    test('should handle error with empty response object', () => {
      const error = {
        response: {},
        message: 'Error'
      };

      const result = handleApiError(error);

      // Should handle missing status
      expect(result).toBeDefined();
    });

    test('should handle null/undefined values', () => {
      const error = {
        response: {
          status: 400,
          data: {
            msg: null
          }
        },
        message: 'Error'
      };

      const result = handleApiError(error);

      expect(result.message).toBe('The request was invalid or contained errors.');
    });

    test('should preserve error details in all cases', () => {
      const error = {
        code: 'ERR_NETWORK',
        message: 'Detailed error message'
      };

      const result = handleApiError(error);

      expect(result.details).toBe('Detailed error message');
    });

    test('should handle context parameter (currently unused)', () => {
      const error = {
        code: 'ERR_NETWORK',
        message: 'Error'
      };

      // Context is provided but not used in current implementation
      const result = handleApiError(error, 'login');

      expect(result.type).toBe('network');
    });
  });
});

describe('formatErrorAlert', () => {
  test('should format error info for alert display', () => {
    const errorInfo = {
      title: 'Connection Error',
      message: 'Cannot reach server'
    };

    const result = formatErrorAlert(errorInfo);

    expect(result).toBe('❌ Connection Error\n\nCannot reach server');
  });

  test('should include emoji in formatted message', () => {
    const errorInfo = {
      title: 'Error',
      message: 'Something went wrong'
    };

    const result = formatErrorAlert(errorInfo);

    expect(result).toContain('❌');
  });

  test('should handle multi-line messages', () => {
    const errorInfo = {
      title: 'Validation Error',
      message: 'Multiple issues:\n• Issue 1\n• Issue 2'
    };

    const result = formatErrorAlert(errorInfo);

    expect(result).toContain('Validation Error');
    expect(result).toContain('Multiple issues');
    expect(result).toContain('• Issue 1');
  });

  test('should handle empty strings', () => {
    const errorInfo = {
      title: '',
      message: ''
    };

    const result = formatErrorAlert(errorInfo);

    expect(result).toBe('❌ \n\n');
  });

  test('should handle special characters', () => {
    const errorInfo = {
      title: 'Error & Warning',
      message: 'Message with "quotes" and \'apostrophes\''
    };

    const result = formatErrorAlert(errorInfo);

    expect(result).toContain('Error & Warning');
    expect(result).toContain('"quotes"');
    expect(result).toContain("'apostrophes'");
  });
});

describe('logError', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('should log error to console', () => {
    const context = 'login';
    const err = {
      code: 'ERR_NETWORK',
      message: 'Network error',
      config: {
        url: '/api/login',
        method: 'POST'
      }
    };
    const errorInfo = {
      type: 'network',
      message: 'Cannot connect'
    };

    logError(context, err, errorInfo);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[login] Error:',
      expect.objectContaining({
        type: 'network',
        code: 'ERR_NETWORK',
        message: 'Network error',
        url: '/api/login',
        method: 'POST'
      })
    );
  });

  test('should log error with response data', () => {
    const context = 'registration';
    const err = {
      message: 'Request failed',
      response: {
        status: 400,
        data: {
          msg: 'Validation failed'
        }
      },
      config: {
        url: '/api/register',
        method: 'POST'
      }
    };
    const errorInfo = {
      type: 'bad_request'
    };

    logError(context, err, errorInfo);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[registration] Error:',
      expect.objectContaining({
        status: 400,
        response: {
          msg: 'Validation failed'
        }
      })
    );
  });

  test('should handle missing optional fields', () => {
    const context = 'test';
    const err = {
      message: 'Simple error'
    };
    const errorInfo = {
      type: 'unknown'
    };

    logError(context, err, errorInfo);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[test] Error:',
      expect.objectContaining({
        type: 'unknown',
        code: undefined,
        message: 'Simple error',
        status: undefined,
        response: undefined,
        url: undefined,
        method: undefined
      })
    );
  });

  test('should format context in log message', () => {
    const err = { message: 'Error' };
    const errorInfo = { type: 'test' };

    logError('user-authentication', err, errorInfo);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[user-authentication] Error:',
      expect.any(Object)
    );
  });

  test('should include all available error information', () => {
    const err = {
      code: 'CUSTOM_CODE',
      message: 'Custom error',
      response: {
        status: 500,
        data: {
          error: 'Server crashed'
        }
      },
      config: {
        url: '/api/test',
        method: 'GET'
      }
    };
    const errorInfo = {
      type: 'server_error'
    };

    logError('test', err, errorInfo);

    const loggedObject = consoleErrorSpy.mock.calls[0][1];
    expect(loggedObject).toHaveProperty('type', 'server_error');
    expect(loggedObject).toHaveProperty('code', 'CUSTOM_CODE');
    expect(loggedObject).toHaveProperty('message', 'Custom error');
    expect(loggedObject).toHaveProperty('status', 500);
    expect(loggedObject).toHaveProperty('response', { error: 'Server crashed' });
    expect(loggedObject).toHaveProperty('url', '/api/test');
    expect(loggedObject).toHaveProperty('method', 'GET');
  });
});

