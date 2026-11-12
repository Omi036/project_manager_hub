//// IMPORTS
const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { createAuthMiddleware, createAuthRouter } = require("./auth");

const path = require('path');
const pool = require("./database");

const { ProjectsManager } = require("./managers/projects");
const { UsersManager } = require("./managers/users");
const { DiscussionsManager } = require("./managers/discussions");
const { NewsManager } = require("./managers/news");

require('dotenv').config({ quiet: true });



//// RATE LIMITING
// Validates that an environment variable is a positive integer, or returns a fallback value.
function positiveIntegerEnv(name, fallback) {
    const value = process.env[name];
    if (value === undefined) return fallback;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}

const rateLimitWindowMs = positiveIntegerEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000);
const apiRateLimitMax = positiveIntegerEnv("API_RATE_LIMIT_MAX", 100);
const authRateLimitMax = positiveIntegerEnv("AUTH_RATE_LIMIT_MAX", 10);

// Creates the rate limit 
const apiLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: apiRateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});
const authLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: authRateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});



///// API
const app = express();

app.use(cors({origin: process.env.CLIENT_ORIGIN || false, credentials: true,}));
app.use(express.json({ limit: "1mb" }));
app.use("/auth", authLimiter, createAuthRouter(pool));
app.use("/api", apiLimiter, createAuthMiddleware(pool, {
    publicGetAllRoutes: [
        "/projects/all",
        "/users/all",
        "/discussions/all",
        "/news/all",
    ],
    publicGetPrefixes: ["/discussions/", "/projects/"],
}));

// The API also serves as a web server
if(process.env.SHOULD_SERVE_WEB) {
    app.use(express.static(path.join(__dirname, '../client/')));
}


// Main router, with orm routes
const router = express.Router();
router.use("/projects",    new ProjectsManager(pool).createRouter());
router.use("/users",       new UsersManager(pool).createRouter());
router.use("/discussions", new DiscussionsManager(pool).createRouter());
router.use("/news",        new NewsManager(pool).createRouter());
app.use("/api", router);


// Manages errors and sends a generic response to the client
app.use((error, request, response, next) => {
    console.error(error);

    if (response.headersSent) return next(error);
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
        return response.status(400).json({ error: "Invalid request", details: ["Malformed JSON body"] });
    }
    response.status(500).json({ error: "Internal server error" });
});


app.listen(process.env.PORT, process.env.HOST, () => {
    console.log(`Server is running on: http://${process.env.HOST}:${process.env.PORT}`);
});