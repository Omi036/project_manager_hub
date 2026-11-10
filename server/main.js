const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config({ quiet: true });

// Loads the database connection pool and the auth router
const pool = require("./database");
const { createAuthRouter } = require("./auth");


const app = express();

app.use(cors({origin: process.env.CLIENT_ORIGIN || false, credentials: true,}));
app.use(express.json());
app.use("/auth", createAuthRouter(pool));


// Serve static files from the client directory
if(process.env.SHOULD_SERVE_WEB) {
    app.use(express.static(path.join(__dirname, '../client/')));
}


app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});


app.use((error, request, response, next) => {
    console.error(error);
    if (response.headersSent) return next(error);
    response.status(500).json({ error: "Internal server error" });
});