"use client";

import { createAuthClient } from "better-auth/react";

/** Client-side Better Auth instance. Talks to /api/auth on the same origin. */
export const authClient = createAuthClient();

export const { useSession, signIn, signUp, signOut } = authClient;
