import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getDisplayName } from "@/lib/playerUtils";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        const player = await prisma.players_v2.findFirst({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!player || !player.password_hash) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          player.password_hash
        );

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        await prisma.players_v2.update({
          where: { uid: player.uid },
          data: { last_login_at: new Date() },
        });

        return {
          id: player.uid,
          email: player.email,
          name: getDisplayName(player),
          nickname: player.nickname,
          image: player.photo_url,
          isAdmin: player.isAdmin,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = user.id;
        token.name = user.name;
        token.nickname = user.nickname ?? null;
        token.image = user.image;
        token.isAdmin = user.isAdmin ?? false;
      }

      if (trigger === "update" && session) {
        token.name = session.name;
        token.nickname = session.nickname ?? null;
        token.image = session.image;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.uid = token.uid as string;
        session.user.nickname = token.nickname as string | null;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};
