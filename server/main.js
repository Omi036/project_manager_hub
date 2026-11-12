const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config({ quiet: true });

// Loads the database connection pool and the API routers
const pool = require("./database");
const { createAuthMiddleware, createAuthRouter } = require("./auth");

const { ProjectsManager } = require("./managers/projects");
const { UsersManager } = require("./managers/users");
const { DiscussionsManager } = require("./managers/discussions");
const { NewsManager } = require("./managers/news");


const app = express();

app.use(cors({origin: process.env.CLIENT_ORIGIN || false, credentials: true,}));
app.use(express.json({ limit: "1mb" }));
app.use("/auth", createAuthRouter(pool));
app.use("/api", createAuthMiddleware(pool, {
    publicGetAllRoutes: [
        "/projects/all",
        "/users/all",
        "/discussions/all",
        "/news/all",
    ],
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
    response.status(500).json({ error: "Internal server error" });
});


app.listen(process.env.PORT, process.env.HOST, () => {
    console.log(`Server is running on: http://${process.env.HOST}:${process.env.PORT}`);
});