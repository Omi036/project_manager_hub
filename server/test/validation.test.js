const assert = require("node:assert/strict");
const test = require("node:test");
const { validateJsonBody, validateRequest } = require("../validation");

// Helper function to run a middleware function with a mock request and response, and capture the results
function runMiddleware(middleware, request) {
    let responseBody;
    let statusCode;
    let nextCalled = false;
    const response = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(body) {
            responseBody = body;
            return this;
        },
    };

    middleware(request, response, () => {
        nextCalled = true;
    });

    return { nextCalled, statusCode, responseBody };
}


test("accepts a valid required JSON body", () => {
    const result = runMiddleware(validateJsonBody({
        title: { type: "string", required: true, maxLength: 200 },
    }), { body: { title: "A project" }, params: {}, query: {} });

    assert.equal(result.nextCalled, true);
    assert.equal(result.statusCode, undefined);
});

test("rejects missing required fields with a 400 response", () => {
    const result = runMiddleware(validateJsonBody({
        title: { type: "string", required: true },
    }), { body: {}, params: {}, query: {} });

    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 400);
    assert.deepEqual(result.responseBody, {
        error: "Invalid request",
        details: ["title is required"],
    });
});

test("rejects invalid route identifiers and query values", () => {
    const middleware = validateRequest({
        params: { id: { type: "identifier" } },
        query: { name: { type: "string", required: true } },
    });
    const result = runMiddleware(middleware, {
        body: {},
        params: { id: "bad id" },
        query: {},
    });

    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 400);
    assert.deepEqual(result.responseBody.details, [
        "Parameter id must be a valid identifier",
        "Query name is required",
    ]);
});
