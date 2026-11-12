const { createHash, randomBytes, timingSafeEqual} = require("node:crypto");
const express = require("express");


const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";
const STATE_COOKIE = "discord_oauth_state";
const SESSION_COOKIE = "session";


// Returns the required variable and if not found raise an exception
function requiredEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

// Forms the cookie options string for the Set-Cookie header
function cookieOptions(maxAge) {
    return [
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        ...(process.env.COOKIE_SECURE === "true" ? ["Secure"] : []),
        `Max-Age=${maxAge}`,
    ].join("; ");
}


// Parses the cookies from the request headers into an object
function parseCookies(request) {
    const cookieHeader = request.headers.cookie || "";
    const cookiePairs = cookieHeader
        .split(";")
        .filter(Boolean)
        .map((part) => {
            // Split the cookie string into name and value, handling cases where '=' may not be present
            const separator = part.indexOf("=");
            if (separator < 0) return [part.trim(), ""];
        
            // Returns the name and value of the cookie, decoding the value from the url format
            return [
                part.slice(0, separator).trim(),
                decodeURIComponent(part.slice(separator + 1).trim()),
            ];
    });

    return Object.fromEntries(cookiePairs);
}


function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

// Checks if the provided state matches the expected state in a time-safe manner
function safeStateMatches(expected, received) {
    if (!expected || !received) return false;
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return expectedBuffer.length === receivedBuffer.length
        && timingSafeEqual(expectedBuffer, receivedBuffer);
}

// Generates a normalized username base from the Discord user object
function usernameBase(discordUser) {
    const value = discordUser.username || discordUser.id;
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    return (normalized || `discord_${discordUser.id}`).slice(0, 50);
}

// Returns the avatar url from a User Object 
function avatarUrl(discordUser) {
    if (!discordUser.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(discordUser.id)}/${encodeURIComponent(discordUser.avatar)}.png?size=128`;
}


async function findOrCreateUser(connection, discordUser) {
    const [existingRows] = await connection.execute(
        "SELECT username, nick, role, discord_id, avatar_url, created_at FROM users WHERE discord_id = ?",
        [discordUser.id],
    );

    const nick = String(discordUser.global_name || discordUser.username).slice(0, 100);
    const userAvatarUrl = avatarUrl(discordUser);

    // If a user already exists for this Discord ID, update their nick
    if (existingRows.length) {
        await connection.execute(
            "UPDATE users SET nick = ?, avatar_url = ? WHERE discord_id = ?",
            [nick, userAvatarUrl, discordUser.id],
        );
        
        return { ...existingRows[0], nick, avatar_url: userAvatarUrl };
    }

    // If no user exists for this Discord ID, try to create a new one with a unique username
    const base = usernameBase(discordUser);
    let username = base;

    for (let suffix = 1; suffix <= 100; suffix += 1) {
        // Find if a user already exists with this username
        const [rows] = await connection.execute(
            "SELECT username FROM users WHERE username = ?",
            [username],
        );

        // If no entry exists for this username, create a new user and return it
        if (!rows.length) {
            await connection.execute(
                "INSERT INTO users (username, nick, discord_id, avatar_url) VALUES (?, ?, ?, ?)",
                [username, nick, discordUser.id, userAvatarUrl],
            );

            return {
                username,
                nick,
                role: "member",
                discord_id: discordUser.id,
                avatar_url: userAvatarUrl,
            };
        }

        // If the username is taken, try a new one with a numeric suffix
        username = `${base.slice(0, 50 - String(suffix).length - 1)}_${suffix}`;
    }

    throw new Error("Unable to allocate a unique username for the Discord user");
}

// Retrieves the authenticated user from the session token in the request cookies
async function getAuthenticatedUser(pool, request) {
    const sessionToken = parseCookies(request)[SESSION_COOKIE];
    if (!sessionToken) return null;

    const [rows] = await pool.execute(
        `SELECT u.username, u.nick, u.role, u.discord_id, u.avatar_url, u.created_at
            FROM sessions s JOIN users u ON u.username = s.username
            WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()`,
        [hashToken(sessionToken)],
    );

    return rows[0] || null;
}


// Exchanges the Discord OAuth code for an access token
async function exchangeCode(code) {
    const body = new URLSearchParams({
        client_id: requiredEnv("DISCORD_CLIENT_ID"),
        client_secret: requiredEnv("DISCORD_CLIENT_SECRET"),
        grant_type: "authorization_code",
        code,
        redirect_uri: requiredEnv("DISCORD_REDIRECT_URI"),
    });

    const response = await fetch(DISCORD_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });

    if (!response.ok) throw new Error(`Discord token exchange failed (${response.status})`);
    return response.json();
}


// Retrieves the Discord user object using the access token
async function getDiscordUser(accessToken) {
    if (!accessToken) throw new Error("Discord did not return an access token");

    const response = await fetch(DISCORD_USER_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error(`Discord user lookup failed (${response.status})`);
    return response.json();
}


// Creates an Express middleware for handling session authentication
function createAuthMiddleware(pool, { publicGetAllRoutes = [], publicGetPrefixes = [] } = {}) {
    const publicRoutes = new Set(publicGetAllRoutes);

    return async (request, response, next) => {
        // Skip the auth if a route is whitelisted
        if (
            request.method === "GET" &&
            (publicRoutes.has(request.path) || publicGetPrefixes.some((prefix) => request.path.startsWith(prefix)))
        ) {
            return next();
        }

        try {
            // Checks that the user is authenticated
            const user = await getAuthenticatedUser(pool, request);
            if (!user) return response.status(401).json({ error: "Authentication required" });

            request.user = user;
            return next();
        } catch (error) {
            return next(error);
        }
    };
}



// Creates an Express router for handling Discord authentication routes
function createAuthRouter(pool) {
    const router = express.Router();
    const sessionTtl = Number(process.env.SESSION_TTL_SECONDS || 604800);

    // Route for initiating the Discord OAuth flow
    // 1st step: Redirects the user to Discord's authorization page with a state parameter
    router.get("/discord", (request, response, next) => {
        try {
            const state = randomBytes(32).toString("hex");
            const params = new URLSearchParams({
                client_id: requiredEnv("DISCORD_CLIENT_ID"),
                redirect_uri: requiredEnv("DISCORD_REDIRECT_URI"),
                response_type: "code",
                scope: process.env.DISCORD_SCOPE || "identify",
                state,
            });

            response.setHeader("Set-Cookie", `${STATE_COOKIE}=${encodeURIComponent(state)}; ${cookieOptions(600)}`);
            response.redirect(`${DISCORD_AUTHORIZE_URL}?${params}`);

        } catch (error) {
            next(error);
        }
    });

    // 2nd step: Handles the Discord OAuth callback
    router.get("/discord/callback", async (request, response, next) => {
        const { code, state, error } = request.query;
        const cookies = parseCookies(request);
        const clearStateCookie = `${STATE_COOKIE}=; ${cookieOptions(0)}`;

        if (error || typeof code !== "string" || !safeStateMatches(cookies[STATE_COOKIE], state)) {
            response.setHeader("Set-Cookie", clearStateCookie);
            return response.status(400).json({ error: "Invalid Discord OAuth callback" });
        }

        let connection;

        try {
            // Gets the access token
            const token = await exchangeCode(code);
            const discordUser = await getDiscordUser(token.access_token);

            // Starts a database transaction to find or create the user and create a session
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Finds or creates the user in the database and creates a new session
            const user = await findOrCreateUser(connection, discordUser);
            const sessionToken = randomBytes(32).toString("hex");
            const expiresAt = new Date(Date.now() + sessionTtl * 1000);

            // Inserts the new session into the database
            await connection.execute(
                "INSERT INTO sessions (token_hash, username, expires_at) VALUES (?, ?, ?)",
                [hashToken(sessionToken), user.username, expiresAt],
            );

            // Commits the transaction and releases the connection
            await connection.commit();
            connection.release();
            connection = null;

            response.setHeader("Set-Cookie", [
                clearStateCookie,
                `${SESSION_COOKIE}=${sessionToken}; ${cookieOptions(sessionTtl)}`,
            ]);
            
            return response.redirect(process.env.CLIENT_ORIGIN || "/");

        } catch (callbackError) {
            if (connection) {
                await connection.rollback();
                connection.release();
            }
            return next(callbackError);
        }
    });

    // Route for retrieving the current authenticated user's information
    router.get("/me", async (request, response, next) => {
        try {
            const user = await getAuthenticatedUser(pool, request);
            if (!user) return response.status(401).json({ error: "Authentication required" });
            return response.json({ user });
        } catch (error) {
            return next(error);
        }
    });

    // Route for logging out the current user by deleting their session
    router.post("/logout", async (request, response, next) => {
        try {
            const sessionToken = parseCookies(request)[SESSION_COOKIE];
            if (sessionToken) {
                await pool.execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(sessionToken)]);
            }
            response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; ${cookieOptions(0)}`);
            return response.status(204).end();
        } catch (error) {
            return next(error);
        }
    });

    return router;
}

module.exports = { createAuthMiddleware, createAuthRouter };