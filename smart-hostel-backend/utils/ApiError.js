/**
 * Custom API error class that extends native Error
 * Usage: throw new ApiError(404, "User not found")
 */
class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.message    = message;
    this.errors     = errors;
    this.success    = false;

    Error.captureStackTrace(this, this.constructor);
  }
}

export { ApiError };
