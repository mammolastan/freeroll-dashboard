import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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

        const player = await prisma.player.findFirst({
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

        await prisma.player.update({
          where: { uid: player.uid },
          data: { last_login_at: new Date() },
        });

        return {
          id: player.uid,
          email: player.email,
          name: player.name,
          nickname: player.nickname,
          image: player.photo_url,
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
        token.nickname = user.nickname ?? null;
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
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};
