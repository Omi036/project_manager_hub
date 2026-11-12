const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates a value against a rule and returns an error message if invalid, or null if valid.
 */
function validateValue(value, rule, fieldName) {
    // Check for required fields
    if (value === undefined) {
        return rule.required ? `${fieldName} is required` : null;
    }

    // Check for nullability
    if (value === null) {
        return rule.nullable ? null : `${fieldName} must not be null`;
    }

    // Check for type and other constraints
    if (rule.types && !rule.types.some((type) => (
        (type === "string" && typeof value === "string")
        || (type === "array" && Array.isArray(value))
        || (type === "object" && isPlainObject(value))
    ))) {
        return `${fieldName} has an invalid type`;
    }

    // Checks if value is the specified type
    if (rule.type === "object" && !isPlainObject(value)) {
        return `${fieldName} must be an object`;
    }
    if (rule.type === "array" && !Array.isArray(value)) {
        return `${fieldName} must be an array`;
    }
    if (rule.type === "string" && typeof value !== "string") {
        return `${fieldName} must be a string`;
    }
    if (rule.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
        return `${fieldName} must be a number`;
    }
    if (rule.type === "integer"
        && !((Number.isInteger(value) && value >= 0) || (typeof value === "string" && /^\d+$/.test(value)))) {
        return `${fieldName} must be a non-negative integer`;
    }

    
    if (rule.type === "identifier"
        && (typeof value !== "string" || !value || value.length > (rule.maxLength || 64)
            || !IDENTIFIER_PATTERN.test(value))) {
        return `${fieldName} must be a valid identifier`;
    }
    if (rule.maxLength && typeof value === "string" && value.length > rule.maxLength) {
        return `${fieldName} must be at most ${rule.maxLength} characters`;
    }
    if (rule.enum && !rule.enum.includes(value)) {
        return `${fieldName} must be one of: ${rule.enum.join(", ")}`;
    }
    if (rule.pattern && (typeof value !== "string" || !rule.pattern.test(value))) {
        return `${fieldName} has an invalid format`;
    }
    if (rule.item && Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const error = validateValue(value[index], rule.item, `${fieldName}[${index}]`);
            if (error) return error;
        }
    }

    return null;
}

function validateRequest({ body, params, query, custom } = {}) {
    return (request, response, next) => {
        const details = [];

        if (body) {
            // Checks if the body is not an object
            if (body.required && !isPlainObject(request.body)) {
                details.push("Request body must be a JSON object");

            // Checks if the body is not an object
            } else if (request.body !== undefined && request.body !== null && !isPlainObject(request.body)) {
                details.push("Request body must be a JSON object");

            // If its an object, validate each entry
            } else if (isPlainObject(request.body)) {

                // Validate each field in the body against the specified rules
                for (const [field, rule] of Object.entries(body.fields || {})) {
                    const error = validateValue(request.body[field], rule, field);
                    if (error) details.push(error);
                }

                // Validate that at least one of the specified fields is present in the body
                for (const fields of body.oneOfRequired || []) {
                    if (!fields.some((field) => request.body[field] !== undefined
                        && request.body[field] !== null
                        && request.body[field] !== "")) {
                        details.push(`At least one of ${fields.join(", ")} is required`);
                    }
                }

                // Validate that the body is not empty if required
                if (body.nonEmpty && Object.keys(request.body).length === 0 && details.length === 0) {
                    details.push("Request body must not be empty");
                }
            }
        }

        // validate params
        for (const [field, rule] of Object.entries(params || {})) {
            const error = validateValue(request.params[field], rule, `Parameter ${field}`);
            if (error) details.push(error);
        }

        // validates query params
        for (const [field, rule] of Object.entries(query || {})) {
            const error = validateValue(request.query[field], rule, `Query ${field}`);
            if (error) details.push(error);
        }

        // If a custom validation function is provided, call it and add any errors to the details array
        if (typeof custom === "function") {
            const customErrors = custom(request);
            details.push(...(Array.isArray(customErrors) ? customErrors : [customErrors]).filter(Boolean));
        }

        // Returns a 400 response with the details of the validation errors if any were found, otherwise calls next() to continue processing the request
        if (details.length) {
            return response.status(400).json({ error: "Invalid request", details });
        }
        return next();
    };
}

// Validates that the request body is a JSON object with the specified fields and options, and returns a middleware function that can be used in an Express route.
function validateJsonBody(fields, options = {}) {
    return validateRequest({
        body: {
            required: true,
            nonEmpty: options.nonEmpty !== false,
            fields,
            oneOfRequired: options.oneOfRequired,
        },
    });
}

module.exports = { validateJsonBody, validateRequest };
