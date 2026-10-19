export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;
  public readonly responseFormat?: "standard" | "success_false" | "allowed_false";

  constructor(
    message: string,
    statusCode = 500,
    details?: any,
    responseFormat: "standard" | "success_false" | "allowed_false" = "standard"
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    this.responseFormat = responseFormat;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: any) {
    super(message, 400, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: any) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409);
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message = "Insufficient credit balance", details?: any) {
    super(message, 402, details);
  }
}

export class ModerationRejectedError extends AppError {
  constructor(message: string) {
    super(message, 422, undefined, "allowed_false");
  }
}
