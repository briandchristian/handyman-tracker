// Utility function to handle API errors with helpful messages

export const handleApiError = (err, _context = 'request') => {
  // Check if it's a network/connection error (no response received)
  if (!err.response) {
    // Connection refused, timeout, or network error
    if (err.code === 'ERR_NETWORK' || err.message.includes('Network Error')) {
      return {
        type: 'network',
        title: 'Cannot Connect to Server',
        message: `The server is not reachable.\n\n` +
                 `Possible issues:\n` +
                 `• Server is not running\n` +
                 `• Wrong server address\n` +
                 `• Network connectivity problem\n` +
                 `• Firewall blocking connection\n\n` +
                 `Please make sure you're accessing from: http://192.168.50.87:5173`,
        details: err.message
      };
    } else if (err.code === 'ECONNREFUSED') {
      return {
        type: 'connection_refused',
        title: 'Connection Refused',
        message: `The server refused the connection.\n\n` +
                 `• Check if the backend server is running\n` +
                 `• Verify you're using the correct server address\n` +
                 `• Contact your system administrator`,
        details: err.message
      };
    } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
      return {
        type: 'timeout',
        title: 'Connection Timeout',
        message: `The server took too long to respond.\n\n` +
                 `• Check your network connection\n` +
                 `• The server might be overloaded\n` +
                 `• Try again in a moment`,
        details: err.message
      };
    } else {
      return {
        type: 'unknown_network',
        title: 'Network Error',
        message: `A network error occurred.\n\n${err.message}`,
        details: err.message
      };
    }
  }
  
  // Server responded with an error status
  const status = err.response.status;
  const serverMessage = err.response?.data?.msg || err.response?.data?.message;
  
  if (status === 400) {
    return {
      type: 'bad_request',
      title: 'Invalid Request',
      message: serverMessage || 'The request was invalid or contained errors.',
      details: err.message
    };
  } else if (status === 401) {
    return {
      type: 'unauthorized',
      title: 'Authentication Failed',
      message: serverMessage || 'Invalid credentials or session expired.',
      details: err.message
    };
  } else if (status === 403) {
    return {
      type: 'forbidden',
      title: 'Access Denied',
      message: serverMessage || 'You do not have permission to perform this action.',
      details: err.message
    };
  } else if (status === 404) {
    return {
      type: 'not_found',
      title: 'Not Found',
      message: serverMessage || 'The requested resource was not found.',
      details: err.message
    };
  } else if (status === 500) {
    return {
      type: 'server_error',
      title: 'Server Error',
      message: serverMessage || 'The server encountered an error. Please try again later.',
      details: err.message
    };
  } else if (status === 502) {
    return {
      type: 'bad_gateway',
      title: 'Bad Gateway',
      message: 'The server is temporarily unavailable.\n\n' +
               '• The backend server might be down\n' +
               '• Network configuration issue\n' +
               '• Contact your system administrator',
      details: err.message
    };
  } else if (status === 503) {
    return {
      type: 'service_unavailable',
      title: 'Service Unavailable',
      message: 'The server is temporarily unavailable. Please try again later.',
      details: err.message
    };
  } else {
    return {
      type: 'unknown',
      title: `Error (${status})`,
      message: serverMessage || err.message || 'An unexpected error occurred.',
      details: err.message
    };
  }
};

// Format error for display in alert
export const formatErrorAlert = (errorInfo) => {
  return `❌ ${errorInfo.title}\n\n${errorInfo.message}`;
};

// Log error details to console
export const logError = (context, err, errorInfo) => {
  console.error(`[${context}] Error:`, {
    type: errorInfo.type,
    code: err.code,
    message: err.message,
    status: err.response?.status,
    response: err.response?.data,
    url: err.config?.url,
    method: err.config?.method
  });
};

