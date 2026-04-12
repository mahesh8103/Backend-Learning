/**
 * Standard API success response
 * Usage: res.status(200).json(new ApiResponse(200, data, "Fetched successfully"))
 */
class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.success    = statusCode < 400;
    this.statusCode = statusCode;
    this.message    = message;
    this.data       = data;
  }
}

export { ApiResponse };
