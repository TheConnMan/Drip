import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

// Check if running in local development mode (no REPL_ID)
export const isLocalDev = !process.env.REPL_ID;

const DEFAULT_LOCAL_DB = "postgresql://postgres:postgres@localhost:5432/drip";
const DEFAULT_SESSION_SECRET = "local-dev-secret-not-for-production";

// Local dev user for testing
const LOCAL_DEV_USER = {
  id: "local-dev-user",
  email: "dev@localhost",
  firstName: "Local",
  lastName: "Developer",
  profileImageUrl: null,
};

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL || DEFAULT_LOCAL_DB,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: !isLocalDev, // Allow non-HTTPS in local dev
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

// Setup local dev user in session format
function createLocalDevSession() {
  const now = Math.floor(Date.now() / 1000);
  return {
    claims: {
      sub: LOCAL_DEV_USER.id,
      email: LOCAL_DEV_USER.email,
      first_name: LOCAL_DEV_USER.firstName,
      last_name: LOCAL_DEV_USER.lastName,
      profile_image_url: LOCAL_DEV_USER.profileImageUrl,
      exp: now + 86400 * 365, // 1 year from now
    },
    access_token: "local-dev-token",
    refresh_token: null,
    expires_at: now + 86400 * 365,
  };
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // In local dev mode, skip OIDC setup
  if (isLocalDev) {
    console.log("Running in local development mode - Replit Auth disabled");

    // Ensure local dev user exists in database
    await authStorage.upsertUser(LOCAL_DEV_USER);

    passport.serializeUser((user: Express.User, cb) => cb(null, user));
    passport.deserializeUser((user: Express.User, cb) => cb(null, user));

    // Local login endpoint - auto-login as dev user
    app.get("/api/login", (req, res) => {
      const localUser = createLocalDevSession();
      req.login(localUser, (err) => {
        if (err) {
          console.error("Local login error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        res.redirect("/");
      });
    });

    // Local callback - redirect to login
    app.get("/api/callback", (_req, res) => {
      res.redirect("/api/login");
    });

    // Local logout
    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        res.redirect("/");
      });
    });

    return;
  }

  // Replit Auth setup (production)
  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // In local dev, just check if user is authenticated (session exists)
  if (isLocalDev) {
    if (!req.isAuthenticated() || !user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return next();
  }

  // Production Replit Auth flow
  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
